/**
 * Fish Migration Service
 *
 * Models salmon movement from hatchery release → catch events → final destination.
 * Each hatchery gets a unique color. Arrows chain from release → catch1 → catch2 → ...
 * Arrow thickness scales with fish count. Thinning occurs at each catch event.
 *
 * Data sources:
 *   - NPAFC migration studies
 *   - NOAA Fisheries Pacific salmon ocean distribution research
 *   - ADF&G salmon migration corridor data
 */

export interface CatchEvent {
  lat: number;
  lng: number;
  location: string;
  fishCaught: number;
  fishRemaining: number;
  date: string;
  fishery: string;
}

export interface MovementSegment {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  fishCount: number;       // fish traveling this segment
  isReturn: boolean;       // true = returning to hatchery
}

export interface HatcheryMovement {
  hatcheryId: string;
  hatcheryName: string;
  hatcheryLat: number;
  hatcheryLng: number;
  color: string;
  species: string;
  year: number;
  released: number;
  catchEvents: CatchEvent[];
  segments: MovementSegment[];
  finalReturns: number;    // fish that made it back
  notReturnedCount: number;
  notReturnedPct: number;
  speciesBreakdown?: Array<{
    species: string;
    released: number;
    returned: number;
    notReturnedPct: number;
  }>;
}

export interface MigrationPath {
  id: string;
  species: string;
  hatchery: string;
  releaseLat: number;
  releaseLng: number;
  releaseDate: string;
  currentLat: number;
  currentLng: number;
  daysAtSea: number;
  waypoints: Array<{ lat: number; lng: number; daysFromRelease: number; label?: string }>;
  color: string;
  estimatedQuantity: number;
}

// Unique hatchery colors — one per hatchery, consistent across species
const HATCHERY_COLORS: string[] = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#FFD93D', '#6BCB77', '#4D96FF', '#FF6FC8', '#C77DFF',
  '#F4A261', '#2EC4B6', '#E76F51', '#A8DADC', '#457B9D',
  '#E63946', '#06D6A0', '#118AB2', '#FFB703', '#8338EC',
];

const hatcheryColorMap = new Map<string, string>();
let colorIndex = 0;

export function getHatcheryColor(hatcheryName: string): string {
  if (!hatcheryColorMap.has(hatcheryName)) {
    hatcheryColorMap.set(hatcheryName, HATCHERY_COLORS[colorIndex % HATCHERY_COLORS.length]);
    colorIndex++;
  }
  return hatcheryColorMap.get(hatcheryName)!;
}

export function resetHatcheryColors(): void {
  hatcheryColorMap.clear();
  colorIndex = 0;
}

// Species-specific migration parameters
const MIGRATION_PARAMS: Record<string, {
  kmPerDay: number;
  oceanBearing: number;
  curvaturePer30Days: number;
  maxOffshoreKm: number;
  returnRate: number;   // fraction that return to hatchery
  catchRate: number;    // fraction caught in fisheries
}> = {
  'Chinook Salmon': {
    kmPerDay: 35, oceanBearing: 200, curvaturePer30Days: -15,
    maxOffshoreKm: 800, returnRate: 0.03, catchRate: 0.15,
  },
  'Sockeye Salmon': {
    kmPerDay: 45, oceanBearing: 185, curvaturePer30Days: -20,
    maxOffshoreKm: 1200, returnRate: 0.05, catchRate: 0.25,
  },
  'Coho Salmon': {
    kmPerDay: 28, oceanBearing: 210, curvaturePer30Days: -10,
    maxOffshoreKm: 500, returnRate: 0.04, catchRate: 0.20,
  },
  'Pink Salmon': {
    kmPerDay: 38, oceanBearing: 195, curvaturePer30Days: -18,
    maxOffshoreKm: 900, returnRate: 0.06, catchRate: 0.30,
  },
  'Chum Salmon': {
    kmPerDay: 32, oceanBearing: 190, curvaturePer30Days: -12,
    maxOffshoreKm: 700, returnRate: 0.04, catchRate: 0.22,
  },
};

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371;

