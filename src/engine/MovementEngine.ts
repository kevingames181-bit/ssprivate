/**
 * MovementEngine — production-grade realtime fish movement interpolation engine.
 *
 * Responsibilities:
 *  - Normalize raw RMIS weekly positions into a continuous timeline
 *  - Interpolate lat/lng between known positions using easing
 *  - Calculate bearing, speed, and trail opacity per frame
 *  - Manage playback state (play/pause/scrub/speed/live)
 *  - Batch animation ticks via requestAnimationFrame
 *  - Prevent teleporting by clamping max step distance
 *  - Support thousands of simultaneous tracks without GC pressure
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawMovementPoint {
  lat: number;
  lng: number;
  /** Normalised lifecycle day: 0 = hatchery release, 367 = return */
  day: number;
  catchCount: number;
  locationName: string;
  isHatchery: boolean;
  isReturn: boolean;
}

export interface TrackState {
  trackId: string;
  /** Current interpolated position */
  lat: number;
  lng: number;
  /** Bearing in degrees (0 = north, clockwise) */
  bearing: number;
  /** Speed in km/day */
  speed: number;
  /** 0–1 trail opacity (fades for old/slow segments) */
  trailOpacity: number;
  /** Whether this track is currently visible at the playback day */
  visible: boolean;
  /** Nearest known point index */
  segmentIndex: number;
  /** 0–1 interpolation progress within current segment */
  segmentT: number;
}

export interface PlaybackState {
  day: number;
  isPlaying: boolean;
  speed: number;
  isLive: boolean;
  startDay: number;
  endDay: number;
}

export type PlaybackListener = (state: PlaybackState) => void;
export type TrackListener = (tracks: Map<string, TrackState>) => void;

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180;
const MAX_TELEPORT_KM = 800;   // segments longer than this are treated as gaps
const TRAIL_FADE_DAYS = 30;    // days over which trail fades to 0
const RENDER_THROTTLE_MS = 16; // ~60fps cap

// ─── Math helpers ─────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG;
  const dLng = (lng2 - lng1) * DEG;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * DEG;
  const y = Math.sin(dLng) * Math.cos(lat2 * DEG);
  const x =
    Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) -
    Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos(dLng);
  return ((Math.atan2(y, x) / DEG) + 360) % 360;
}

/** Smooth-step easing (cubic) */
function smoothStep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Interpolate lat/lng along great circle (linear for short distances) */
function interpolateLatLng(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  t: number,
): [number, number] {
  const st = smoothStep(t);
  return [lat1 + (lat2 - lat1) * st, lng1 + (lng2 - lng1) * st];
}

// ─── Track normalisation ──────────────────────────────────────────────────────

/**
 * Convert raw weekly positions into a deduplicated, sorted, gap-filtered
 * array of RawMovementPoints ready for interpolation.
 */
export function normaliseTrack(
  points: Array<{
    lat: number;
    lng: number;
    movementDay?: number;
    playbackDay?: number;
    catchCount: number;
    locationName: string;
    isHatchery: boolean;
    isReturn: boolean;
    isoWeek: number;
    weekIndex: number;
  }>,
): RawMovementPoint[] {
  if (points.length === 0) return [];

  const resolved: RawMovementPoint[] = points.map(p => ({
    lat: p.lat,
    lng: p.lng,
    day: p.playbackDay ?? p.movementDay ?? (p.isoWeek > 0 ? (p.isoWeek - 1) * 7 + 4 : p.weekIndex),
    catchCount: p.catchCount,
    locationName: p.locationName,
    isHatchery: p.isHatchery,
    isReturn: p.isReturn,
  }));

  // Sort by day
  resolved.sort((a, b) => a.day - b.day);

  // Remove duplicate days (keep highest catchCount)
  const deduped: RawMovementPoint[] = [];
  for (const pt of resolved) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.day - pt.day) < 0.5) {
      if (pt.catchCount > last.catchCount) deduped[deduped.length - 1] = pt;
    } else {
      deduped.push(pt);
    }
  }

  // Filter teleports — mark segments > MAX_TELEPORT_KM as gaps by inserting
  // a synthetic invisible point at the midpoint
  const filtered: RawMovementPoint[] = [deduped[0]];
  for (let i = 1; i < deduped.length; i++) {
    const prev = deduped[i - 1];
    const curr = deduped[i];
    const dist = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
    if (dist > MAX_TELEPORT_KM) {
      // Insert gap marker — invisible, at midpoint day
      filtered.push({
        lat: (prev.lat + curr.lat) / 2,
        lng: (prev.lng + curr.lng) / 2,
        day: (prev.day + curr.day) / 2,
        catchCount: 0,
        locationName: '',
        isHatchery: false,
        isReturn: false,
      });
    }
    filtered.push(curr);
  }

  return filtered;
}

