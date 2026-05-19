/**
 * MapPage — SeaScope Fishery Intelligence Platform
 * Production-ready. Two tabs: Data (map + sidebar) and Fish Movements.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MovementsEmbedded } from '../components/MovementsEmbedded';
import { FixMapResize } from '../components/FixMapResize';

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '/api';
const AUTO_REFRESH_MS = 10 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

const ALASKA_REGIONS = [
  'Southeast',
  'Southcentral',
  'Prince William Sound',
  'Cook Inlet',
  'Kodiak',
  'Bristol Bay',
  'Arctic-Yukon-Kuskokwim',
  'Interior',
] as const;

type AlaskaRegion = typeof ALASKA_REGIONS[number];
type TabType = 'data' | 'movement';
type MapStyle = 'dark' | 'satellite';

interface TideData {
  highTide: string;
  lowTide: string;
  sunrise: string;
  sunset: string;
  allHighs?: string[];
  allLows?: string[];
  station?: string;
}

interface RecoveryLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  locationCode: string;
  catchCount?: number;
}

interface FishRelease {
  id: string;
  hatchery: string;
  species: string;
  quantity: number;
  releaseDate: string;
  releaseType: string;
  latitude: number;
  longitude: number;
  location: string;
}

interface LiveCounter {
  id: string;
  river: string;
  species: string;
  todayCount: number;
  seasonCount: number;
  trend: 'up' | 'down' | 'stable';
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIES_COLORS: Record<string, string> = {
  'Chinook Salmon':  '#FFD700',
  'King Salmon':     '#FFD700',
  'Sockeye Salmon':  '#E53935',
  'Red Salmon':      '#E53935',
  'Coho Salmon':     '#C0C0C0',
  'Silver Salmon':   '#C0C0C0',
  'Pink Salmon':     '#FF69B4',
  'Humpy Salmon':    '#FF69B4',
  'Chum Salmon':     '#8B6914',
  'Dog Salmon':      '#8B6914',
  'Steelhead':       '#4FC3F7',
  'Steelhead Salmon':'#4FC3F7',
};

function speciesColor(species: string): string {
  return SPECIES_COLORS[species] ?? '#00bfff';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function buildUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const j = await res.json() as Record<string, unknown>;
      const e = j.error;
      if (typeof e === 'string') msg = e;
      else if (e && typeof e === 'object' && 'message' in e) msg = String((e as Record<string, unknown>).message);
      else if (typeof j.message === 'string') msg = j.message;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function fetchReleases(date: string): Promise<FishRelease[]> {
  const d = await fetchJson<unknown>(buildUrl('/releases', { date }));
  if (Array.isArray(d)) return d as FishRelease[];
  return (d as Record<string, unknown>)?.records as FishRelease[] ?? [];
}

async function fetchRecoveries(date: string): Promise<RecoveryLocation[]> {
  const d = await fetchJson<unknown>(buildUrl('/recoveries', { date }));
  if (Array.isArray(d)) return d as RecoveryLocation[];
  return (d as Record<string, unknown>)?.records as RecoveryLocation[] ?? [];
}

async function fetchLiveCounters(region: AlaskaRegion): Promise<LiveCounter[]> {
  const d = await fetchJson<unknown>(buildUrl('/live-counts', { region }));
  const arr: LiveCounter[] = Array.isArray(d) ? d as LiveCounter[] : ((d as Record<string, unknown>)?.counters as LiveCounter[] ?? []);
  return arr;
}

async function fetchTides(region: AlaskaRegion, date: string): Promise<TideData> {
  return fetchJson<TideData>(buildUrl('/tides', { region, date }));
}

function tileUrl(style: MapStyle): string {
  return style === 'satellite'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
}

function tileAttribution(style: MapStyle): string {
  return style === 'satellite' ? '&copy; Esri' : '&copy; CARTO';
}

// ─── Leaflet layers ───────────────────────────────────────────────────────────

function HatcheryReleaseLayer({ releases }: { releases: FishRelease[] }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    layerRef.current?.remove();
    const group = L.layerGroup();

    releases.forEach(r => {
      if (!r.latitude || !r.longitude) return;
      const color = speciesColor(r.species);
      const size = Math.max(10, Math.min(30, Math.round(Math.log10((r.quantity || 1) + 1) * 6)));

      const marker = L.marker([r.latitude, r.longitude], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.9);box-shadow:0 0 ${size}px ${color}88;"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: 200,
      });

      marker.bindPopup(`
        <div style="min-width:220px;background:#060f1e;color:#fff;border-radius:10px;padding:14px;font-family:inherit;">
          <div style="font-size:15px;font-weight:700;margin-bottom:10px;color:#fff;">${r.hatchery || 'Unknown Hatchery'}</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;">
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">Species</span><span style="color:${color};font-weight:600">${r.species}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">Released</span><span style="font-weight:700">${(r.quantity || 0).toLocaleString()}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">Date</span><span>${r.releaseDate || '—'}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">Location</span><span>${r.location || '—'}</span></div>
          </div>
        </div>
      `, { className: 'map-popup-dark' });

      group.addLayer(marker);
    });

    group.addTo(map);
    layerRef.current = group;
    return () => { group.remove(); };
  }, [map, releases]);

  return null;
}

function RecoveryLayer({ locations }: { locations: RecoveryLocation[] }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    layerRef.current?.remove();
    const group = L.layerGroup();

    locations.forEach(loc => {
      if (!loc.latitude || !loc.longitude) return;
      const marker = L.marker([loc.latitude, loc.longitude], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:9px;height:9px;border-radius:50%;background:#4ECDC4;box-shadow:0 0 14px #4ECDC4;border:1.5px solid rgba(255,255,255,0.85);"></div>`,
          iconSize: [9, 9],
          iconAnchor: [4.5, 4.5],
        }),
        zIndexOffset: 100,
      });

      marker.bindTooltip(`
        <div style="font-size:12px;color:#fff;">
          <div style="font-weight:700;color:#4ECDC4;">${loc.name || loc.locationCode}</div>
          <div style="color:rgba(255,255,255,0.6)">${loc.locationCode}</div>
          ${loc.catchCount ? `<div>Catch: ${loc.catchCount.toLocaleString()}</div>` : ''}
        </div>
      `, { className: 'map-tooltip-dark' });

      group.addLayer(marker);
    });

    group.addTo(map);
    layerRef.current = group;
    return () => { group.remove(); };
  }, [map, locations]);

  return null;
}

// ─── Sidebar sub-components ───────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="mp-stat-card">
      <div className="mp-stat-label">{label}</div>
      <div className="mp-stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div className="mp-stat-sub">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mp-section-title">{children}</div>;
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="mp-empty-state">
      <span className="mp-empty-icon">{icon}</span>
      <span className="mp-empty-text">{text}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductionReadyMapPage() {
  const [activeTab, setActiveTab]       = useState<TabType>('data');
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedRegion, setSelectedRegion] = useState<AlaskaRegion>('Southcentral');
  const [mapStyle, setMapStyle]         = useState<MapStyle>('dark');

  const [releases, setReleases]         = useState<FishRelease[]>([]);
  const [recoveries, setRecoveries]     = useState<RecoveryLocation[]>([]);
  const [liveCounters, setLiveCounters] = useState<LiveCounter[]>([]);
  const [tideData, setTideData]         = useState<TideData | null>(null);

  const [loading, setLoading]           = useState(false);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalReleased = useMemo(() => releases.reduce((s, r) => s + (r.quantity || 0), 0), [releases]);

  const speciesGroups = useMemo(() => {
    const m = new Map<string, number>();
    releases.forEach(r => m.set(r.species, (m.get(r.species) ?? 0) + (r.quantity || 0)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [releases]);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [relResult, recResult, ctrResult, tideResult] = await Promise.allSettled([
      fetchReleases(selectedDate),
      fetchRecoveries(selectedDate),
      fetchLiveCounters(selectedRegion),
      fetchTides(selectedRegion, selectedDate),
    ]);

    setReleases(relResult.status  === 'fulfilled' ? relResult.value  : []);
    setRecoveries(recResult.status === 'fulfilled' ? recResult.value : []);
    setLiveCounters(ctrResult.status === 'fulfilled' ? ctrResult.value : []);
    setTideData(tideResult.status === 'fulfilled' ? tideResult.value : null);

    const allFailed = [relResult, recResult, ctrResult, tideResult].every(r => r.status === 'rejected');
    if (allFailed) {
      const reason = relResult.status === 'rejected' ? relResult.reason : null;
      setError(reason instanceof Error ? reason.message : 'Backend unavailable. Set RMIS_API_KEY in backend/.env and restart.');
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, [selectedDate, selectedRegion]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  useEffect(() => {
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(loadAllData, AUTO_REFRESH_MS);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadAllData]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mp-page">

      {/* ── Top header bar ─────────────────────────────────────────────── */}
      <header className="mp-header">
        <div className="mp-header-left">
          <div className="mp-header-title">Fishery Intelligence Platform</div>
          <div className="mp-header-sub">
            Live Alaska RMIS · Recovery · Tides · Salmon Movements
            {lastUpdated && (
              <span className="mp-header-updated">
                · Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <div className="mp-header-right">
          {/* Tab switcher */}
          <div className="mp-tabs">
            <button
              className={`mp-tab${activeTab === 'data' ? ' active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              <span className="mp-tab-dot" />
              Data
            </button>
            <button
              className={`mp-tab${activeTab === 'movement' ? ' active' : ''}`}
              onClick={() => setActiveTab('movement')}
            >
              <span className="mp-tab-dot" />
              Fish Movements
            </button>
          </div>

          {/* Map style toggle (only on data tab) */}
          {activeTab === 'data' && (
            <div className="mp-style-toggle">
              <button
                className={`mp-style-btn${mapStyle === 'dark' ? ' active' : ''}`}
                onClick={() => setMapStyle('dark')}
              >
                Dark
              </button>
              <button
                className={`mp-style-btn${mapStyle === 'satellite' ? ' active' : ''}`}
                onClick={() => setMapStyle('satellite')}
              >
                Satellite
              </button>
            </div>
          )}

          {/* Refresh */}
          <button
            className="mp-refresh-btn"
            onClick={loadAllData}
            disabled={loading}
            aria-label="Refresh data"
            title="Refresh data"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
              style={{ animation: loading ? 'mp-spin 0.8s linear infinite' : 'none' }}>
              <path d="M12 7A5 5 0 1 1 7 2M7 2l2.5 2.5M7 2L4.5 4.5" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      {(loading || error) && (
        <div className={`mp-status-bar${error ? ' error' : ''}`}>
          {loading && !error && (
            <>
              <span className="mp-status-spinner" />
              Loading live fishery data…
            </>
          )}
          {error && (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 4v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
              <button className="mp-status-dismiss" onClick={() => setError(null)} aria-label="Dismiss">✕</button>
            </>
          )}
        </div>
      )}

      {/* ── Data tab ───────────────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div className="mp-data-layout">

          {/* Sidebar */}
          <aside className="mp-sidebar">

            {/* Date & Region */}
            <section className="mp-sidebar-section">
              <SectionTitle>Date & Region</SectionTitle>
              <div className="mp-field-group">
                <label className="mp-field-label" htmlFor="mp-date">Date</label>
                <input
                  id="mp-date"
                  type="date"
                  className="mp-input"
                  value={selectedDate}
                  max={todayIso()}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>
              <div className="mp-field-group">
                <label className="mp-field-label" htmlFor="mp-region">Region</label>
                <select
                  id="mp-region"
                  className="mp-input mp-select"
                  value={selectedRegion}
                  onChange={e => setSelectedRegion(e.target.value as AlaskaRegion)}
                >
                  {ALASKA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </section>

            {/* Release summary */}
            <section className="mp-sidebar-section">
              <SectionTitle>RMIS Release Summary</SectionTitle>
              <div className="mp-stats-row">
                <StatCard label="Total Released" value={totalReleased} />
                <StatCard label="Hatcheries" value={releases.length} />
              </div>
            </section>

            {/* Species totals */}
            <section className="mp-sidebar-section">
              <SectionTitle>Species Totals</SectionTitle>
              {speciesGroups.length === 0
                ? <EmptyState icon="🐟" text="No release data for this date" />
                : (
                  <div className="mp-species-list">
                    {speciesGroups.map(([species, count]) => (
                      <div key={species} className="mp-species-row">
                        <span className="mp-species-dot" style={{ background: speciesColor(species) }} />
                        <span className="mp-species-name">{species}</span>
                        <span className="mp-species-count">{count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </section>

            {/* Tides & Sun */}
            <section className="mp-sidebar-section">
              <SectionTitle>Regional Tides & Sun</SectionTitle>
              {!tideData
                ? <EmptyState icon="🌊" text="Tide data unavailable" />
                : (
                  <div className="mp-tide-grid">
                    <div className="mp-tide-item">
                      <div className="mp-tide-label">High Tide</div>
                      <div className="mp-tide-value">{tideData.highTide}</div>
                    </div>
                    <div className="mp-tide-item">
                      <div className="mp-tide-label">Low Tide</div>
                      <div className="mp-tide-value">{tideData.lowTide}</div>
                    </div>
                    <div className="mp-tide-item">
                      <div className="mp-tide-label">Sunrise</div>
                      <div className="mp-tide-value">{tideData.sunrise}</div>
                    </div>
                    <div className="mp-tide-item">
                      <div className="mp-tide-label">Sunset</div>
                      <div className="mp-tide-value">{tideData.sunset}</div>
                    </div>
                  </div>
                )
              }
            </section>

            {/* Live counters */}
            <section className="mp-sidebar-section">
              <SectionTitle>Live Salmon Counters</SectionTitle>
              {liveCounters.length === 0
                ? <EmptyState icon="📡" text="No live counter data" />
                : (
                  <div className="mp-counter-list">
                    {liveCounters.map(c => (
                      <div key={c.id} className="mp-counter-card">
                        <div className="mp-counter-header">
                          <span className="mp-counter-river">{c.river}</span>
                          <span className="mp-counter-live-dot" />
                        </div>
                        <div className="mp-counter-species" style={{ color: speciesColor(c.species) }}>
                          {c.species}
                        </div>
                        <div className="mp-counter-stats">
                          <div>
                            <div className="mp-counter-stat-label">Today</div>
                            <div className="mp-counter-stat-value">{c.todayCount.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="mp-counter-stat-label">Season</div>
                            <div className="mp-counter-stat-value">{c.seasonCount.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </section>

            {/* Latest releases */}
            <section className="mp-sidebar-section">
              <SectionTitle>Latest RMIS Releases</SectionTitle>
              {releases.length === 0
                ? <EmptyState icon="🏭" text="No releases for this date" />
                : (
                  <div className="mp-release-list">
                    {releases.slice(0, 20).map(r => (
                      <div key={r.id} className="mp-release-card">
                        <div className="mp-release-left">
                          <div className="mp-release-hatchery">{r.hatchery}</div>
                          <div className="mp-release-species" style={{ color: speciesColor(r.species) }}>
                            {r.species}
                          </div>
                        </div>
                        <div className="mp-release-right">
                          <div className="mp-release-qty">{(r.quantity || 0).toLocaleString()}</div>
                          <div className="mp-release-qty-label">released</div>
                        </div>
                      </div>
                    ))}
                    {releases.length > 20 && (
                      <div className="mp-release-more">+{releases.length - 20} more</div>
                    )}
                  </div>
                )
              }
            </section>

            {/* Legend */}
            <section className="mp-sidebar-section mp-legend-section">
              <div className="mp-legend">
                <div className="mp-legend-item">
                  <span className="mp-legend-dot" style={{ background: '#FFD700', boxShadow: '0 0 8px #FFD700' }} />
                  <span>Hatchery Release</span>
                </div>
                <div className="mp-legend-item">
                  <span className="mp-legend-dot" style={{ background: '#4ECDC4', boxShadow: '0 0 8px #4ECDC4' }} />
                  <span>Recovery Location</span>
                </div>
              </div>
              <div className="mp-data-source">
                <span className="mp-data-source-dot" />
                RMIS Official Data
              </div>
            </section>
          </aside>

          {/* Map */}
          <main className="mp-map-wrap">
            <MapContainer
              center={[60.2, -152.8]}
              zoom={5}
              className="mp-map"
              zoomControl
              preferCanvas
            >
              <TileLayer
                key={mapStyle}
                url={tileUrl(mapStyle)}
                attribution={tileAttribution(mapStyle)}
                errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
              />
              <FixMapResize visible={activeTab === 'data'} delay={120} />
              <HatcheryReleaseLayer releases={releases} />
              <RecoveryLayer locations={recoveries} />
            </MapContainer>

            {/* Map overlay: recovery count badge */}
            {recoveries.length > 0 && (
              <div className="mp-map-badge">
                <span className="mp-map-badge-dot" />
                {recoveries.length} recovery {recoveries.length === 1 ? 'site' : 'sites'}
              </div>
            )}
          </main>
        </div>
      )}

      {/* ── Movement tab ───────────────────────────────────────────────── */}
      {activeTab === 'movement' && (
        <div className="mp-movement-wrap">
          <MovementsEmbedded onGoToData={() => setActiveTab('data')} />
        </div>
      )}
    </div>
  );
}

export { ProductionReadyMapPage as default };