function movePoint(lat: number, lng: number, bearingDeg: number, distKm: number): [number, number] {
  const latR = lat * DEG_TO_RAD;
  const lngR = lng * DEG_TO_RAD;
  const bearR = bearingDeg * DEG_TO_RAD;
  const d = distKm / EARTH_RADIUS_KM;
  const newLatR = Math.asin(
    Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(bearR)
  );
  const newLngR = lngR + Math.atan2(
    Math.sin(bearR) * Math.sin(d) * Math.cos(latR),
    Math.cos(d) - Math.sin(latR) * Math.sin(newLatR)
  );
  return [newLatR * RAD_TO_DEG, newLngR * RAD_TO_DEG];
}

function getOceanEntryPoint(lat: number, lng: number, region: string): [number, number] {
  const entries: Record<string, [number, number]> = {
    'Southeast':            [57.0, -135.5],
    'Prince William Sound': [60.0, -147.5],
    'Cook Inlet':           [59.5, -152.0],
    'Bristol Bay':          [58.5, -158.5],
    'Kodiak':               [57.5, -153.5],
  };
  return entries[region] ?? [lat, lng];
}

function inferRegion(lat: number, lng: number): string {
  if (lng < -155 && lat < 60) return 'Bristol Bay';
  if (lng < -151 && lat < 58) return 'Kodiak';
  if (lng < -148 && lat > 59) return 'Cook Inlet';
  if (lng < -145 && lat > 59) return 'Prince William Sound';
  return 'Southeast';
}

// Known Alaska fishing grounds for catch event placement
const FISHING_GROUNDS: Array<{ name: string; lat: number; lng: number; fishery: string }> = [
  { name: 'Kodiak Shelf',        lat: 57.5, lng: -153.0, fishery: 'Ocean Net' },
  { name: 'Cook Inlet Mouth',    lat: 59.0, lng: -152.5, fishery: 'Alaska Net' },
  { name: 'Shelikof Strait',     lat: 57.8, lng: -155.0, fishery: 'Ocean Net' },
  { name: 'Chatham Strait',      lat: 57.2, lng: -134.8, fishery: 'Alaska Net' },
  { name: 'Icy Strait',          lat: 58.2, lng: -135.8, fishery: 'Alaska Net' },
  { name: 'Bristol Bay Mouth',   lat: 58.0, lng: -160.0, fishery: 'Alaska Net' },
  { name: 'Unimak Pass',         lat: 54.3, lng: -164.8, fishery: 'Ocean Net' },
  { name: 'Resurrection Bay',    lat: 59.9, lng: -149.4, fishery: 'Alaska Sport' },
  { name: 'Yakutat Bay',         lat: 59.5, lng: -139.7, fishery: 'Alaska Net' },
  { name: 'Prince William Sound', lat: 60.5, lng: -147.0, fishery: 'Alaska Net' },
];

/**
 * Generate chain movement data for a hatchery+species+year combo.
 * Returns segments with thinning arrows and catch events.
 */
