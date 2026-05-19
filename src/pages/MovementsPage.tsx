/**
 * MovementsPage — production-grade realtime fish movement intelligence system.
 *
 * Architecture:
 *  - PlaybackManager drives all animation via RAF (no React state on every frame)
 *  - Leaflet layers updated imperatively via useRef — zero map rerenders
 *  - FixMapResize eliminates all black-map scenarios
 *  - All API calls go through the backend proxy (RMIS key never in browser)
 *  - Stale-while-revalidate caching for resilience
 *  - Full cleanup on unmount (RAF, intervals, Leaflet layers, observers)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  allDisplayYears,
  buildWeeklyOceanRecoveryData,
  fetchOceanRecoveriesForWeek,
  YEAR_RANGE_START,
  YEAR_RANGE_END,
  type HatcheryWeeklyMovement,
  type DateViewPosition,
} from '../services/movementDataService';

import {
  PlaybackManager,
  normaliseTrack,
  type RawMovementPoint,
  type PlaybackState,
  type TrackState,
} from '../engine/MovementEngine';

import {
  StaticPathLayer,
  AnimatedFishLayer,
  DateViewLayer,
  LiveStatsOverlay,
  PlaybackControls,
  WeekTimeline,
  tileUrl,
  tileAttribution,
  SatelliteToggle,
  yearColor,
} from '../components/MapView';

import { FixMapResize } from '../components/FixMapResize';
import '../styles/movements-page.css';
import '../styles/movements-intelligence.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENT_YEAR_COUNT = 5;
const LIVE_POLL_INTERVAL_MS = 60_000;
const SPECIES_COLORS: Record<string, string> = {
  '1': '#FFD700',
  '2': '#C0C0C0',
  '4': '#E53935',
  '5': '#FF69B4',
  '6': '#8B4513',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recentYears(years: number[], count = RECENT_YEAR_COUNT): number[] {
  return years.slice(Math.max(0, years.length - count));
}

function speciesLabel(code: string): string {
  const map: Record<string, string> = {
    '1': 'King (Chinook)',
    '2': 'Silver (Coho)',
    '4': 'Red (Sockeye)',
    '5': 'Pink (Humpy)',
    '6': 'Chum (Dog)',
  };
  return map[code] ?? `Species ${code}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SidebarStatProps {
  label: string;
  value: string | number;
  accent?: string;
  pulse?: boolean;
}

function SidebarStat({ label, value, accent = '#00bfff', pulse = false }: SidebarStatProps) {
  return (
    <div className="mv-intel-stat">
      <div className="mv-intel-stat-label">{label}</div>
      <div
        className={`mv-intel-stat-value${pulse ? ' mv-pulse' : ''}`}
        style={{ color: accent }}
      >
        {value}
      </div>
    </div>
  );
}

interface SpeciesRowProps {
  code: string;
  count: number;
  total: number;
  active: boolean;
  onToggle: () => void;
}

function SpeciesRow({ code, count, total, active, onToggle }: SpeciesRowProps) {
  const color = SPECIES_COLORS[code] ?? '#00bfff';
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <button
      className={`mv-species-intel-row${active ? ' active' : ''}`}
      onClick={onToggle}
      style={{ '--species-color': color } as CSSProperties}
      aria-pressed={active}
    >
      <span className="mv-species-intel-dot" style={{ background: color }} />
      <span className="mv-species-intel-name">{speciesLabel(code)}</span>
      <span className="mv-species-intel-bar-wrap">
        <span className="mv-species-intel-bar" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="mv-species-intel-count">{count.toLocaleString()}</span>
    </button>
  );
}

// ─── Animated marker layer (imperative Leaflet, no React rerenders) ───────────

interface AnimatedMarkerLayerProps {
  trackStates: Map<string, TrackState>;
  movements: HatcheryWeeklyMovement[];
  enabledYears: Set<number>;
}

function AnimatedMarkerLayer({ trackStates, movements, enabledYears }: AnimatedMarkerLayerProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map);
    }
    return () => {
      layerRef.current?.clearLayers();
      layerRef.current?.remove();
      layerRef.current = null;
      markersRef.current.clear();
    };
  }, [map]);

  useEffect(() => {
    if (!layerRef.current) return;

    const activeIds = new Set(trackStates.keys());

    // Remove stale markers
    for (const [id, marker] of markersRef.current) {
      if (!activeIds.has(id)) {
        layerRef.current.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    // Update or create markers
    for (const [id, state] of trackStates) {
      const mv = movements.find(m => String(m.year) === id);
      if (!mv || !enabledYears.has(mv.year)) continue;

      const color = yearColor(mv.year);
      const bearing = state.bearing;

      const html = `
        <div class="mv-fish-marker" style="--fish-color:${color};transform:rotate(${bearing}deg)">
          <div class="mv-fish-pulse" style="background:${color}"></div>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="position:relative;z-index:1">
            <path d="M9 2 L16 9 L9 16 L2 9 Z" fill="${color}" opacity="0.9"/>
            <path d="M9 4 L14 9 L9 14 L4 9 Z" fill="white" opacity="0.3"/>
          </svg>
        </div>`;

      const icon = L.divIcon({
        className: '',
        html,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const existing = markersRef.current.get(id);
      if (existing) {
        existing.setLatLng([state.lat, state.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([state.lat, state.lng], { icon, zIndexOffset: 1000 });
        const mv2 = movements.find(m => String(m.year) === id);
        if (mv2) {
          marker.bindTooltip(
            `<div class="mv-tooltip-inner">
              <strong style="color:${color}">${mv2.label ?? mv2.year}</strong><br/>
              ${mv2.hatcheryName}<br/>
              <span style="opacity:0.7">${state.speed.toFixed(1)} km/day · ${state.bearing.toFixed(0)}°</span>
            </div>`,
            { className: 'mv-leaflet-tooltip', sticky: true },
          );
        }
        layerRef.current?.addLayer(marker);
        markersRef.current.set(id, marker);
      }
    }
  }, [trackStates, movements, enabledYears, map]);

  return null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabMode = 'animation' | 'date';

export function MovementsPage() {
  const displayYears = useMemo(() => allDisplayYears(), []);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabMode>('animation');
  const [satellite, setSatellite] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Data state ────────────────────────────────────────────────────────────
  const [movements, setMovements] = useState<HatcheryWeeklyMovement[]>([]);
  const [enabledYears, setEnabledYears] = useState<Set<number>>(
    () => new Set(recentYears(allDisplayYears())),
  );
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Date-view state ───────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [datePositions, setDatePositions] = useState<DateViewPosition[]>([]);
  const [dateLoading, setDateLoading] = useState(false);

  // ── Playback state (driven by PlaybackManager, not RAF directly) ──────────
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    day: 0,
    isPlaying: false,
    speed: 1,
    isLive: false,
    startDay: 0,
    endDay: 367,
  });
  const [trackStates, setTrackStates] = useState<Map<string, TrackState>>(new Map());

  // ── Refs ──────────────────────────────────────────────────────────────────
  const managerRef = useRef<PlaybackManager | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const loadedMovements = useMemo(
    () => movements.filter(m => enabledYears.has(m.year)),
    [movements, enabledYears],
  );

  const maxFrames = useMemo(
    () =>
      loadedMovements.length > 0
        ? Math.max(...loadedMovements.map(m => m.weeklyPositions.length - 1), 0)
        : 0,
    [loadedMovements],
  );

  const currentFrame = Math.floor(playbackState.day);

  const currentWeekLabel = useMemo(() => {
    for (const mv of loadedMovements) {
      const pos = mv.weeklyPositions[Math.min(currentFrame, mv.weeklyPositions.length - 1)];
      if (pos) return pos.weekLabel;
    }
    return '';
  }, [loadedMovements, currentFrame]);

  const speciesCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const mv of loadedMovements) {
      const code = mv.species ?? '1';
      map.set(code, (map.get(code) ?? 0) + mv.totalCatch);
    }
    return map;
  }, [loadedMovements]);

  const totalCatch = useMemo(
    () => Array.from(speciesCounts.values()).reduce((a, b) => a + b, 0),
    [speciesCounts],
  );

  // ── PlaybackManager lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    const manager = new PlaybackManager(0, 367);
    managerRef.current = manager;

    const unsubPlayback = manager.onPlayback(state => setPlaybackState({ ...state }));
    const unsubTracks = manager.onTracks(states => setTrackStates(new Map(states)));

    return () => {
      unsubPlayback();
      unsubTracks();
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  // ── Sync tracks into PlaybackManager when movements change ───────────────
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    const trackMap = new Map<string, RawMovementPoint[]>();
    for (const mv of loadedMovements) {
      const normalised = normaliseTrack(mv.weeklyPositions);
      if (normalised.length > 0) {
        trackMap.set(String(mv.year), normalised);
      }
    }

    if (trackMap.size > 0) {
      const allDays = Array.from(trackMap.values()).flat();
      const startDay = Math.min(...allDays.map(p => p.day));
      const endDay = Math.max(...allDays.map(p => p.day));
      manager.updateBounds(startDay, endDay);
      manager.setTracks(trackMap);
    } else {
      manager.setTracks(new Map());
    }
  }, [loadedMovements]);

  // ── Load animation data ───────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'animation') return;

    const yearsToLoad = Array.from(enabledYears).sort((a, b) => a - b);
    let cancelled = false;

    if (yearsToLoad.length === 0) {
      setMovements([]);
      setError('Select at least one recovery year.');
      return;
    }

    setMovements([]);
    setError(null);
    setLoading(true);
    managerRef.current?.pause();

    buildWeeklyOceanRecoveryData(yearsToLoad)
      .then(result => {
        if (cancelled) return;
        setMovements(result.movements);
        if (result.movements.length === 0) {
          setError(result.diagnostic?.message ?? 'No ocean recovery records found.');
        } else {
          // Auto-play after load
          setTimeout(() => {
            if (!cancelled) managerRef.current?.play();
          }, 400);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load ocean recovery records. Check backend connection.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [enabledYears, tab]);

  // ── Date-view data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDate || tab !== 'date') return;
    let cancelled = false;
    setDateLoading(true);
    setDatePositions([]);

    fetchOceanRecoveriesForWeek(new Date(`${selectedDate}T12:00:00`))
      .then(positions => { if (!cancelled) setDatePositions(positions); })
      .finally(() => { if (!cancelled) setDateLoading(false); });

    return () => { cancelled = true; };
  }, [selectedDate, tab]);

  // ── Live polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'animation' || !playbackState.isLive) return;

    pollTimerRef.current = setInterval(() => {
      const yearsToLoad = Array.from(enabledYears).sort((a, b) => a - b);
      if (yearsToLoad.length === 0) return;
      buildWeeklyOceanRecoveryData(yearsToLoad)
        .then(result => {
          if (result.movements.length > 0) setMovements(result.movements);
        })
        .catch(() => { /* silent — keep showing last good data */ });
    }, LIVE_POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [tab, playbackState.isLive, enabledYears]);

  // ── Playback controls ─────────────────────────────────────────────────────
  const handleTogglePlay = useCallback(() => {
    managerRef.current?.togglePlay();
  }, []);

  const handleReset = useCallback(() => {
    managerRef.current?.reset();
  }, []);

  const handleScrub = useCallback((frame: number) => {
    managerRef.current?.scrub(frame);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    managerRef.current?.setSpeed(speed);
  }, []);

  // ── Year toggles ──────────────────────────────────────────────────────────
  function toggleYear(year: number) {
    setEnabledYears(prev => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mv-intel-page">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`mv-intel-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="mv-intel-sidebar-header">
          <div className="mv-intel-brand">
            <div className="mv-intel-brand-dot" />
            <span className="mv-intel-brand-title">Movement Intelligence</span>
          </div>
          <button
            className="mv-intel-collapse-btn"
            onClick={() => setSidebarCollapsed(s => !s)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* Tab switcher */}
            <div className="mv-intel-tabs">
              <button
                className={`mv-intel-tab${tab === 'animation' ? ' active' : ''}`}
                onClick={() => setTab('animation')}
              >
                <span className="mv-intel-tab-icon">◎</span> Animation
              </button>
              <button
                className={`mv-intel-tab${tab === 'date' ? ' active' : ''}`}
                onClick={() => setTab('date')}
              >
                <span className="mv-intel-tab-icon">◈</span> Week View
              </button>
            </div>

            {/* Live stats */}
            {tab === 'animation' && loadedMovements.length > 0 && (
              <div className="mv-intel-stats-grid">
                <SidebarStat
                  label="Active Tracks"
                  value={loadedMovements.length}
                  accent="#00bfff"
                  pulse
                />
                <SidebarStat
                  label="Total Catch"
                  value={totalCatch.toLocaleString()}
                  accent="#4ECDC4"
                />
                <SidebarStat
                  label="Years Loaded"
                  value={enabledYears.size}
                  accent="#FFD700"
                />
                <SidebarStat
                  label="Week"
                  value={currentWeekLabel || '—'}
                  accent="#C0C0C0"
                />
              </div>
            )}

            {/* Species distribution */}
            {tab === 'animation' && speciesCounts.size > 0 && (
              <div className="mv-intel-section">
                <div className="mv-intel-section-title">Species Distribution</div>
                <div className="mv-intel-species-list">
                  {Array.from(speciesCounts.entries()).map(([code, count]) => (
                    <SpeciesRow
                      key={code}
                      code={code}
                      count={count}
                      total={totalCatch}
                      active
                      onToggle={() => { /* species filtering handled by year selection */ }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Year selector */}
            {tab === 'animation' && (
              <div className="mv-intel-section">
                <div className="mv-intel-section-title">
                  Recovery Years
                  <span className="mv-intel-section-badge">{enabledYears.size}</span>
                </div>
                <div className="mv-intel-year-actions">
                  <button className="mv-intel-year-action-btn" onClick={() => setEnabledYears(new Set(displayYears))}>All</button>
                  <button className="mv-intel-year-action-btn" onClick={() => setEnabledYears(new Set())}>None</button>
                  <button className="mv-intel-year-action-btn" onClick={() => setEnabledYears(new Set(recentYears(displayYears, 5)))}>5 Yr</button>
                  <button className="mv-intel-year-action-btn" onClick={() => setEnabledYears(new Set(recentYears(displayYears, 10)))}>10 Yr</button>
                </div>
                <div className="mv-intel-year-grid">
                  {displayYears.slice().reverse().map(year => {
                    const hasData = movements.some(m => m.year === year);
                    return (
                      <button
                        key={year}
                        className={`mv-intel-year-btn${enabledYears.has(year) ? ' active' : ''}${hasData ? ' has-data' : ''}`}
                        style={{ '--year-color': yearColor(year) } as CSSProperties}
                        onClick={() => toggleYear(year)}
                        onMouseEnter={() => setHoveredYear(year)}
                        onMouseLeave={() => setHoveredYear(null)}
                        title={`${year}${hasData ? ' — data loaded' : ''}`}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Date picker */}
            {tab === 'date' && (
              <div className="mv-intel-section">
                <div className="mv-intel-section-title">Select Date</div>
                <input
                  type="date"
                  className="mv-intel-date-input"
                  value={selectedDate}
                  min={`${YEAR_RANGE_START}-01-01`}
                  max={`${YEAR_RANGE_END}-12-31`}
                  onChange={e => setSelectedDate(e.target.value)}
                />
                {dateLoading && (
                  <div className="mv-intel-loading-inline">
                    <span className="mv-intel-spinner-sm" /> Fetching catch data...
                  </div>
                )}
                {!dateLoading && datePositions.length > 0 && (
                  <div className="mv-intel-stats-grid" style={{ marginTop: '0.75rem' }}>
                    <SidebarStat label="Catch Sites" value={datePositions.length} />
                    <SidebarStat
                      label="Total Fish"
                      value={datePositions.reduce((s, p) => s + p.catchCount, 0).toLocaleString()}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Data range */}
            <div className="mv-intel-section mv-intel-section-footer">
              <div className="mv-intel-data-range">
                <span>Data Range</span>
                <strong>{YEAR_RANGE_START} – {YEAR_RANGE_END}</strong>
              </div>
              <div className="mv-intel-source-badge">RMIS Official Data</div>
            </div>

            {/* Loading / error */}
            {loading && (
              <div className="mv-intel-loading-bar">
                <div className="mv-intel-loading-bar-fill" />
              </div>
            )}
            {error && (
              <div className="mv-intel-error">{error}</div>
            )}
          </>
        )}
      </aside>

      {/* ── Map area ─────────────────────────────────────────────────────── */}
      <div className="mv-intel-map-area">
        <MapContainer
          center={[60, -153]}
          zoom={5}
          className="mv-intel-map"
          zoomControl
          preferCanvas
        >
          <FixMapResize visible={true} delay={150} />

          <TileLayer
            key={satellite ? 'sat' : 'dark'}
            url={tileUrl(satellite)}
            attribution={tileAttribution(satellite)}
            errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          />

          {tab === 'animation' && loadedMovements.length > 0 && (
            <>
              <StaticPathLayer
                movements={loadedMovements}
                enabledYears={enabledYears}
                hoveredYear={hoveredYear}
                currentFrame={maxFrames}
              />
              <AnimatedFishLayer
                movements={loadedMovements}
                enabledYears={enabledYears}
                hoveredYear={hoveredYear}
                fractionalFrame={playbackState.day}
              />
              <AnimatedMarkerLayer
                trackStates={trackStates}
                movements={loadedMovements}
                enabledYears={enabledYears}
              />
            </>
          )}

          {tab === 'date' && datePositions.length > 0 && (
            <DateViewLayer
              positions={datePositions}
              hatcheryLat={60}
              hatcheryLng={-153}
              hatcheryName=""
            />
          )}
        </MapContainer>

        {/* Satellite toggle */}
        <SatelliteToggle satellite={satellite} onToggle={() => setSatellite(s => !s)} />

        {/* Live stats overlay */}
        {tab === 'animation' && loadedMovements.length > 0 && (
          <LiveStatsOverlay
            movements={loadedMovements}
            enabledYears={enabledYears}
            currentFrame={currentFrame}
            currentWeekLabel={currentWeekLabel}
          />
        )}

        {/* Playback controls */}
        {tab === 'animation' && loadedMovements.length > 0 && (
          <>
            <PlaybackControls
              isPlaying={playbackState.isPlaying}
              onTogglePlay={handleTogglePlay}
              onReset={handleReset}
              fractionalFrame={playbackState.day}
              maxFrames={maxFrames}
              speed={playbackState.speed}
              onSpeedChange={handleSpeedChange}
              onScrub={handleScrub}
              currentWeekLabel={currentWeekLabel}
            />
            <WeekTimeline
              movements={loadedMovements}
              enabledYears={enabledYears}
              currentFrame={currentFrame}
              maxFrames={maxFrames}
              onSeek={handleScrub}
            />
          </>
        )}

        {/* Empty states */}
        {tab === 'animation' && !loading && loadedMovements.length === 0 && (
          <div className="mv-intel-empty">
            <div className="mv-intel-empty-radar">
              <div className="mv-intel-radar-ring" />
              <div className="mv-intel-radar-ring mv-intel-radar-ring-2" />
              <div className="mv-intel-radar-sweep" />
              <div className="mv-intel-radar-center" />
            </div>
            <h3>No Ocean Recoveries Loaded</h3>
            <p>Select one or more recovery years to load ocean catch recovery records from RMIS.</p>
          </div>
        )}

        {tab === 'date' && !dateLoading && datePositions.length === 0 && (
          <div className="mv-intel-empty mv-intel-empty-sm">
            <div className="mv-intel-empty-icon">◎</div>
            <p>No ocean CWT recovery records found for this week.</p>
            <p className="mv-intel-empty-sub">Try a different date — SeaScope queries RMIS recovery records directly.</p>
          </div>
        )}

        {/* Full-screen loading overlay */}
        {loading && (
          <div className="mv-intel-loading-overlay" aria-live="polite">
            <div className="mv-intel-loading-card">
              <div className="mv-intel-loading-spinner" />
              <div className="mv-intel-loading-text">
                <h3>Loading Recovery Data</h3>
                <p>Fetching RMIS ocean recovery records...</p>
                <p className="mv-intel-loading-years">
                  {Array.from(enabledYears).sort((a, b) => a - b).join(' · ')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