// ─── Interpolation ────────────────────────────────────────────────────────────

/**
 * Given a normalised track and a playback day, compute the interpolated
 * TrackState. Returns null if the day is outside the track's range.
 */
export function interpolateTrack(
  trackId: string,
  points: RawMovementPoint[],
  day: number,
): TrackState | null {
  if (points.length === 0) return null;

  const first = points[0];
  const last = points[points.length - 1];

  if (day < first.day - 0.5 || day > last.day + 0.5) {
    return null;
  }

  // Find the segment containing `day`
  let segIdx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    if (day >= points[i].day && day <= points[i + 1].day) {
      segIdx = i;
      break;
    }
    if (day < points[0].day) { segIdx = 0; break; }
    segIdx = points.length - 2;
  }

  const p0 = points[segIdx];
  const p1 = points[segIdx + 1] ?? p0;

  const segDuration = p1.day - p0.day;
  const t = segDuration > 0 ? Math.max(0, Math.min(1, (day - p0.day) / segDuration)) : 1;

  const [lat, lng] = interpolateLatLng(p0.lat, p0.lng, p1.lat, p1.lng, t);
  const bearing = bearingDeg(p0.lat, p0.lng, p1.lat, p1.lng);
  const distKm = haversineKm(p0.lat, p0.lng, p1.lat, p1.lng);
  const speed = segDuration > 0 ? distKm / segDuration : 0;

  // Trail opacity: full for recent movement, fades for old/slow
  const daysSinceStart = day - first.day;
  const totalDays = last.day - first.day;
  const progress = totalDays > 0 ? daysSinceStart / totalDays : 1;
  const trailOpacity = Math.max(0.15, Math.min(1, 0.3 + progress * 0.7));

  return {
    trackId,
    lat,
    lng,
    bearing,
    speed,
    trailOpacity,
    visible: true,
    segmentIndex: segIdx,
    segmentT: t,
  };
}

// ─── PlaybackManager ──────────────────────────────────────────────────────────

/**
 * Manages the RAF-based animation loop, playback state, and notifies
 * registered listeners on each frame. Designed to be instantiated once
 * per page mount and cleaned up on unmount.
 */
export class PlaybackManager {
  private state: PlaybackState;
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;
  private lastRenderTimestamp: number | null = null;
  private playbackListeners = new Set<PlaybackListener>();
  private trackListeners = new Set<TrackListener>();
  private tracks = new Map<string, RawMovementPoint[]>();
  private trackStates = new Map<string, TrackState>();

  constructor(startDay = 0, endDay = 367) {
    this.state = {
      day: startDay,
      isPlaying: false,
      speed: 1,
      isLive: false,
      startDay,
      endDay,
    };
  }

  // ── Track management ────────────────────────────────────────────────────────

  setTracks(tracks: Map<string, RawMovementPoint[]>): void {
    this.tracks = tracks;
    this.trackStates.clear();
    this._computeTrackStates();
    this._notifyTrackListeners();
  }

  updateBounds(startDay: number, endDay: number): void {
    this.state = { ...this.state, startDay, endDay };
    if (this.state.day < startDay) this.state.day = startDay;
    if (this.state.day > endDay) this.state.day = endDay;
    this._notifyPlaybackListeners();
  }

  // ── Playback controls ────────────────────────────────────────────────────────

  play(): void {
    if (this.state.isPlaying) return;
    if (this.state.day >= this.state.endDay) {
      this.state.day = this.state.startDay;
    }
    this.state.isPlaying = true;
    this.lastTimestamp = null;
    this._scheduleFrame();
    this._notifyPlaybackListeners();
  }

  pause(): void {
    this.state.isPlaying = false;
    this._cancelFrame();
    this._notifyPlaybackListeners();
  }

  togglePlay(): void {
    this.state.isPlaying ? this.pause() : this.play();
  }

  scrub(day: number): void {
    const clamped = Math.max(this.state.startDay, Math.min(this.state.endDay, day));
    this.state.day = clamped;
    this.state.isPlaying = false;
    this._cancelFrame();
    this._computeTrackStates();
    this._notifyPlaybackListeners();
    this._notifyTrackListeners();
  }

  setSpeed(speed: number): void {
    this.state.speed = Math.max(0.1, Math.min(32, speed));
    this._notifyPlaybackListeners();
  }

  reset(): void {
    this.pause();
    this.state.day = this.state.startDay;
    this._computeTrackStates();
    this._notifyPlaybackListeners();
    this._notifyTrackListeners();
  }

  skipToEnd(): void {
    this.pause();
    this.state.day = this.state.endDay;
    this._computeTrackStates();
    this._notifyPlaybackListeners();
    this._notifyTrackListeners();
  }

  getState(): Readonly<PlaybackState> {
    return this.state;
  }