export function generateHatcheryMovement(
  hatcheryName: string,
  hatcheryLat: number,
  hatcheryLng: number,
  species: string,
  year: number,
  released: number
): HatcheryMovement {
  const params = MIGRATION_PARAMS[species] ?? MIGRATION_PARAMS['Chinook Salmon'];
  const color = getHatcheryColor(hatcheryName);
  const region = inferRegion(hatcheryLat, hatcheryLng);
  const [oceanLat, oceanLng] = getOceanEntryPoint(hatcheryLat, hatcheryLng, region);

  // Simulate 2-3 catch events along the migration path
  const catchEvents: CatchEvent[] = [];
  const segments: MovementSegment[] = [];

  let remaining = released;
  let curLat = oceanLat;
  let curLng = oceanLng;
  let bearing = params.oceanBearing;

  // First segment: hatchery → ocean entry
  segments.push({
    fromLat: hatcheryLat, fromLng: hatcheryLng,
    toLat: oceanLat, toLng: oceanLng,
    fishCount: remaining, isReturn: false,
  });

  // Generate 2-3 catch events at fishing grounds
  const numCatchEvents = 2 + Math.floor(Math.abs(Math.sin(hatcheryLat * 7)) * 2);
  const usedGrounds = new Set<number>();

  for (let i = 0; i < numCatchEvents && remaining > 0; i++) {
    // Move along migration path
    const stepDays = 30 + i * 20;
    const distKm = params.kmPerDay * stepDays;
    bearing += (params.curvaturePer30Days / 30) * stepDays;
    [curLat, curLng] = movePoint(curLat, curLng, bearing, distKm);
    curLat = Math.max(40, Math.min(65, curLat));
    curLng = Math.max(-180, Math.min(-120, curLng));

    // Find nearest unused fishing ground
    let bestGround = FISHING_GROUNDS[0];
    let bestDist = Infinity;
    FISHING_GROUNDS.forEach((g, idx) => {
      if (usedGrounds.has(idx)) return;
      const d = Math.sqrt(Math.pow(g.lat - curLat, 2) + Math.pow(g.lng - curLng, 2));
      if (d < bestDist) { bestDist = d; bestGround = g; usedGrounds.add(idx); }
    });

    // Deterministic catch fraction based on species + position
    const catchFraction = params.catchRate * (0.7 + 0.3 * Math.abs(Math.sin(i + hatcheryLat)));
    const caught = Math.round(remaining * catchFraction);
    const afterCatch = remaining - caught;

    catchEvents.push({
      lat: bestGround.lat,
      lng: bestGround.lng,
      location: bestGround.name,
      fishCaught: caught,
      fishRemaining: afterCatch,
      date: `${year}-0${5 + i}-15`.replace('-0', '-'),
      fishery: bestGround.fishery,
    });

    // Segment: previous point → catch event
    segments.push({
      fromLat: curLat, fromLng: curLng,
      toLat: bestGround.lat, toLng: bestGround.lng,
      fishCount: remaining, isReturn: false,
    });

    remaining = afterCatch;
    curLat = bestGround.lat;
    curLng = bestGround.lng;
  }

  // Final returns to hatchery
  const finalReturns = Math.round(released * params.returnRate);
  const notReturnedCount = released - finalReturns;
  const notReturnedPct = released > 0 ? (notReturnedCount / released) * 100 : 0;

  // Return segment (thinner — only survivors)
  if (finalReturns > 0) {
    segments.push({
      fromLat: curLat, fromLng: curLng,
      toLat: hatcheryLat, toLng: hatcheryLng,
      fishCount: finalReturns, isReturn: true,
    });
  }

  return {
    hatcheryId: `${hatcheryName}-${species}-${year}`.replace(/\s/g, '-'),
    hatcheryName,
    hatcheryLat,
    hatcheryLng,
    color,
    species,
    year,
    released,
    catchEvents,
    segments,
    finalReturns,
    notReturnedCount,
    notReturnedPct,
  };
}

/**
 * Aggregate movements by hatchery (all species combined) for the return rate table.
 */
export interface HatcheryReturnStats {
  hatcheryName: string;
  color: string;
  totalReleased: number;
  totalReturned: number;
  notReturnedPct: number;
  speciesBreakdown: Array<{
    species: string;
    released: number;
    returned: number;
    notReturnedPct: number;
  }>;
}

export function aggregateReturnStats(movements: HatcheryMovement[]): HatcheryReturnStats[] {
  const map = new Map<string, HatcheryReturnStats>();

  for (const m of movements) {
    if (!map.has(m.hatcheryName)) {
      map.set(m.hatcheryName, {
        hatcheryName: m.hatcheryName,
        color: m.color,
        totalReleased: 0,
        totalReturned: 0,
        notReturnedPct: 0,
        speciesBreakdown: [],
      });
    }
    const entry = map.get(m.hatcheryName)!;
    entry.totalReleased += m.released;
    entry.totalReturned += m.finalReturns;
    entry.speciesBreakdown.push({
      species: m.species,
      released: m.released,
      returned: m.finalReturns,
      notReturnedPct: m.notReturnedPct,
    });
  }

  for (const entry of map.values()) {
    entry.notReturnedPct = entry.totalReleased > 0
      ? ((entry.totalReleased - entry.totalReturned) / entry.totalReleased) * 100
      : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.notReturnedPct - a.notReturnedPct);
}

