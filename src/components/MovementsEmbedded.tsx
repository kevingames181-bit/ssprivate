/**
 * MovementsEmbedded - Fish Movements tab embedded inside MapPage.
 *
 * Movement calls are gated behind region, hatchery, year, and species
 * selection. The rendered tracks are averaged lifecycle paths per species
 * for the selected recovery years.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  allDisplayYears,
  buildWeeklyMovementData,
  getSeedAlaskaHatcheries,
  getSeedAlaskaRegions,
  MOVEMENT_OUTLIER_MIN_TRACKED_FISH,
  MOVEMENT_SPECIES_OPTIONS,
  YEAR_RANGE_START,
} from '../services/movementDataService';
import type { HatcheryWeeklyMovement } from '../services/movementDataService';
import {
  StaticPathLayer,
  AnimatedFishLayer,
  HatcheryMarker,
  MovementBoundsController,
  PwsBoundaryPreloader,
  tileUrl,
  tileAttribution,
  yearColor,
} from './MapView';
import '../styles/movements-page.css';

interface MovementsEmbeddedProps {
  onGoToData: () => void;
}

const movementSessionCache = new Map<string, HatcheryWeeklyMovement | null>();
const MOVEMENT_CACHE_VERSION = 'weekly-stable-v32';
const MOVEMENT_CACHE_STORAGE_PREFIX = 'seascope.movement.cache::';
const ANIMATION_SECONDS_PER_DAY = 0.25;
const PLAYBACK_RENDER_INTERVAL_MS = 80;
const WEEKLY_OUTLIER_TOOLTIP = `Adds spot/week points backed by less than ${MOVEMENT_OUTLIER_MIN_TRACKED_FISH} tracked fish while still requiring at least two recovery years`;
const SELECTED_SPECIES_SESSION_KEY = 'seascope.movement.selectedSpecies';
const PLAYBACK_WEEK_STEP_DAYS = 7;
const PLAYBACK_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface RouteConfidenceSummary {
  percentage: number;
  trackedFish: number;
  returnedFish: number;
  rawPointCount: number;
  activeDayCount: number;
  averageGapDays: number;
  maxGapDays: number;
  timeframeDays: number;
  routeDistanceKm: number;
  lowOfficialData: boolean;
}

function sortedYearsKey(years: Iterable<number>): string {
  return Array.from(years).sort((a, b) => a - b).join(',');
}

function defaultSelectedSpeciesSet(): Set<string> {
  return new Set(MOVEMENT_SPECIES_OPTIONS.map(sp => sp.code));
}

function selectedSpeciesSetKey(species: Iterable<string>): string {
  return Array.from(species).sort((a, b) => a.localeCompare(b)).join(',');
}

function readSelectedSpeciesSession(): Set<string> {
  if (typeof window === 'undefined') return defaultSelectedSpeciesSet();

  try {
    const raw = window.sessionStorage.getItem(SELECTED_SPECIES_SESSION_KEY);
    if (raw === null) return defaultSelectedSpeciesSet();

    const parsed = JSON.parse(raw);
    const validCodes = new Set(MOVEMENT_SPECIES_OPTIONS.map(sp => sp.code));
    const selected = Array.isArray(parsed)
      ? parsed.filter((code): code is string => typeof code === 'string' && validCodes.has(code))
      : [];
    return Array.isArray(parsed) ? new Set(selected) : defaultSelectedSpeciesSet();
  } catch {
    return defaultSelectedSpeciesSet();
  }
}

function parityYears(years: number[], parity: 'even' | 'odd'): number[] {
  return years.filter(year => parity === 'even' ? year % 2 === 0 : year % 2 !== 0);
}

function formatFishCount(value: number): string {
  const rounded = value > 0 ? Math.max(1, Math.round(value)) : 0;
  return rounded.toLocaleString();
}

function movementCacheKey(
  hatcheryName: string,
  yearsKey: string,
  speciesCode: string,
  includeOutliers: boolean
): string {
  return `${MOVEMENT_CACHE_VERSION}::${hatcheryName}::${yearsKey}::${includeOutliers ? 'with-outliers' : 'strict'}::${speciesCode}`;
}

function movementCacheStorageKey(cacheKey: string): string {
  return `${MOVEMENT_CACHE_STORAGE_PREFIX}${cacheKey}`;
}

function readMovementCache(cacheKey: string): HatcheryWeeklyMovement | null | undefined {
  if (movementSessionCache.has(cacheKey)) return movementSessionCache.get(cacheKey);
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = window.sessionStorage.getItem(movementCacheStorageKey(cacheKey));
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw) as HatcheryWeeklyMovement | null;
    movementSessionCache.set(cacheKey, parsed ?? null);
    return parsed ?? null;
  } catch {
    return undefined;
  }
}

function writeMovementCache(cacheKey: string, movement: HatcheryWeeklyMovement | null) {
  movementSessionCache.set(cacheKey, movement);

  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(movementCacheStorageKey(cacheKey), JSON.stringify(movement));
  } catch {
    // In-memory caching still protects the API when storage is unavailable or full.
  }
}

function hasLoadedMovementCache(cacheKey: string): boolean {
  return readMovementCache(cacheKey) != null;
}

function speciesCodeForMovement(movement: HatcheryWeeklyMovement): string {
  const codeFromYear = movement.year >= 3000 ? String(movement.year - 3000) : '';
  if (MOVEMENT_SPECIES_OPTIONS.some(sp => sp.code === codeFromYear)) return codeFromYear;
  return MOVEMENT_SPECIES_OPTIONS.find(sp => sp.name === movement.species || sp.name === movement.label)?.code ?? codeFromYear;
}

function cachedMovementsForScope(
  hatcheryName: string,
  yearsKey: string,
  includeOutliers: boolean
): HatcheryWeeklyMovement[] {
  return MOVEMENT_SPECIES_OPTIONS
    .map(sp => readMovementCache(movementCacheKey(hatcheryName, yearsKey, sp.code, includeOutliers)))
    .filter((movement): movement is HatcheryWeeklyMovement => movement != null);
}

function positionMovementDay(position: HatcheryWeeklyMovement['weeklyPositions'][number]): number {
  if (typeof position.playbackDay === 'number') return position.playbackDay;
  if (typeof position.movementDay === 'number') return position.movementDay;
  if (position.isHatchery && !position.isReturn) return 0;
  if (position.isReturn) return 367;
  if (position.isoWeek > 0) return Math.min(366, Math.max(1, (position.isoWeek - 1) * 7 + 4));
  return Math.min(366, Math.max(1, position.weekIndex));
}

function movementTimelineBounds(movements: HatcheryWeeklyMovement[]): { start: number; end: number } {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;

  for (const movement of movements) {
    const positions = movement.weeklyPositions;
    if (positions.length === 0) continue;
    start = Math.min(start, positionMovementDay(positions[0]));
    end = Math.max(end, positionMovementDay(positions[positions.length - 1]));
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return { start: 0, end: 0 };
  return { start, end };
}

function routeConfidenceSummary(movements: HatcheryWeeklyMovement[], includeOutliers = false): RouteConfidenceSummary | null {
  const confidences = movements
    .map(movement => movement.pathConfidence)
    .filter((confidence): confidence is NonNullable<HatcheryWeeklyMovement['pathConfidence']> => Boolean(confidence));

  if (confidences.length === 0) return null;

  let weightTotal = 0;
  let weightedPercentage = 0;
  let weightedAverageGap = 0;
  let trackedFish = 0;
  let returnedFish = 0;
  let rawPointCount = 0;
  let activeDayCount = 0;
  let maxGapDays = 0;
  let timeframeDays = 0;
  let routeDistanceKm = 0;
  let lowOfficialData = movements.some(movement => movement.lowOfficialData);

  for (const confidence of confidences) {
    const evidenceWeight = Math.log1p(confidence.trackedFish + confidence.returnedFish);
    const structureWeight = Math.log1p(confidence.rawPointCount + confidence.activeDayCount * 4);
    const weight = Math.max(1, evidenceWeight * 0.65 + structureWeight * 0.35);
    weightTotal += weight;
    weightedPercentage += confidence.percentage * weight;
    weightedAverageGap += confidence.averageGapDays * weight;
    trackedFish += confidence.trackedFish;
    returnedFish += confidence.returnedFish;
    rawPointCount += confidence.rawPointCount;
    activeDayCount += confidence.activeDayCount;
    maxGapDays = Math.max(maxGapDays, confidence.maxGapDays);
    timeframeDays = Math.max(timeframeDays, confidence.timeframeDays);
    routeDistanceKm += confidence.routeDistanceKm;
    lowOfficialData = lowOfficialData || confidence.lowOfficialData === true;
  }

  const basePercentage = Math.round(weightedPercentage / Math.max(weightTotal, 1));
  const percentage = includeOutliers ? Math.round(basePercentage * 0.9) : basePercentage;

  return {
    percentage: Math.max(0, Math.min(100, percentage)),
    trackedFish,
    returnedFish,
    rawPointCount,
    activeDayCount,
    averageGapDays: Number((weightedAverageGap / Math.max(weightTotal, 1)).toFixed(1)),
    maxGapDays,
    timeframeDays,
    routeDistanceKm,
    lowOfficialData,
  };
}

function confidenceTone(percentage: number): 'low' | 'medium' | 'high' {
  if (percentage >= 75) return 'high';
  if (percentage >= 50) return 'medium';
  return 'low';
}

function clampPlaybackDay(day: number, start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(end, Math.max(start, day));
}

function playbackSliderTicks(start: number, end: number): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  const ticks: number[] = [start];
  let next = start + PLAYBACK_WEEK_STEP_DAYS;
  while (next < end - 0.5) {
    ticks.push(next);
    next += PLAYBACK_WEEK_STEP_DAYS;
  }
  if (ticks[ticks.length - 1] !== end) ticks.push(end);
  return ticks;
}

function nearestPlaybackTickIndex(ticks: number[], day: number): number {
  if (ticks.length === 0) return 0;

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  ticks.forEach((tick, index) => {
    const distance = Math.abs(tick - day);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function playbackCalendarLabel(day: number): string {
  const rounded = Math.max(1, Math.round(day));
  const normalized = ((rounded - 1) % 365 + 365) % 365 + 1;
  const date = new Date(Date.UTC(2024, 0, normalized));
  return `${date.getUTCDate()} ${PLAYBACK_MONTH_LABELS[date.getUTCMonth()]}`;
}

function playbackTimelineLabel(day: number, start: number, end: number, hasReturn: boolean): string {
  if (end <= start) return 'No movement loaded';
  if (day <= start + 0.5) return 'Average First Catch';
  if (day >= end - 0.5) return hasReturn ? 'Average First Return to Hatchery' : 'Latest Catch Week';
  return `Week of ${playbackCalendarLabel(day)}`;
}

export function MovementsEmbedded({}: MovementsEmbeddedProps) {
  const allYears = allDisplayYears();
  const [hatcheries] = useState(() => getSeedAlaskaHatcheries());
  const [regions] = useState(() => getSeedAlaskaRegions());
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedHatchery, setSelectedHatchery] = useState('');
  const [selectedYears, setSelectedYears] = useState<Set<number>>(
    () => new Set(allDisplayYears())
  );
  const [selectedSpecies, setSelectedSpecies] = useState<Set<string>>(
    readSelectedSpeciesSession
  );

  const [satellite, setSatellite] = useState(false);
  const [showLinesAndArrows, setShowLinesAndArrows] = useState(true);
  const [showVicinityLayer, setShowVicinityLayer] = useState(false);
  const [showBoundaryConnectors, setShowBoundaryConnectors] = useState(false);
  const [includeOutliers, setIncludeOutliers] = useState(false);
  const [movements, setMovements] = useState<HatcheryWeeklyMovement[]>([]);
  const [enabledTracks, setEnabledTracks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingSpeciesCodes, setLoadingSpeciesCodes] = useState<string[]>([]);
  const [movementError, setMovementError] = useState<string | null>(null);

  const [playbackDay, setPlaybackDay] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasPlayedPath, setHasPlayedPath] = useState(false);
  const playbackDayRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const lastPlaybackRenderRef = useRef<number | null>(null);

  const filteredHatcheries = selectedRegion
    ? hatcheries.filter(h => h.region === selectedRegion)
    : hatcheries;
  const selectedHatcheryData = hatcheries.find(h => h.name === selectedHatchery);
  const yearsKey = sortedYearsKey(selectedYears);
  const selectedSpeciesKey = selectedSpeciesSetKey(selectedSpecies);
  const selectedMovementTracks = movements.filter(m => selectedSpecies.has(speciesCodeForMovement(m)));
  const loadedMovements = selectedMovementTracks.filter(m => enabledTracks.has(m.year));
  const timeline = movementTimelineBounds(loadedMovements);
  const playbackStartDay = timeline.start;
  const playbackEndDay = timeline.end;
  const hasPlaybackTimeline = loadedMovements.length > 0 && playbackEndDay > playbackStartDay;
  const displayDay = hasPlaybackTimeline
    ? clampPlaybackDay(playbackDay, playbackStartDay, playbackEndDay)
    : playbackDay;
  const hasRecordedReturn = loadedMovements.some(movement => movement.weeklyPositions.some(position => position.isReturn));
  const playbackProgress = hasPlaybackTimeline
    ? ((displayDay - playbackStartDay) / Math.max(1, playbackEndDay - playbackStartDay)) * 100
    : 0;
  const playbackLabel = playbackTimelineLabel(displayDay, playbackStartDay, playbackEndDay, hasRecordedReturn);
  const sliderTicks = hasPlaybackTimeline ? playbackSliderTicks(playbackStartDay, playbackEndDay) : [];
  const sliderTickIndex = nearestPlaybackTickIndex(sliderTicks, displayDay);
  const loadingSpeciesLabel = MOVEMENT_SPECIES_OPTIONS
    .filter(sp => (loadingSpeciesCodes.length > 0 ? loadingSpeciesCodes : Array.from(selectedSpecies)).includes(sp.code))
    .map(sp => sp.name)
    .join(', ') || 'Selected species';
  const routeConfidence = routeConfidenceSummary(loadedMovements, includeOutliers);

  const canLoad = Boolean(selectedHatchery) && selectedYears.size > 0 && selectedSpecies.size > 0 && !loading;

  function stopAnimationFrame() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function resetPlaybackForTracks(tracks: HatcheryWeeklyMovement[], shouldPlay: boolean) {
    stopAnimationFrame();
    const bounds = movementTimelineBounds(tracks);
    lastTimeRef.current = null;
    lastPlaybackRenderRef.current = null;
    playbackDayRef.current = bounds.start;
    setPlaybackDay(bounds.start);
    setHasPlayedPath(false);
    setIsAnimating(shouldPlay && bounds.end > bounds.start);
  }

  function replayPath() {
    if (playbackEndDay <= playbackStartDay || loadedMovements.length === 0) return;
    resetPlaybackForTracks(loadedMovements, true);
  }

  function skipAnimation() {
    if (playbackEndDay <= playbackStartDay || loadedMovements.length === 0) return;
    stopAnimationFrame();
    lastTimeRef.current = null;
    lastPlaybackRenderRef.current = null;
    playbackDayRef.current = playbackEndDay;
    setPlaybackDay(playbackEndDay);
    setIsAnimating(false);
    setHasPlayedPath(true);
  }

  function scrubPlayback(day: number) {
    if (playbackEndDay <= playbackStartDay || loadedMovements.length === 0) return;
    const nextDay = clampPlaybackDay(day, playbackStartDay, playbackEndDay);
    stopAnimationFrame();
    lastTimeRef.current = null;
    lastPlaybackRenderRef.current = null;
    playbackDayRef.current = nextDay;
    setPlaybackDay(nextDay);
    setIsAnimating(false);
    setHasPlayedPath(nextDay >= playbackEndDay - 0.5);
  }

  async function loadMovements() {
    if (!canLoad) return;

    const selectedCodes = Array.from(selectedSpecies);
    const missingSpeciesCodes = selectedCodes.filter(code => (
      !hasLoadedMovementCache(movementCacheKey(selectedHatchery, yearsKey, code, includeOutliers))
    ));

    setMovementError(null);
    setPlaybackDay(0);
    lastPlaybackRenderRef.current = null;
    playbackDayRef.current = 0;

    try {
      let emptyMessage = 'No matching Official Sources recovery records found for this selection.';

      if (missingSpeciesCodes.length > 0) {
        setLoadingSpeciesCodes(missingSpeciesCodes);
        setLoading(true);
        const result = await buildWeeklyMovementData(selectedHatchery, {
          recoveryYears: Array.from(selectedYears),
          speciesCodes: missingSpeciesCodes,
          aggregateSelectedYears: true,
          includeOutliers,
        });

        const returnedBySpecies = new Map(result.movements.map(movement => [speciesCodeForMovement(movement), movement]));
        for (const code of missingSpeciesCodes) {
          writeMovementCache(
            movementCacheKey(selectedHatchery, yearsKey, code, includeOutliers),
            returnedBySpecies.get(code) ?? null
          );
        }
        emptyMessage = result.diagnostic?.message ?? emptyMessage;
      }

      const nextMovements = cachedMovementsForScope(selectedHatchery, yearsKey, includeOutliers);
      const nextSelectedMovements = nextMovements.filter(m => selectedSpecies.has(speciesCodeForMovement(m)));
      setMovements(nextMovements);
      setEnabledTracks(prev => {
        const next = new Set(prev);
        for (const movement of nextSelectedMovements) next.add(movement.year);
        return next;
      });
      if (nextSelectedMovements.length === 0) setMovementError(emptyMessage);
      resetPlaybackForTracks(nextSelectedMovements, nextSelectedMovements.length > 0);
    } catch {
      setMovementError('Failed to load movement data for this selection.');
      resetPlaybackForTracks([], false);
    } finally {
      setLoading(false);
      setLoadingSpeciesCodes([]);
    }
  }

  useEffect(() => {
    const cached = selectedHatchery ? cachedMovementsForScope(selectedHatchery, yearsKey, includeOutliers) : [];
    const cachedSelectedMovements = cached.filter(m => selectedSpecies.has(speciesCodeForMovement(m)));
    setMovements(cached);
    setEnabledTracks(prev => {
      const selectedTrackIds = new Set(cachedSelectedMovements.map(m => m.year));
      const next = new Set<number>();
      for (const trackId of prev) {
        if (selectedTrackIds.has(trackId)) next.add(trackId);
      }
      if (next.size === 0) {
        for (const trackId of selectedTrackIds) next.add(trackId);
      }
      return next;
    });
    setMovementError(null);
    resetPlaybackForTracks(cachedSelectedMovements, cachedSelectedMovements.length > 0);
  }, [selectedHatchery, yearsKey, includeOutliers, selectedSpeciesKey]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        SELECTED_SPECIES_SESSION_KEY,
        JSON.stringify(Array.from(selectedSpecies))
      );
    } catch {
      // Session persistence is a convenience; controls still work if storage is blocked.
    }
  }, [selectedSpecies, selectedSpeciesKey]);

  const animate = useCallback((timestamp: number) => {
    if (playbackEndDay <= playbackStartDay) return;
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const delta = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    let next = playbackDayRef.current + delta / ANIMATION_SECONDS_PER_DAY;
    if (next >= playbackEndDay) {
      next = playbackEndDay;
      playbackDayRef.current = next;
      setPlaybackDay(next);
      setIsAnimating(false);
      setHasPlayedPath(true);
      rafRef.current = null;
      lastTimeRef.current = null;
      lastPlaybackRenderRef.current = null;
      return;
    }
    playbackDayRef.current = next;
    if (
      lastPlaybackRenderRef.current === null ||
      timestamp - lastPlaybackRenderRef.current >= PLAYBACK_RENDER_INTERVAL_MS
    ) {
      lastPlaybackRenderRef.current = timestamp;
      setPlaybackDay(next);
    }
    rafRef.current = requestAnimationFrame(animate);
  }, [playbackEndDay, playbackStartDay]);

  useEffect(() => {
    stopAnimationFrame();
    if (!isAnimating || !selectedHatchery || playbackEndDay <= playbackStartDay || loadedMovements.length === 0) return;
    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(animate);
    return stopAnimationFrame;
  }, [animate, isAnimating, selectedHatchery, playbackEndDay, playbackStartDay, loadedMovements.length]);

  useEffect(() => {
    if (loadedMovements.length > 0 && playbackEndDay > playbackStartDay) return;
    stopAnimationFrame();
    setIsAnimating(false);
  }, [loadedMovements.length, playbackEndDay, playbackStartDay]);

  function toggleYear(year: number) {
    setSelectedYears(prev => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  }

  function toggleSpecies(code: string) {
    setSelectedSpecies(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
    setMovementError(null);
  }

  function toggleTrack(trackId: number) {
    setEnabledTracks(prev => {
      const next = new Set(prev);
      next.has(trackId) ? next.delete(trackId) : next.add(trackId);
      return next;
    });
  }

  return (
    <div className="movements-page">
      <aside className="movements-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Fish Movements</h2>
          <span className="mv-beta-badge">(BETA)</span>
          <p className="sidebar-subtitle">Average salmon movement paths</p>
        </div>

        <div className="sidebar-section mv-selector-section">
          <div className="mv-selector-field">
            <label className="sidebar-label" htmlFor="mv-region">Region</label>
            <select
              id="mv-region"
              className="sidebar-select"
              value={selectedRegion}
              onChange={e => {
                setSelectedRegion(e.target.value);
                setSelectedHatchery('');
              }}
            >
              <option value="">All Regions</option>
              {regions.map(region => <option key={region} value={region}>{region}</option>)}
            </select>
          </div>
          <div className="mv-selector-field">
            <label className="sidebar-label" htmlFor="mv-hatchery">Hatchery</label>
            <select
              id="mv-hatchery"
              className="sidebar-select"
              value={selectedHatchery}
              onChange={e => setSelectedHatchery(e.target.value)}
            >
              <option value="">Select a hatchery...</option>
              {filteredHatcheries.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
            </select>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Species</div>
          <div className="mv-species-list">
            {MOVEMENT_SPECIES_OPTIONS.map(sp => (
              <label key={sp.code} className="mv-species-row">
                <input
                  type="checkbox"
                  checked={selectedSpecies.has(sp.code)}
                  onChange={() => toggleSpecies(sp.code)}
                  aria-label={sp.name}
                />
                <span className="mv-species-dot" style={{ background: yearColor(3000 + Number(sp.code)) }} />
                <span className="mv-species-label">{sp.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">
            Recovery Years ({selectedYears.size} selected)
          </div>
          <div className="year-toggle-actions">
            <button className="year-action-btn" onClick={() => setSelectedYears(new Set(allYears))}>All</button>
            <button className="year-action-btn" onClick={() => setSelectedYears(new Set())}>None</button>
            <button className="year-action-btn" onClick={() => setSelectedYears(new Set(parityYears(allYears, 'even')))}>Even Years</button>
            <button className="year-action-btn" onClick={() => setSelectedYears(new Set(parityYears(allYears, 'odd')))}>Odd Years</button>
          </div>
          <div className="year-checkbox-list">
            {allYears.slice().reverse().map(yr => (
              <label key={yr} className="year-checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedYears.has(yr)}
                  onChange={() => toggleYear(yr)}
                  aria-label={`Recovery year ${yr}`}
                />
                <span
                  className="year-checkbox-dot"
                  style={{ background: selectedYears.has(yr) ? yearColor(yr) : 'rgba(255,255,255,0.15)' }}
                />
                <span className="year-checkbox-label">{yr}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="sidebar-section mv-load-section">
          <div className="mv-load-row">
            <button className="year-action-btn mv-load-btn mv-load-primary" onClick={loadMovements} disabled={!canLoad}>
              Load Movement
            </button>
            <label
              className={`mv-lines-toggle mv-outlier-toggle${includeOutliers ? ' active' : ''}`}
              title={WEEKLY_OUTLIER_TOOLTIP}
            >
              <input
                type="checkbox"
                checked={includeOutliers}
                onChange={() => {
                  setIncludeOutliers(value => !value);
                  setMovementError(null);
                }}
                aria-label={WEEKLY_OUTLIER_TOOLTIP}
              />
              <span>Include Outliers</span>
            </label>
          </div>
        </div>

        {loadedMovements.length > 0 && (
          <div className="sidebar-section mv-controls-section">
            <div className="mv-playback-actions mv-control-row">
              <button
                className="year-action-btn mv-control-btn"
                onClick={replayPath}
                disabled={playbackEndDay <= playbackStartDay}
                title={hasPlayedPath ? 'Replay the movement path' : 'Path plays automatically after loading'}
              >
                Replay Path
              </button>
            </div>
            <div className="mv-playback-actions mv-control-row">
              <button
                className="year-action-btn mv-control-btn"
                onClick={skipAnimation}
                disabled={!isAnimating || playbackEndDay <= playbackStartDay}
                title="Skip to the completed movement path"
              >
                Skip Animation
              </button>
            </div>
            <div className="mv-display-toggles mv-display-toggles-pair">
              <div className="mv-toggle-block">
                <label className="mv-lines-toggle" title="Show directional lines and arrows between average movement points.">
                  <input
                    type="checkbox"
                    checked={showLinesAndArrows}
                    onChange={() => setShowLinesAndArrows(value => !value)}
                    aria-label="Show directional lines and arrows between average movement points"
                  />
                  <span>Lines & arrows</span>
                </label>
              </div>
              <div className="mv-toggle-block">
                <label className="mv-lines-toggle" title="Show likely vicinity areas around averaged catch points.">
                  <input
                    type="checkbox"
                    checked={showVicinityLayer}
                    onChange={() => setShowVicinityLayer(value => !value)}
                    aria-label="Show likely vicinity areas around averaged catch points"
                  />
                  <span>Vicinity</span>
                </label>
              </div>
            </div>
            <div className="mv-display-toggles mv-display-toggles-footer">
              <div className="mv-toggle-block">
                <label className="mv-lines-toggle" title="Show dotted connections to catch points outside district boundaries.">
                  <input
                    type="checkbox"
                    checked={showBoundaryConnectors}
                    onChange={() => setShowBoundaryConnectors(value => !value)}
                    aria-label="Show dotted connections to catch points outside district boundaries"
                  />
                  <span>Outside links</span>
                </label>
              </div>
              <div className="mv-data-range-pill" title="Official recovery data range">
                <span>Data Range</span>
                <strong>{YEAR_RANGE_START} - Present</strong>
              </div>
            </div>
          </div>
        )}

        {routeConfidence && (
          <div className="sidebar-section mv-confidence-section">
            {routeConfidence.lowOfficialData && (
              <div className="mv-low-data-warning">Low Amount of Official Data Available</div>
            )}
            {includeOutliers && (
              <div className="mv-outlier-confidence-warning">Outliers selected; can result in reduced route accuracy.</div>
            )}
            <div className="mv-confidence-heading">
              <span>Hatchery Route Confidence</span>
              <strong className={`mv-confidence-value ${confidenceTone(routeConfidence.percentage)}`}>
                {routeConfidence.percentage}%
              </strong>
            </div>
            <div className="mv-confidence-meter" aria-label={`Hatchery route confidence ${routeConfidence.percentage}%`}>
              <span
                className={`mv-confidence-fill ${confidenceTone(routeConfidence.percentage)}`}
                style={{ width: `${routeConfidence.percentage}%` }}
              />
            </div>
            <div className="mv-confidence-stats">
              <span>{formatFishCount(routeConfidence.trackedFish)} tracked fish</span>
              <span>{formatFishCount(routeConfidence.returnedFish)} tracked fish returned</span>
              <span>{routeConfidence.activeDayCount.toLocaleString()} active days</span>
              <span>{routeConfidence.averageGapDays}d avg gap</span>
            </div>
          </div>
        )}

        {selectedMovementTracks.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-label">Loaded Tracks</div>
            <div className="mv-species-list">
              {selectedMovementTracks.map(mv => (
                <label key={mv.year} className="mv-species-row">
                  <input
                    type="checkbox"
                    checked={enabledTracks.has(mv.year)}
                    onChange={() => toggleTrack(mv.year)}
                    aria-label={mv.label ?? String(mv.year)}
                  />
                  <span className="mv-species-dot" style={{ background: yearColor(mv.year) }} />
                  <span className="mv-species-label">{mv.label ?? mv.year}</span>
                  <span className="year-checkbox-count">{formatFishCount(mv.totalCatch)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {!loading && movementError && (
          <div className="sidebar-section">
            <div className="sidebar-info-notice">{movementError}</div>
          </div>
        )}
      </aside>

      <div className="movements-map-area" style={{ position: 'relative' }}>
        <button
          className={`mv-satellite-btn${satellite ? ' active' : ''}`}
          onClick={() => setSatellite(s => !s)}
          title={satellite ? 'Switch to two-tone map' : 'Switch to satellite'}
          aria-label="Toggle satellite view"
        >
          {satellite ? 'Two-Tone' : 'Satellite'}
        </button>

        {selectedHatchery ? (
          <MapContainer center={[60, -153]} zoom={5} className="movements-map" zoomControl={true}>
            <TileLayer
              key={satellite ? 'sat' : 'dark'}
              url={tileUrl(satellite)}
              attribution={tileAttribution(satellite)}
            />
            {selectedHatcheryData?.region === 'Prince William Sound' && (
              <PwsBoundaryPreloader region={selectedHatcheryData.region} />
            )}
            {selectedHatcheryData && (
              <HatcheryMarker
                lat={selectedHatcheryData.lat}
                lng={selectedHatcheryData.lng}
                name={selectedHatcheryData.name}
              />
            )}
            {loadedMovements.length > 0 && enabledTracks.size > 0 && (
              <>
                <MovementBoundsController movements={loadedMovements} enabledYears={enabledTracks} />
                <StaticPathLayer
                  movements={loadedMovements}
                  enabledYears={enabledTracks}
                  hoveredYear={null}
                  currentDay={displayDay}
                  showLinesAndArrows={showLinesAndArrows}
                  showVicinityLayer={showVicinityLayer}
                  showBoundaryConnectors={showBoundaryConnectors}
                  boundaryRegion={selectedHatcheryData?.region}
                />
                {isAnimating && (
                  <AnimatedFishLayer
                    movements={loadedMovements}
                    enabledYears={enabledTracks}
                    hoveredYear={null}
                    currentDay={playbackDay}
                    showBoundaryConnectors={showBoundaryConnectors}
                    boundaryRegion={selectedHatcheryData?.region}
                  />
                )}
              </>
            )}
          </MapContainer>
        ) : (
          <div className="movements-empty-state">
            <div className="empty-state-icon">DATA</div>
            <h3>Select a Hatchery</h3>
            <p>Choose a region, hatchery, recovery years, and species before loading movement data.</p>
          </div>
        )}

        {selectedHatchery && !loading && selectedMovementTracks.length === 0 && !movementError && (
          <div className="movements-empty-state">
            <div className="empty-state-icon">DATA</div>
            <h3>Ready to Load</h3>
            <p>Click Load Movement to fetch Official Sources recovery records for the selected years and species.</p>
          </div>
        )}

        {hasPlaybackTimeline && (
          <div className="mv-bottom-timeline" aria-label="Movement timeline controls">
            <div className="mv-timeline-topline">
              <span>{playbackLabel}</span>
              <strong>{Math.round(playbackProgress)}%</strong>
            </div>
            <input
              className="mv-timeline-slider"
              type="range"
              min={0}
              max={Math.max(0, sliderTicks.length - 1)}
              step={1}
              value={sliderTickIndex}
              onChange={event => scrubPlayback(sliderTicks[Number(event.target.value)] ?? playbackEndDay)}
              aria-label="Movement playback week"
            />
            <div className="mv-timeline-range">
              <span>Average First Catch</span>
              <span>{hasRecordedReturn ? 'Return to Hatchery' : 'Latest Catch Week'}</span>
            </div>
          </div>
        )}

        <div className={`mv-loading-overlay${loading ? ' active' : ''}`} aria-hidden={!loading}>
          <div className="mv-loading-card" aria-live="polite">
            <div className="mv-loading-spinner" />
            <div>
              <h3>Building Movement Path</h3>
              <p>{selectedHatchery || 'Selected hatchery'}</p>
              <p className="mv-loading-species">{loadingSpeciesLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