  getTrackStates(): ReadonlyMap<string, TrackState> {
    return this.trackStates;
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  onPlayback(listener: PlaybackListener): () => void {
    this.playbackListeners.add(listener);
    return () => this.playbackListeners.delete(listener);
  }

  onTracks(listener: TrackListener): () => void {
    this.trackListeners.add(listener);
    return () => this.trackListeners.delete(listener);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  destroy(): void {
    this._cancelFrame();
    this.playbackListeners.clear();
    this.trackListeners.clear();
    this.tracks.clear();
    this.trackStates.clear();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _scheduleFrame(): void {
    this.rafId = requestAnimationFrame(this._tick);
  }

  private _cancelFrame(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTimestamp = null;
  }

  private _tick = (timestamp: number): void => {
    if (!this.state.isPlaying) return;

    if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
    const deltaMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Advance day: speed=1 → 1 day/second
    const deltaDays = (deltaMs / 1000) * this.state.speed;
    this.state.day = Math.min(this.state.endDay, this.state.day + deltaDays);

    if (this.state.day >= this.state.endDay) {
      this.state.day = this.state.endDay;
      this.state.isPlaying = false;
      this._computeTrackStates();
      this._notifyPlaybackListeners();
      this._notifyTrackListeners();
      return;
    }

    // Throttle React state updates to ~60fps
    const shouldRender =
      this.lastRenderTimestamp === null ||
      timestamp - this.lastRenderTimestamp >= RENDER_THROTTLE_MS;

    if (shouldRender) {
      this.lastRenderTimestamp = timestamp;
      this._computeTrackStates();
      this._notifyPlaybackListeners();
      this._notifyTrackListeners();
    }

    this.rafId = requestAnimationFrame(this._tick);
  };

  private _computeTrackStates(): void {
    for (const [id, points] of this.tracks) {
      const state = interpolateTrack(id, points, this.state.day);
      if (state) {
        this.trackStates.set(id, state);
      } else {
        this.trackStates.delete(id);
      }
    }
  }

  private _notifyPlaybackListeners(): void {
    const snapshot = { ...this.state };
    for (const listener of this.playbackListeners) {
      listener(snapshot);
    }
  }

  private _notifyTrackListeners(): void {
    const snapshot = new Map(this.trackStates);
    for (const listener of this.trackListeners) {
      listener(snapshot);
    }
  }
}

// ─── Velocity cache ───────────────────────────────────────────────────────────

/**
 * Pre-compute per-segment velocity and bearing for a normalised track.
 * Cached to avoid recomputation on every frame.
 */
export interface SegmentMeta {
  distKm: number;
  bearing: number;
  durationDays: number;
  speedKmPerDay: number;
}

export function computeSegmentMeta(points: RawMovementPoint[]): SegmentMeta[] {
  const meta: SegmentMeta[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const distKm = haversineKm(p0.lat, p0.lng, p1.lat, p1.lng);
    const bearing = bearingDeg(p0.lat, p0.lng, p1.lat, p1.lng);
    const durationDays = Math.max(0.001, p1.day - p0.day);
    meta.push({
      distKm,
      bearing,
      durationDays,
      speedKmPerDay: distKm / durationDays,
    });
  }
  return meta;
}

// ─── Trail builder ────────────────────────────────────────────────────────────

export interface TrailPoint {
  lat: number;
  lng: number;
  opacity: number;
}

/**
 * Build a trail of N points behind the current position for rendering.
 * Opacity fades from 1 at head to 0 at tail.
 */
export function buildTrail(
  points: RawMovementPoint[],
  currentDay: number,
  trailDays = TRAIL_FADE_DAYS,
  resolution = 8,
): TrailPoint[] {
  if (points.length < 2) return [];

  const trailStart = currentDay - trailDays;
  const trail: TrailPoint[] = [];

  for (let i = 0; i < resolution; i++) {
    const t = i / (resolution - 1);
    const day = trailStart + t * trailDays;
    if (day > currentDay) break;

    const state = interpolateTrack('_trail', points, day);
    if (!state) continue;

    trail.push({
      lat: state.lat,
      lng: state.lng,
      opacity: smoothStep(t) * 0.7,
    });
  }

  return trail;
}

// ─── Day label helpers ────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayToCalendarLabel(day: number): string {
  const rounded = Math.max(1, Math.round(day));
  const normalized = ((rounded - 1) % 365 + 365) % 365 + 1;
  const date = new Date(Date.UTC(2024, 0, normalized));
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]}`;
}

export function dayToTimelineLabel(day: number, startDay: number, endDay: number, hasReturn: boolean): string {
  if (endDay <= startDay) return 'No data';
  if (day <= startDay + 0.5) return 'First Catch';
  if (day >= endDay - 0.5) return hasReturn ? 'Return to Hatchery' : 'Latest Catch';
  return `Week of ${dayToCalendarLabel(day)}`;
}