// ─── Legacy MigrationPath support (used by Fish Locations tab) ────────────────

export function computeMigrationPath(
  species: string,
  hatchery: string,
  releaseLat: number,
  releaseLng: number,
  releaseDate: string,
  viewDate: string,
  _region: string,
  estimatedQuantity: number
): MigrationPath | null {
  const params = MIGRATION_PARAMS[species];
  if (!params) return null;

  const releaseMs = new Date(releaseDate).getTime();
  const viewMs = new Date(viewDate).getTime();
  const daysAtSea = Math.max(0, (viewMs - releaseMs) / 86_400_000);
  if (daysAtSea === 0) return null;

  const [oceanLat, oceanLng] = getOceanEntryPoint(releaseLat, releaseLng, inferRegion(releaseLat, releaseLng));
  const waypoints: Array<{ lat: number; lng: number; daysFromRelease: number; label?: string }> = [
    { lat: releaseLat, lng: releaseLng, daysFromRelease: 0, label: `${hatchery} (Release)` },
  ];

  const distToOcean = Math.sqrt(
    Math.pow(oceanLat - releaseLat, 2) + Math.pow(oceanLng - releaseLng, 2)
  ) * 111;
  if (distToOcean > 20) {
    waypoints.push({ lat: oceanLat, lng: oceanLng, daysFromRelease: 3, label: 'Ocean Entry' });
  }

  let curLat = oceanLat, curLng = oceanLng;
  let bearing = params.oceanBearing;
  const stepDays = 7;
  let totalDays = distToOcean > 20 ? 3 : 0;

  while (totalDays < daysAtSea) {
    const step = Math.min(stepDays, daysAtSea - totalDays);
    bearing += (params.curvaturePer30Days / 30) * step;
    [curLat, curLng] = movePoint(curLat, curLng, bearing, params.kmPerDay * step);
    curLat = Math.max(40, Math.min(65, curLat));
    curLng = Math.max(-180, Math.min(-120, curLng));
    totalDays += step;
    waypoints.push({
      lat: curLat, lng: curLng, daysFromRelease: totalDays,
      label: totalDays >= daysAtSea ? `~Day ${Math.round(totalDays)} (Est. Now)` : undefined,
    });
  }

  return {
    id: `${hatchery}-${species}-${releaseDate}`.replace(/\s/g, '-'),
    species, hatchery, releaseLat, releaseLng, releaseDate,
    currentLat: curLat, currentLng: curLng,
    daysAtSea: Math.round(daysAtSea),
    waypoints,
    color: getHatcheryColor(hatchery),
    estimatedQuantity,
  };
}

export function generateMigrationPaths(
  releases: Array<{
    id: string; species: string; hatchery: string;
    lat: number; lng: number; date: string;
    quantity: number; location: string;
  }>,
  viewDate: string,
  timeframeDays: number
): MigrationPath[] {
  const viewMs = new Date(viewDate).getTime();
  const cutoffMs = viewMs - timeframeDays * 86_400_000;
  const seen = new Set<string>();
  const paths: MigrationPath[] = [];

  for (const r of releases) {
    const releaseMs = new Date(r.date).getTime();
    if (releaseMs < cutoffMs || releaseMs > viewMs) continue;
    const key = `${r.hatchery}-${r.species}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const region = inferRegion(r.lat, r.lng);
    const path = computeMigrationPath(r.species, r.hatchery, r.lat, r.lng, r.date, viewDate, region, r.quantity);
    if (path) paths.push(path);
  }
  return paths;
}
