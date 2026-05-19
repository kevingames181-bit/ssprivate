import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { HatcheryWeeklyMovement, DateViewPosition } from '../services/movementDataService';
import 'leaflet/dist/leaflet.css';

export type LayerMode = 'releases' | 'locations' | 'movement' | 'migration';
type WeeklyMovementPosition = HatcheryWeeklyMovement['weeklyPositions'][number];

interface LatLngPoint {
  lat: number;
  lng: number;
}

const BRANCH_SPLIT_KM = 16;
const FIRST_CATCH_ATTACHMENT_KM = 5;
const STACKED_MARKER_KM = 2;
const RETURN_LOCAL_AREA_KM = 80;
const MOVEMENT_DAY_EPSILON = 0.001;
const PWS_BOUNDARY_URL = '/data/pws-districts.geojson';
const COOK_INLET_BOUNDARY_URL = '/data/cook-inlet-statistical-areas.geojson';
const BRISTOL_BAY_BOUNDARY_URL = '/data/bristol-bay-statistical-areas.geojson';
const SOUTHEAST_BOUNDARY_URL = '/data/southeast-statistical-areas.geojson';
const AYK_BOUNDARY_URL = '/data/ayk-statistical-areas.geojson';
const PWS_ROUTE_GRAPH_URL = '/data/pws-route-graph.json';
const PWS_ROUTE_SAMPLE_KM = 0.22;
const PWS_ROUTE_ENDPOINT_EDGE_KM = 22;
const PWS_DIRECT_SHORT_KM = 5;
const PWS_GRID_LAT_STEP = 0.016;
const PWS_GRID_LNG_STEP = 0.032;
const PWS_ROUTE_CACHE_VERSION = 'water-grid-v3';
const PWS_BOUNDARY_SEGMENT_LAT_STEP = 0.02;
const PWS_BOUNDARY_SEGMENT_LNG_STEP = 0.04;
const PWS_BOUNDARY_CANVAS_SCALE = 100000;

const REGION_BOUNDARY_CONFIGS: Record<string, {
  id: string;
  url: string;
  routeGraphUrl?: string;
  routingEnabled?: boolean;
  buildSegmentGrid?: boolean;
}> = {
  'Prince William Sound': {
    id: 'pws',
    url: PWS_BOUNDARY_URL,
    routeGraphUrl: PWS_ROUTE_GRAPH_URL,
    routingEnabled: true,
    buildSegmentGrid: true,
  },
  'Cook Inlet': {
    id: 'cook-inlet',
    url: COOK_INLET_BOUNDARY_URL,
  },
  'Bristol Bay': {
    id: 'bristol-bay',
    url: BRISTOL_BAY_BOUNDARY_URL,
  },
  'Southeast Alaska': {
    id: 'southeast-alaska',
    url: SOUTHEAST_BOUNDARY_URL,
    routeGraphUrl: '/data/southeast-route-graph.json',
    routingEnabled: true,
  },
  'Southeast': {
    id: 'southeast-alaska',
    url: SOUTHEAST_BOUNDARY_URL,
    routeGraphUrl: '/data/southeast-route-graph.json',
    routingEnabled: true,
  },
  'Northern Alaska': {
    id: 'ayk',
    url: AYK_BOUNDARY_URL,
  },
};

interface BoundaryBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface BoundaryRing {
  points: LatLngPoint[];
  bounds: BoundaryBounds;
}

interface BoundaryPolygon {
  rings: BoundaryRing[];
  bounds: BoundaryBounds;
  path?: Path2D;
}

interface BoundarySegment {
  from: LatLngPoint;
  to: LatLngPoint;
  bounds: BoundaryBounds;
}

interface PwsBoundary {
  id: string;
  polygons: BoundaryPolygon[];
  rings: BoundaryRing[];
  bounds: BoundaryBounds;
  southernOpenLat: number;
  canvasContext: CanvasRenderingContext2D | null;
  segmentGrid: Map<string, BoundarySegment[]>;
  routingEnabled: boolean;
  routeGraph?: PwsRouteGraph;
}

interface PwsRouteNode extends LatLngPoint {
  id: string;
}

interface PwsGraphNode extends LatLngPoint {
  id?: string;
}

interface PwsRouteGraph {
  nodes: PwsGraphNode[];
  edges: Array<Array<{ to: number; weight: number }>>;
}

interface MovementBoundaryContext {
  primary: PwsBoundary | null;
  all: PwsBoundary[];
  isLoading: boolean;
  hasBoundaryConfig: boolean;
}

interface BoundaryParseOptions {
  buildSegmentGrid?: boolean;
  buildPaths?: boolean;
  routingEnabled?: boolean;
}

type GeoJsonPosition = [number, number];
type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: GeoJsonPosition[][] }
  | { type: 'MultiPolygon'; coordinates: GeoJsonPosition[][][] };
interface GeoJsonFeature {
  geometry?: GeoJsonGeometry | null;
}
interface GeoJsonFeatureCollection {
  features?: GeoJsonFeature[];
}

const PWS_WATER_ROUTE_NODES: PwsRouteNode[] = [
  { id: 'open-sw', lat: 59.34, lng: -148.72 },
  { id: 'open-south', lat: 59.42, lng: -147.78 },
  { id: 'open-central', lat: 59.42, lng: -146.62 },
  { id: 'open-se', lat: 59.58, lng: -145.45 },
  { id: 'montague-west', lat: 59.72, lng: -148.35 },
  { id: 'montague-northwest', lat: 59.95, lng: -148.16 },
  { id: 'latouche-pass', lat: 60.10, lng: -148.05 },
  { id: 'chenega-pass', lat: 60.24, lng: -147.96 },
  { id: 'knight-west', lat: 60.38, lng: -148.06 },
  { id: 'main-bay-mouth', lat: 60.52, lng: -148.00 },
  { id: 'northwest-sound', lat: 60.66, lng: -147.94 },
  { id: 'college-entrance', lat: 60.79, lng: -147.79 },
  { id: 'central-sound', lat: 60.42, lng: -147.28 },
  { id: 'naked-island-west', lat: 60.56, lng: -147.25 },
  { id: 'naked-island-north', lat: 60.70, lng: -147.17 },
  { id: 'columbia-mouth', lat: 60.84, lng: -147.06 },
  { id: 'valdez-arm-mouth', lat: 60.79, lng: -146.78 },
  { id: 'valdez-arm-south', lat: 60.91, lng: -146.75 },
  { id: 'valdez-arm-mid', lat: 61.00, lng: -146.61 },
  { id: 'valdez-narrows', lat: 61.08, lng: -146.48 },
  { id: 'port-valdez', lat: 61.12, lng: -146.36 },
  { id: 'tatitlek', lat: 60.77, lng: -146.40 },
  { id: 'bligh', lat: 60.67, lng: -146.25 },
  { id: 'hinchinbrook-north', lat: 60.40, lng: -146.28 },
  { id: 'hinchinbrook-entrance', lat: 60.22, lng: -146.58 },
  { id: 'copper-west', lat: 60.50, lng: -145.90 },
  { id: 'cordova-orca', lat: 60.62, lng: -145.70 },
];

const PWS_ROUTE_EDGES: Array<[string, string]> = [
  ['open-sw', 'open-south'],
  ['open-south', 'open-central'],
  ['open-central', 'open-se'],
  ['open-sw', 'montague-west'],
  ['open-south', 'montague-west'],
  ['open-south', 'hinchinbrook-entrance'],
  ['open-central', 'hinchinbrook-entrance'],
  ['open-central', 'hinchinbrook-north'],
  ['open-se', 'copper-west'],
  ['montague-west', 'montague-northwest'],
  ['montague-northwest', 'latouche-pass'],
  ['latouche-pass', 'chenega-pass'],
  ['chenega-pass', 'knight-west'],
  ['knight-west', 'main-bay-mouth'],
  ['main-bay-mouth', 'northwest-sound'],
  ['northwest-sound', 'college-entrance'],
  ['chenega-pass', 'central-sound'],
  ['central-sound', 'naked-island-west'],
  ['naked-island-west', 'naked-island-north'],
  ['naked-island-north', 'columbia-mouth'],
  ['columbia-mouth', 'valdez-arm-mouth'],
  ['valdez-arm-mouth', 'valdez-arm-south'],
  ['valdez-arm-south', 'valdez-arm-mid'],
  ['valdez-arm-mid', 'valdez-narrows'],
  ['valdez-narrows', 'port-valdez'],
  ['valdez-arm-mouth', 'tatitlek'],
  ['tatitlek', 'bligh'],
  ['bligh', 'hinchinbrook-north'],
  ['hinchinbrook-north', 'hinchinbrook-entrance'],
  ['hinchinbrook-north', 'copper-west'],
  ['copper-west', 'cordova-orca'],
  ['central-sound', 'hinchinbrook-entrance'],
];

// ─── Color palette & helpers ──────────────────────────────────────────────────
export const COLOR_PALETTE = [
  '#FF6B6B','#4ECDC4','#FFD93D','#6BCB77','#4D96FF',
  '#FF6FC8','#C77DFF','#F4A261','#2EC4B6','#E76F51',
  '#A8DADC','#457B9D','#E9C46A','#F77F00','#80B918',
];

const MOVEMENT_SPECIES_COLORS: Record<string, string> = {
  '1': '#FFD700',
  '2': '#C0C0C0',
  '4': '#E53935',
  '5': '#FF69B4',
  '6': '#8B4513',
};

export function yearColor(year: number): string {
  if (year >= 3000) {
    const speciesCode = String(year - 3000);
    const speciesColor = MOVEMENT_SPECIES_COLORS[speciesCode];
    if (speciesColor) return speciesColor;
  }
  return COLOR_PALETTE[year % COLOR_PALETTE.length];
}

// ─── Seed hatchery list ───────────────────────────────────────────────────────
export const SEED_HATCHERIES: Array<{ name: string; lat: number; lng: number; region: string }> = [
  { name: 'CROOKED CREEK HATCHERY', lat: 61.87, lng: -150.07, region: 'Cook Inlet' },
  { name: 'ELMENDORF HATCHERY', lat: 61.25, lng: -149.80, region: 'Cook Inlet' },
  { name: 'KENAI HATCHERY', lat: 60.55, lng: -151.20, region: 'Cook Inlet' },
  { name: 'HOMER HATCHERY', lat: 59.64, lng: -151.55, region: 'Cook Inlet' },
  { name: 'SEWARD HATCHERY', lat: 60.10, lng: -149.44, region: 'Cook Inlet' },
  { name: 'VALDEZ HATCHERY', lat: 61.13, lng: -146.35, region: 'Prince William Sound' },
  { name: 'CORDOVA HATCHERY', lat: 60.54, lng: -145.76, region: 'Prince William Sound' },
  { name: 'MAIN BAY HATCHERY', lat: 60.22, lng: -147.80, region: 'Prince William Sound' },
  { name: 'CANNERY CREEK HATCHERY', lat: 60.65, lng: -147.90, region: 'Prince William Sound' },
  { name: 'JUNEAU HATCHERY', lat: 58.30, lng: -134.42, region: 'Southeast Alaska' },
  { name: 'SITKA HATCHERY', lat: 57.05, lng: -135.33, region: 'Southeast Alaska' },
  { name: 'KETCHIKAN HATCHERY', lat: 55.34, lng: -131.65, region: 'Southeast Alaska' },
  { name: 'WRANGELL HATCHERY', lat: 56.47, lng: -132.38, region: 'Southeast Alaska' },
  { name: 'CRAIG HATCHERY', lat: 55.48, lng: -133.15, region: 'Southeast Alaska' },
  { name: 'HIDDEN FALLS HATCHERY', lat: 57.20, lng: -134.90, region: 'Southeast Alaska' },
  { name: 'MEDVEJIE HATCHERY', lat: 57.10, lng: -135.40, region: 'Southeast Alaska' },
  { name: 'KODIAK HATCHERY', lat: 57.79, lng: -152.41, region: 'Kodiak' },
  { name: 'KITOI BAY HATCHERY', lat: 58.10, lng: -152.30, region: 'Kodiak' },
  { name: 'PILLAR CREEK HATCHERY', lat: 57.85, lng: -152.50, region: 'Kodiak' },
  { name: 'BEAR LAKE HATCHERY', lat: 57.40, lng: -157.00, region: 'Bristol Bay' },
  { name: 'UGASHIK HATCHERY', lat: 57.52, lng: -157.40, region: 'Bristol Bay' },
  { name: 'CHIGNIK HATCHERY', lat: 56.30, lng: -158.40, region: 'Chignik' },
  { name: 'NORTON SOUND HATCHERY', lat: 64.50, lng: -165.40, region: 'Northern Alaska' },
];

// ─── Tile helpers ─────────────────────────────────────────────────────────────
export function tileUrl(satellite: boolean): string {
  return satellite
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
}

export function tileAttribution(satellite: boolean): string {
  return satellite
    ? '&copy; <a href="https://www.esri.com/">Esri</a>'
    : '&copy; <a href="https://carto.com/">CARTO</a>';
}

// ─── Satellite toggle ─────────────────────────────────────────────────────────
export function SatelliteToggle({ satellite, onToggle }: { satellite: boolean; onToggle: () => void }) {
  return (
    <button
      className={`map-view-toggle ${satellite ? 'active' : ''}`}
      onClick={onToggle}
      title={satellite ? 'Switch to Dark map' : 'Switch to Satellite'}
      aria-label="Toggle satellite view"
    >
      {satellite ? '🗺 Map' : '🛰 Satellite'}
    </button>
  );
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────
const FULL_MONTHS: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
  May: 'May', Jun: 'June', Jul: 'July', Aug: 'August',
  Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

function formatWeekLabel(raw: string): string {
  if (raw.startsWith('Weeks of: ')) {
    const labels = raw.replace(/^Weeks of:\s*/, '').split('; ').filter(Boolean);
    return formatWeekLabels(labels);
  }

  const m = raw.match(/Wk\s+(\d+)\s*(?:\u00b7|-)\s*([A-Za-z]+)(?:\s+(\d{4}))?/);
  if (!m) return raw;
  const [, wk, mon, yr] = m;
  const fullMon = FULL_MONTHS[mon] ?? mon;
  const dayOfYear = (parseInt(wk) - 1) * 7 + 4;
  const approxDay = Math.min(28, Math.max(1, dayOfYear % 30 || 1));
  return `Week of: ${approxDay} ${fullMon}${yr ? ` ${yr}` : ''}`;
}

function compactWeekLabel(raw: string): string {
  return formatWeekLabel(raw).replace(/^Week of:\s*/, '');
}

function formatWeekLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ? formatWeekLabel(labels[0]) : '';
  return `Weeks of: ${labels.map(compactWeekLabel).join('; ')}`;
}

function positionWeekLabels(pos: WeeklyMovementPosition): string[] {
  if (pos.sourceWeekLabels && pos.sourceWeekLabels.length > 0) return pos.sourceWeekLabels;
  if (pos.weekLabel.startsWith('Weeks of: ')) {
    return pos.weekLabel.replace(/^Weeks of:\s*/, '').split('; ').filter(Boolean);
  }
  return [pos.weekLabel];
}

function formatPositionWeekLabel(pos: WeeklyMovementPosition): string {
  return formatWeekLabels(positionWeekLabels(pos));
}

function positionWeekCount(pos: WeeklyMovementPosition): number {
  return positionWeekLabels(pos).length;
}

function positionWeekSummaries(pos: WeeklyMovementPosition): Array<{ weekLabel: string; catchCount: number }> {
  if (pos.sourceWeekSummaries && pos.sourceWeekSummaries.length > 0) return pos.sourceWeekSummaries;
  return positionWeekLabels(pos).map(weekLabel => ({
    weekLabel,
    catchCount: pos.catchCount,
  }));
}

function canAttachToFirstCatch(firstPos: WeeklyMovementPosition, pos: WeeklyMovementPosition): boolean {
  if (pos.isHatchery || pos.isReturn) return false;
  return distanceKm(firstPos.lat, firstPos.lng, pos.lat, pos.lng) <= FIRST_CATCH_ATTACHMENT_KM;
}

function firstCatchAttachmentIndexes(
  positions: WeeklyMovementPosition[],
  firstDataIndex: number,
  drawUpTo: number
): Set<number> {
  const indexes = new Set<number>();
  const firstPos = positions[firstDataIndex];
  if (!firstPos) return indexes;

  for (let i = firstDataIndex + 1; i <= drawUpTo && i < positions.length; i++) {
    if (canAttachToFirstCatch(firstPos, positions[i])) indexes.add(i);
  }

  return indexes;
}

function firstCatchDisplayPosition(
  firstPos: WeeklyMovementPosition,
  attachments: WeeklyMovementPosition[]
): WeeklyMovementPosition {
  if (attachments.length === 0) return firstPos;

  const recoveryYears = new Set(firstPos.recoveryYears ?? []);
  for (const pos of attachments) {
    for (const year of pos.recoveryYears ?? []) recoveryYears.add(year);
  }

  return {
    ...firstPos,
    catchCount: firstPos.catchCount + attachments.reduce((sum, pos) => sum + pos.catchCount, 0),
    numRecords: firstPos.numRecords + attachments.reduce((sum, pos) => sum + pos.numRecords, 0),
    recoveryYears: Array.from(recoveryYears).sort((a, b) => a - b),
    sourceWeekLabels: positionWeekLabels(firstPos),
    sourceWeekSummaries: [
      ...positionWeekSummaries(firstPos),
      ...attachments.flatMap(positionWeekSummaries),
    ],
    catchEvents: [
      ...(firstPos.catchEvents ?? []),
      ...attachments.flatMap(pos => pos.catchEvents ?? []),
    ],
  };
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const la1 = lat1 * Math.PI / 180;
  const la2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function emptyBounds(): BoundaryBounds {
  return {
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
    minLng: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
  };
}

function extendBounds(bounds: BoundaryBounds, point: LatLngPoint) {
  bounds.minLat = Math.min(bounds.minLat, point.lat);
  bounds.maxLat = Math.max(bounds.maxLat, point.lat);
  bounds.minLng = Math.min(bounds.minLng, point.lng);
  bounds.maxLng = Math.max(bounds.maxLng, point.lng);
}

function pointWithinBounds(point: LatLngPoint, bounds: BoundaryBounds, pad = 0): boolean {
  return point.lat >= bounds.minLat - pad &&
    point.lat <= bounds.maxLat + pad &&
    point.lng >= bounds.minLng - pad &&
    point.lng <= bounds.maxLng + pad;
}

function spatialGridRange(min: number, max: number, origin: number, step: number): [number, number] {
  return [
    Math.floor((min - origin) / step),
    Math.floor((max - origin) / step),
  ];
}

function spatialGridKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function canvasX(point: LatLngPoint, bounds: BoundaryBounds): number {
  return (point.lng - bounds.minLng) * PWS_BOUNDARY_CANVAS_SCALE;
}

function canvasY(point: LatLngPoint, bounds: BoundaryBounds): number {
  return (point.lat - bounds.minLat) * PWS_BOUNDARY_CANVAS_SCALE;
}

function createBoundaryCanvasContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  return canvas.getContext('2d');
}

function createPolygonPath(rings: BoundaryRing[], bounds: BoundaryBounds): Path2D | undefined {
  if (typeof Path2D === 'undefined') return undefined;

  const path = new Path2D();
  for (const ring of rings) {
    const first = ring.points[0];
    if (!first) continue;
    path.moveTo(canvasX(first, bounds), canvasY(first, bounds));
    for (let i = 1; i < ring.points.length; i++) {
      const point = ring.points[i];
      path.lineTo(canvasX(point, bounds), canvasY(point, bounds));
    }
    path.closePath();
  }
  return path;
}

function boundaryRingFromGeoJson(rawRing: GeoJsonPosition[]): BoundaryRing | null {
  const points = rawRing
    .map(([lng, lat]) => ({ lat, lng }))
    .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (points.length < 4) return null;

  const ringBounds = emptyBounds();
  for (const point of points) {
    extendBounds(ringBounds, point);
  }
  return { points, bounds: ringBounds };
}

function addBoundaryPolygon(
  rawRings: GeoJsonPosition[][],
  polygons: BoundaryPolygon[],
  rings: BoundaryRing[],
  globalBounds: BoundaryBounds
) {
  const polygonRings: BoundaryRing[] = [];
  const polygonBounds = emptyBounds();

  for (const rawRing of rawRings) {
    const ring = boundaryRingFromGeoJson(rawRing);
    if (!ring) continue;
    polygonRings.push(ring);
    rings.push(ring);
    for (const point of ring.points) {
      extendBounds(polygonBounds, point);
      extendBounds(globalBounds, point);
    }
  }

  if (polygonRings.length > 0 && Number.isFinite(polygonBounds.minLat)) {
    polygons.push({ rings: polygonRings, bounds: polygonBounds });
  }
}

function buildBoundarySegmentGrid(rings: BoundaryRing[], bounds: BoundaryBounds): Map<string, BoundarySegment[]> {
  const grid = new Map<string, BoundarySegment[]>();

  for (const ring of rings) {
    for (let i = 0; i < ring.points.length - 1; i++) {
      const from = ring.points[i];
      const to = ring.points[i + 1];
      const segmentBounds: BoundaryBounds = {
        minLat: Math.min(from.lat, to.lat),
        maxLat: Math.max(from.lat, to.lat),
        minLng: Math.min(from.lng, to.lng),
        maxLng: Math.max(from.lng, to.lng),
      };
      const segment: BoundarySegment = { from, to, bounds: segmentBounds };
      const [minRow, maxRow] = spatialGridRange(segmentBounds.minLat, segmentBounds.maxLat, bounds.minLat, PWS_BOUNDARY_SEGMENT_LAT_STEP);
      const [minCol, maxCol] = spatialGridRange(segmentBounds.minLng, segmentBounds.maxLng, bounds.minLng, PWS_BOUNDARY_SEGMENT_LNG_STEP);
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const key = spatialGridKey(row, col);
          const bucket = grid.get(key);
          if (bucket) {
            bucket.push(segment);
          } else {
            grid.set(key, [segment]);
          }
        }
      }
    }
  }

  return grid;
}

function parsePwsBoundary(
  collection: GeoJsonFeatureCollection,
  id = 'pws',
  options: BoundaryParseOptions = {}
): PwsBoundary | null {
  const polygons: BoundaryPolygon[] = [];
  const rings: BoundaryRing[] = [];
  const bounds = emptyBounds();

  for (const feature of collection.features ?? []) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === 'Polygon') {
      addBoundaryPolygon(geometry.coordinates, polygons, rings, bounds);
    } else {
      for (const polygon of geometry.coordinates) {
        addBoundaryPolygon(polygon, polygons, rings, bounds);
      }
    }
  }

  if (polygons.length === 0 || !Number.isFinite(bounds.minLat)) return null;
  if (options.buildPaths !== false) {
    for (const polygon of polygons) {
      polygon.path = createPolygonPath(polygon.rings, bounds);
    }
  }

  return {
    id,
    polygons,
    rings,
    bounds,
    southernOpenLat: bounds.minLat + 0.02,
    canvasContext: createBoundaryCanvasContext(),
    segmentGrid: options.buildSegmentGrid ? buildBoundarySegmentGrid(rings, bounds) : new Map(),
    routingEnabled: options.routingEnabled === true,
  };
}

const regionBoundaryPromises = new Map<string, Promise<PwsBoundary | null>>();
const routeGraphPromises = new Map<string, Promise<PwsRouteGraph | null>>();
const pwsAllowedPointCache = new WeakMap<PwsBoundary, Map<string, boolean>>();
const pwsSegmentAllowanceCache = new WeakMap<PwsBoundary, Map<string, boolean>>();

function allowedPointCacheKey(point: LatLngPoint): string {
  return `${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`;
}

function segmentAllowanceCacheKey(mode: 'water' | 'strict' | 'endpoint', from: LatLngPoint, to: LatLngPoint): string {
  const a = allowedPointCacheKey(from);
  const b = allowedPointCacheKey(to);
  return a < b ? `${mode}:${a}>${b}` : `${mode}:${b}>${a}`;
}

function cachedSegmentAllowance(
  boundary: PwsBoundary,
  key: string,
  compute: () => boolean
): boolean {
  let cache = pwsSegmentAllowanceCache.get(boundary);
  if (!cache) {
    cache = new Map<string, boolean>();
    pwsSegmentAllowanceCache.set(boundary, cache);
  }
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const allowed = compute();
  cache.set(key, allowed);
  return allowed;
}

function loadRouteGraph(url: string): Promise<PwsRouteGraph | null> {
  if (!routeGraphPromises.has(url)) {
    routeGraphPromises.set(url, fetch(url)
      .then(response => response.ok ? response.json() as Promise<PwsRouteGraph> : null)
      .catch(() => null));
  }
  return routeGraphPromises.get(url)!;
}

function boundaryConfigForRegion(region?: string | null) {
  return region ? REGION_BOUNDARY_CONFIGS[region] : undefined;
}

function loadRegionBoundary(region?: string | null): Promise<PwsBoundary | null> {
  const config = boundaryConfigForRegion(region);
  if (!config) return Promise.resolve(null);

  if (!regionBoundaryPromises.has(config.id)) {
    const routeGraphPromise = config.routeGraphUrl
      ? loadRouteGraph(config.routeGraphUrl)
      : Promise.resolve(null);
    regionBoundaryPromises.set(config.id, Promise.all([
      fetch(config.url)
        .then(response => response.ok ? response.json() as Promise<GeoJsonFeatureCollection> : null),
      routeGraphPromise,
    ])
      .then(([collection, routeGraph]) => {
        const routingEnabled = config.routingEnabled === true || Boolean(routeGraph);
        const boundary = collection ? parsePwsBoundary(collection, config.id, {
          buildSegmentGrid: config.buildSegmentGrid === true,
          buildPaths: true,
          routingEnabled,
        }) : null;
        if (boundary && routeGraph) boundary.routeGraph = routeGraph;
        return boundary;
      })
      .catch(() => null));
  }
  return regionBoundaryPromises.get(config.id)!;
}

function useMovementBoundaries(primaryRegion?: string | null): MovementBoundaryContext {
  const [context, setContext] = useState<MovementBoundaryContext>({
    primary: null,
    all: [],
    isLoading: false,
    hasBoundaryConfig: false,
  });

  useEffect(() => {
    let active = true;
    const hasBoundaryConfig = Boolean(boundaryConfigForRegion(primaryRegion));
    setContext({ primary: null, all: [], isLoading: hasBoundaryConfig, hasBoundaryConfig });

    loadRegionBoundary(primaryRegion).then(primary => {
      if (!active) return;
      setContext({
        primary,
        all: primary ? [primary] : [],
        isLoading: false,
        hasBoundaryConfig,
      });
    });

    return () => {
      active = false;
    };
  }, [primaryRegion]);

  return context;
}

function pointInRing(point: LatLngPoint, ring: BoundaryRing): boolean {
  if (!pointWithinBounds(point, ring.bounds)) return false;

  let inside = false;
  const { points } = ring;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const current = points[i];
    const previous = points[j];
    const intersects = (current.lat > point.lat) !== (previous.lat > point.lat) &&
      point.lng < (previous.lng - current.lng) * (point.lat - current.lat) /
      ((previous.lat - current.lat) || Number.EPSILON) + current.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInBoundary(point: LatLngPoint, boundary: PwsBoundary): boolean {
  if (!pointWithinBounds(point, boundary.bounds, 0.001)) return false;

  for (const polygon of boundary.polygons) {
    if (!pointWithinBounds(point, polygon.bounds)) continue;
    if (boundary.canvasContext && polygon.path) {
      if (boundary.canvasContext.isPointInPath(
        polygon.path,
        canvasX(point, boundary.bounds),
        canvasY(point, boundary.bounds),
        'evenodd'
      )) {
        return true;
      }
      continue;
    }

    const [outerRing, ...holeRings] = polygon.rings;
    if (!outerRing || !pointInRing(point, outerRing)) continue;
    if (holeRings.some(ring => pointInRing(point, ring))) continue;
    return true;
  }

  return false;
}

function pointToSegmentDistanceKm(point: LatLngPoint, a: LatLngPoint, b: LatLngPoint): number {
  const latKm = 110.574;
  const lngKm = Math.max(20, 111.32 * Math.cos(point.lat * Math.PI / 180));
  const ax = (a.lng - point.lng) * lngKm;
  const ay = (a.lat - point.lat) * latKm;
  const bx = (b.lng - point.lng) * lngKm;
  const by = (b.lat - point.lat) * latKm;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq <= 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSq));
  const px = ax + dx * t;
  const py = ay + dy * t;
  return Math.hypot(px, py);
}

function pointNearBoundaryEdge(point: LatLngPoint, boundary: PwsBoundary, toleranceKm: number): boolean {
  if (boundary.segmentGrid.size === 0) return false;
  if (!pointWithinBounds(point, boundary.bounds, 0.03)) return false;

  const latPad = toleranceKm / 110.574 + PWS_BOUNDARY_SEGMENT_LAT_STEP;
  const lngKm = Math.max(20, 111.32 * Math.cos(point.lat * Math.PI / 180));
  const lngPad = toleranceKm / lngKm + PWS_BOUNDARY_SEGMENT_LNG_STEP;
  const [minRow, maxRow] = spatialGridRange(
    point.lat - latPad,
    point.lat + latPad,
    boundary.bounds.minLat,
    PWS_BOUNDARY_SEGMENT_LAT_STEP
  );
  const [minCol, maxCol] = spatialGridRange(
    point.lng - lngPad,
    point.lng + lngPad,
    boundary.bounds.minLng,
    PWS_BOUNDARY_SEGMENT_LNG_STEP
  );
  const checkedSegments = new Set<BoundarySegment>();

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const candidates = boundary.segmentGrid.get(spatialGridKey(row, col));
      if (!candidates) continue;
      for (const segment of candidates) {
        if (checkedSegments.has(segment)) continue;
        checkedSegments.add(segment);
        if (!pointWithinBounds(point, segment.bounds, Math.max(latPad, lngPad))) continue;
        if (pointToSegmentDistanceKm(point, segment.from, segment.to) <= toleranceKm) return true;
      }
    }
  }

  return false;
}

function supportsWaterRouting(boundary: PwsBoundary | null | undefined): boundary is PwsBoundary {
  return Boolean(boundary?.routingEnabled);
}

function pointInsideSouthernOpenWater(point: LatLngPoint, boundary: PwsBoundary): boolean {
  if (boundary.id !== 'pws') return false;
  return point.lat <= boundary.southernOpenLat &&
    point.lng >= boundary.bounds.minLng - 0.8 &&
    point.lng <= boundary.bounds.maxLng + 0.8;
}

function isAllowedPwsWaterPoint(point: LatLngPoint, boundary: PwsBoundary): boolean {
  if (pointInsideSouthernOpenWater(point, boundary)) return true;
  if (!pointWithinBounds(point, boundary.bounds, 0.03)) return false;

  let cache = pwsAllowedPointCache.get(boundary);
  if (!cache) {
    cache = new Map<string, boolean>();
    pwsAllowedPointCache.set(boundary, cache);
  }
  const key = allowedPointCacheKey(point);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const allowed = pointInBoundary(point, boundary);
  const edgeToleranceKm = boundary.id === 'pws' ? 0 : 0.85;
  const edgeAllowed = !allowed && edgeToleranceKm > 0
    ? pointNearBoundaryEdge(point, boundary, edgeToleranceKm)
    : false;
  cache.set(key, allowed || edgeAllowed);
  return allowed || edgeAllowed;
}

function isPwsRelevantSegment(from: LatLngPoint, to: LatLngPoint, boundary: PwsBoundary): boolean {
  const expanded = {
    minLat: boundary.bounds.minLat - 0.9,
    maxLat: boundary.bounds.maxLat + 0.45,
    minLng: boundary.bounds.minLng - 0.8,
    maxLng: boundary.bounds.maxLng + 0.8,
  };
  return pointWithinBounds(from, expanded) || pointWithinBounds(to, expanded);
}

function interpolatePoint(from: LatLngPoint, to: LatLngPoint, progress: number): LatLngPoint {
  return {
    lat: from.lat + (to.lat - from.lat) * progress,
    lng: from.lng + (to.lng - from.lng) * progress,
  };
}

function segmentBoundsIntersect(a: BoundaryBounds, b: BoundaryBounds): boolean {
  return a.minLat <= b.maxLat &&
    a.maxLat >= b.minLat &&
    a.minLng <= b.maxLng &&
    a.maxLng >= b.minLng;
}

function pointOnSegment(point: LatLngPoint, a: LatLngPoint, b: LatLngPoint): boolean {
  const cross = (point.lng - a.lng) * (b.lat - a.lat) - (point.lat - a.lat) * (b.lng - a.lng);
  if (Math.abs(cross) > 1e-10) return false;
  return point.lat >= Math.min(a.lat, b.lat) - 1e-10 &&
    point.lat <= Math.max(a.lat, b.lat) + 1e-10 &&
    point.lng >= Math.min(a.lng, b.lng) - 1e-10 &&
    point.lng <= Math.max(a.lng, b.lng) + 1e-10;
}

function orientation(a: LatLngPoint, b: LatLngPoint, c: LatLngPoint): number {
  const value = (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  if (Math.abs(value) < 1e-10) return 0;
  return value > 0 ? 1 : -1;
}

function segmentsIntersect(a: LatLngPoint, b: LatLngPoint, c: LatLngPoint, d: LatLngPoint): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(c, a, b)) return true;
  if (o2 === 0 && pointOnSegment(d, a, b)) return true;
  if (o3 === 0 && pointOnSegment(a, c, d)) return true;
  if (o4 === 0 && pointOnSegment(b, c, d)) return true;
  return false;
}

function segmentIntersectionProgress(a: LatLngPoint, b: LatLngPoint, c: LatLngPoint, d: LatLngPoint): number | null {
  const rx = b.lng - a.lng;
  const ry = b.lat - a.lat;
  const sx = d.lng - c.lng;
  const sy = d.lat - c.lat;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-12) return null;

  const qpx = c.lng - a.lng;
  const qpy = c.lat - a.lat;
  const progress = (qpx * sy - qpy * sx) / denom;
  return Number.isFinite(progress) ? progress : null;
}

function segmentAllowedByBoundary(from: LatLngPoint, to: LatLngPoint, boundary: PwsBoundary): boolean {
  return cachedSegmentAllowance(
    boundary,
    segmentAllowanceCacheKey('water', from, to),
    () => {
      const dist = distanceKm(from.lat, from.lng, to.lat, to.lng);
      const samples = Math.max(3, Math.ceil(dist / PWS_ROUTE_SAMPLE_KM));
      for (let i = 0; i <= samples; i++) {
        const point = interpolatePoint(from, to, i / samples);
        if (!isAllowedPwsWaterPoint(point, boundary)) return false;
      }
      return true;
    }
  );
}

function segmentCrossesHardBoundary(from: LatLngPoint, to: LatLngPoint, boundary: PwsBoundary): boolean {
  if (pointInsideSouthernOpenWater(from, boundary) && pointInsideSouthernOpenWater(to, boundary)) return false;

  const segmentBounds: BoundaryBounds = {
    minLat: Math.min(from.lat, to.lat),
    maxLat: Math.max(from.lat, to.lat),
    minLng: Math.min(from.lng, to.lng),
    maxLng: Math.max(from.lng, to.lng),
  };
  const dist = distanceKm(from.lat, from.lng, to.lat, to.lng);
  const probeProgress = Math.min(0.035, Math.max(0.0015, 0.12 / Math.max(dist, 0.5)));
  const [minRow, maxRow] = spatialGridRange(segmentBounds.minLat, segmentBounds.maxLat, boundary.bounds.minLat, PWS_BOUNDARY_SEGMENT_LAT_STEP);
  const [minCol, maxCol] = spatialGridRange(segmentBounds.minLng, segmentBounds.maxLng, boundary.bounds.minLng, PWS_BOUNDARY_SEGMENT_LNG_STEP);
  const checkedSegments = new Set<BoundarySegment>();

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const candidates = boundary.segmentGrid.get(spatialGridKey(row, col));
      if (!candidates) continue;

      for (const segment of candidates) {
        if (checkedSegments.has(segment)) continue;
        checkedSegments.add(segment);
        if (!segmentBoundsIntersect(segmentBounds, segment.bounds)) continue;
        if (!segmentsIntersect(from, to, segment.from, segment.to)) continue;

        const progress = segmentIntersectionProgress(from, to, segment.from, segment.to);
      if (progress == null || progress <= 0.0005 || progress >= 0.9995) continue;

      const before = interpolatePoint(from, to, Math.max(0, progress - probeProgress));
      const after = interpolatePoint(from, to, Math.min(1, progress + probeProgress));
      if (!isAllowedPwsWaterPoint(before, boundary) || !isAllowedPwsWaterPoint(after, boundary)) {
        return true;
      }
      }
    }
  }

  return false;
}

function segmentAllowedStrict(from: LatLngPoint, to: LatLngPoint, boundary: PwsBoundary): boolean {
  return cachedSegmentAllowance(
    boundary,
    segmentAllowanceCacheKey('strict', from, to),
    () => {
      if (!segmentAllowedByBoundary(from, to, boundary)) return false;
      return !segmentCrossesHardBoundary(from, to, boundary);
    }
  );
}

function endpointSegmentAllowed(from: LatLngPoint, to: LatLngPoint, boundary: PwsBoundary): boolean {
  return cachedSegmentAllowance(
    boundary,
    segmentAllowanceCacheKey('endpoint', from, to),
    () => {
      const fromAllowed = isAllowedPwsWaterPoint(from, boundary);
      const toAllowed = isAllowedPwsWaterPoint(to, boundary);
      if (fromAllowed && toAllowed) return segmentAllowedStrict(from, to, boundary);

      const dist = distanceKm(from.lat, from.lng, to.lat, to.lng);
      const maxEndpointDistanceKm = boundary.id === 'pws' ? 7 : 24;
      if (dist > maxEndpointDistanceKm) return false;
      const samples = Math.max(3, Math.ceil(dist / 0.5));
      const shoreSkipFraction = boundary.id === 'pws'
        ? Math.min(0.45, Math.max(0.18, 2.5 / Math.max(dist, 0.5)))
        : Math.min(0.62, Math.max(0.24, 6 / Math.max(dist, 0.5)));
      let passedThroughWater = false;
      for (let i = 1; i < samples; i++) {
        const progress = i / samples;
        const point = interpolatePoint(from, to, i / samples);
        const allowed = isAllowedPwsWaterPoint(point, boundary);
        if (allowed) {
          passedThroughWater = true;
          continue;
        }
        if (!fromAllowed && progress <= shoreSkipFraction) continue;
        if (!toAllowed && progress >= 1 - shoreSkipFraction) continue;
        return false;
      }
      return passedThroughWater;
    }
  );
}

function routeCacheKey(from: LatLngPoint, to: LatLngPoint, boundary: PwsBoundary): string {
  return `${PWS_ROUTE_CACHE_VERSION}:${boundary.id}:${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
}

const pwsRouteCache = new Map<string, LatLngPoint[]>();
const pathLengthCache = new WeakMap<LatLngPoint[], number>();

let pwsRouteGraphCache: { boundary: PwsBoundary; graph: PwsRouteGraph } | null = null;

function connectGraphEdge(graph: PwsRouteGraph, fromIndex: number, toIndex: number) {
  const from = graph.nodes[fromIndex];
  const to = graph.nodes[toIndex];
  const weight = distanceKm(from.lat, from.lng, to.lat, to.lng);
  graph.edges[fromIndex].push({ to: toIndex, weight });
  graph.edges[toIndex].push({ to: fromIndex, weight });
}

function buildPwsRouteGraph(boundary: PwsBoundary): PwsRouteGraph {
  if (boundary.routeGraph) return boundary.routeGraph;
  if (pwsRouteGraphCache?.boundary === boundary) return pwsRouteGraphCache.graph;

  const nodes: PwsGraphNode[] = [];
  const edges: Array<Array<{ to: number; weight: number }>> = [];
  const gridIndex = new Map<string, number>();
  const routeNodeIndex = new Map<string, number>();

  function addNode(node: PwsGraphNode): number {
    const index = nodes.length;
    nodes.push(node);
    edges.push([]);
    if (node.id) routeNodeIndex.set(node.id, index);
    return index;
  }

  let row = 0;
  for (let lat = boundary.bounds.minLat; lat <= boundary.bounds.maxLat; lat += PWS_GRID_LAT_STEP, row++) {
    let col = 0;
    for (let lng = boundary.bounds.minLng; lng <= boundary.bounds.maxLng; lng += PWS_GRID_LNG_STEP, col++) {
      const point = { lat, lng };
      if (!isAllowedPwsWaterPoint(point, boundary)) continue;
      const index = addNode(point);
      gridIndex.set(`${row}:${col}`, index);
    }
  }

  for (const node of PWS_WATER_ROUTE_NODES) {
    if (!isAllowedPwsWaterPoint(node, boundary)) continue;
    addNode(node);
  }

  const graph: PwsRouteGraph = { nodes, edges };
  const neighborOffsets = [
    [1, 0], [0, 1], [1, 1], [1, -1],
    [2, 0], [0, 2], [2, 1], [1, 2], [2, -1], [1, -2],
    [2, 2], [2, -2],
  ];

  for (const [key, index] of gridIndex) {
    const [rowText, colText] = key.split(':');
    const r = Number(rowText);
    const c = Number(colText);
    for (const [dr, dc] of neighborOffsets) {
      const neighbor = gridIndex.get(`${r + dr}:${c + dc}`);
      if (neighbor == null) continue;
      if (!segmentAllowedByBoundary(nodes[index], nodes[neighbor], boundary)) continue;
      connectGraphEdge(graph, index, neighbor);
    }
  }

  for (const [fromId, toId] of PWS_ROUTE_EDGES) {
    const fromIndex = routeNodeIndex.get(fromId);
    const toIndex = routeNodeIndex.get(toId);
    if (fromIndex == null || toIndex == null) continue;
    if (!segmentAllowedStrict(nodes[fromIndex], nodes[toIndex], boundary)) continue;
    connectGraphEdge(graph, fromIndex, toIndex);
  }

  for (const [, routeIndex] of routeNodeIndex) {
    for (const candidate of nearestGraphNodes(nodes[routeIndex], graph, 10, 7)) {
      if (candidate.index === routeIndex) continue;
      if (!segmentAllowedStrict(nodes[routeIndex], nodes[candidate.index], boundary)) continue;
      connectGraphEdge(graph, routeIndex, candidate.index);
    }
  }

  pwsRouteGraphCache = { boundary, graph };
  return graph;
}

function nearestGraphNodes(
  point: LatLngPoint,
  graph: PwsRouteGraph,
  count: number,
  maxDistanceKm = PWS_ROUTE_ENDPOINT_EDGE_KM
): Array<{ index: number; distance: number }> {
  return graph.nodes
    .map((node, index) => ({
      index,
      distance: distanceKm(point.lat, point.lng, node.lat, node.lng),
    }))
    .filter(item => item.distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

function connectEndpointToGraph(
  endpointIndex: number,
  endpoint: LatLngPoint,
  graph: PwsRouteGraph,
  boundary: PwsBoundary,
  virtualEdges: Map<number, Array<{ to: number; weight: number }>>
) {
  const regionalGraph = boundary.id !== 'pws';
  const candidates = nearestGraphNodes(
    endpoint,
    graph,
    regionalGraph ? 96 : 18,
    regionalGraph ? 120 : PWS_ROUTE_ENDPOINT_EDGE_KM
  );
  const accepted: Array<{ to: number; weight: number }> = [];
  for (const candidate of candidates) {
    const node = graph.nodes[candidate.index];
    if (!endpointSegmentAllowed(endpoint, node, boundary)) continue;
    accepted.push({ to: candidate.index, weight: candidate.distance });
    const nodeEdges = virtualEdges.get(candidate.index) ?? [];
    nodeEdges.push({ to: endpointIndex, weight: candidate.distance });
    virtualEdges.set(candidate.index, nodeEdges);
    if (accepted.length >= (regionalGraph ? 14 : 8)) break;
  }
  virtualEdges.set(endpointIndex, accepted);
}

function heapPush(heap: Array<{ index: number; priority: number }>, item: { index: number; priority: number }) {
  heap.push(item);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent].priority <= item.priority) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = item;
}

function heapPop(heap: Array<{ index: number; priority: number }>): { index: number; priority: number } | undefined {
  if (heap.length === 0) return undefined;
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    let index = 0;
    while (true) {
      let child = index * 2 + 1;
      if (child >= heap.length) break;
      if (child + 1 < heap.length && heap[child + 1].priority < heap[child].priority) child++;
      if (heap[child].priority >= last.priority) break;
      heap[index] = heap[child];
      index = child;
    }
    heap[index] = last;
  }
  return top;
}

function shortestPwsWaterRoute(from: LatLngPoint, to: LatLngPoint, boundary: PwsBoundary): LatLngPoint[] | null {
  const graph = buildPwsRouteGraph(boundary);
  const startIndex = graph.nodes.length;
  const endIndex = graph.nodes.length + 1;
  const routeNodes = [...graph.nodes, from, to];
  const virtualEdges = new Map<number, Array<{ to: number; weight: number }>>();
  connectEndpointToGraph(startIndex, from, graph, boundary, virtualEdges);
  connectEndpointToGraph(endIndex, to, graph, boundary, virtualEdges);
  if ((virtualEdges.get(startIndex)?.length ?? 0) === 0 || (virtualEdges.get(endIndex)?.length ?? 0) === 0) {
    return null;
  }

  const distances = routeNodes.map((_, index) => index === startIndex ? 0 : Number.POSITIVE_INFINITY);
  const previous = routeNodes.map(() => -1);
  const heap: Array<{ index: number; priority: number }> = [];
  heapPush(heap, { index: startIndex, priority: 0 });

  while (heap.length > 0) {
    const current = heapPop(heap)!;
    if (current.index === endIndex) break;
    if (current.priority > distances[current.index] + distanceKm(routeNodes[current.index].lat, routeNodes[current.index].lng, to.lat, to.lng) + 0.001) {
      continue;
    }

    const neighbors = current.index < graph.nodes.length
      ? [...graph.edges[current.index], ...(virtualEdges.get(current.index) ?? [])]
      : virtualEdges.get(current.index) ?? [];
    for (const edge of neighbors) {
      const nextDistance = distances[current.index] + edge.weight;
      if (nextDistance >= distances[edge.to]) continue;
      distances[edge.to] = nextDistance;
      previous[edge.to] = current.index;
      const heuristic = distanceKm(routeNodes[edge.to].lat, routeNodes[edge.to].lng, to.lat, to.lng);
      heapPush(heap, { index: edge.to, priority: nextDistance + heuristic });
    }
  }

  if (!Number.isFinite(distances[endIndex])) return null;

  const route: LatLngPoint[] = [];
  for (let current = endIndex; current >= 0; current = previous[current]) {
    route.push(routeNodes[current]);
    if (current === startIndex) break;
  }
  return route.reverse();
}

function simplifiedPwsRoute(path: LatLngPoint[], boundary: PwsBoundary): LatLngPoint[] {
  if (path.length < 3) return path;

  const simplified: LatLngPoint[] = [path[0]];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let nextAnchor = anchor + 1;
    for (let candidate = path.length - 1; candidate > anchor + 1; candidate--) {
      const isEndpointLeg = anchor === 0 || candidate === path.length - 1;
      const allowed = isEndpointLeg
        ? endpointSegmentAllowed(path[anchor], path[candidate], boundary)
        : segmentAllowedStrict(path[anchor], path[candidate], boundary);
      if (!allowed) continue;
      nextAnchor = candidate;
      break;
    }
    simplified.push(path[nextAnchor]);
    anchor = nextAnchor;
  }

  return simplified;
}

function routeSegmentsSafe(path: LatLngPoint[], boundary: PwsBoundary): boolean {
  if (path.length < 2) return false;
  for (let i = 0; i < path.length - 1; i++) {
    const isEndpointLeg = i === 0 || i === path.length - 2;
    const allowed = isEndpointLeg
      ? endpointSegmentAllowed(path[i], path[i + 1], boundary)
      : segmentAllowedStrict(path[i], path[i + 1], boundary);
    if (!allowed) return false;
  }
  return true;
}

function smoothSafePwsRoute(path: LatLngPoint[], boundary: PwsBoundary): LatLngPoint[] {
  if (path.length < 3) return path;

  let smoothed = path;
  for (let pass = 0; pass < 2; pass++) {
    const candidate: LatLngPoint[] = [smoothed[0]];
    for (let i = 0; i < smoothed.length - 1; i++) {
      const from = smoothed[i];
      const to = smoothed[i + 1];
      candidate.push({
        lat: from.lat * 0.75 + to.lat * 0.25,
        lng: from.lng * 0.75 + to.lng * 0.25,
      });
      candidate.push({
        lat: from.lat * 0.25 + to.lat * 0.75,
        lng: from.lng * 0.25 + to.lng * 0.75,
      });
    }
    candidate.push(smoothed[smoothed.length - 1]);
    if (!routeSegmentsSafe(candidate, boundary)) break;
    smoothed = candidate;
  }

  return smoothed;
}

function routeWaterPath(from: LatLngPoint, to: LatLngPoint, boundary: PwsBoundary | null): LatLngPoint[] {
  if (!supportsWaterRouting(boundary) || !isPwsRelevantSegment(from, to, boundary)) return [from, to];

  const cacheKey = routeCacheKey(from, to, boundary);
  const cached = pwsRouteCache.get(cacheKey);
  if (cached) return cached;

  const directDistance = distanceKm(from.lat, from.lng, to.lat, to.lng);
  const usesPrebuiltRegionalGraph = boundary.id !== 'pws' && Boolean(boundary.routeGraph);
  const shouldCheckDirect = !usesPrebuiltRegionalGraph || directDistance <= PWS_DIRECT_SHORT_KM;
  const directAllowed = shouldCheckDirect
    ? directDistance <= PWS_DIRECT_SHORT_KM
      ? endpointSegmentAllowed(from, to, boundary)
      : segmentAllowedStrict(from, to, boundary)
    : false;
  if (directAllowed) {
    const direct = [from, to];
    pwsRouteCache.set(cacheKey, direct);
    return direct;
  }

  const routed = shortestPwsWaterRoute(from, to, boundary);
  if (usesPrebuiltRegionalGraph) {
    const regionalRoute = routed && routed.length >= 2
      ? routed
      : endpointSegmentAllowed(from, to, boundary) ? [from, to] : [from];
    pwsRouteCache.set(cacheKey, regionalRoute);
    return regionalRoute;
  }

  const simplified = routed ? simplifiedPwsRoute(routed, boundary) : null;
  const safeRoute = simplified && routeSegmentsSafe(simplified, boundary)
    ? simplified
    : routed && routeSegmentsSafe(routed, boundary)
      ? routed
      : endpointSegmentAllowed(from, to, boundary) ? [from, to] : [from];
  const finalRoute = safeRoute.length >= 3 ? smoothSafePwsRoute(safeRoute, boundary) : safeRoute;

  pwsRouteCache.set(cacheKey, finalRoute);
  return finalRoute;
}

function pointOutsidePwsBoundary(point: LatLngPoint, boundary: PwsBoundary | null): boolean {
  return Boolean(boundary && !isAllowedPwsWaterPoint(point, boundary));
}

function pointInsideAnyBoundary(point: LatLngPoint, context: MovementBoundaryContext): boolean {
  if (context.all.length === 0) return true;
  return context.all.some(boundary => isAllowedPwsWaterPoint(point, boundary));
}

function pointInsideConfiguredBoundary(point: LatLngPoint, context: MovementBoundaryContext): boolean {
  if (!context.hasBoundaryConfig) return true;
  if (context.all.length === 0) return false;
  return pointInsideAnyBoundary(point, context);
}

function routeBoundaryForLeg(
  from: LatLngPoint,
  to: LatLngPoint,
  context: MovementBoundaryContext
): PwsBoundary | null {
  if (supportsWaterRouting(context.primary) &&
    isPwsRelevantSegment(from, to, context.primary) &&
    (
      isAllowedPwsWaterPoint(from, context.primary) ||
      isAllowedPwsWaterPoint(to, context.primary)
    )
  ) {
    return context.primary;
  }

  return null;
}

function movementLegPath(
  from: LatLngPoint,
  to: LatLngPoint,
  context: MovementBoundaryContext,
  isReturn: boolean
): { route: LatLngPoint[]; isOutOfBoundary: boolean } {
  const routeBoundary = routeBoundaryForLeg(from, to, context);
  if (!routeBoundary) {
    if (!isReturn && (!pointInsideAnyBoundary(from, context) || !pointInsideAnyBoundary(to, context))) {
      return { route: [from, to], isOutOfBoundary: true };
    }
    return { route: [from, to], isOutOfBoundary: false };
  }

  if (!isPwsRelevantSegment(from, to, routeBoundary)) {
    return { route: [from, to], isOutOfBoundary: false };
  }

  const outOfBoundary = !isReturn &&
    (pointOutsidePwsBoundary(from, routeBoundary) || pointOutsidePwsBoundary(to, routeBoundary));

  const route = routeWaterPath(from, to, routeBoundary);
  if (route.length >= 2 && pathLengthKm(route) >= 0.05) {
    return { route, isOutOfBoundary: outOfBoundary };
  }

  return {
    route: [from, to],
    isOutOfBoundary: !isReturn,
  };
}

function pathLengthKm(path: LatLngPoint[]): number {
  const cached = pathLengthCache.get(path);
  if (cached !== undefined) return cached;

  let length = 0;
  for (let i = 0; i < path.length - 1; i++) {
    length += distanceKm(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
  }
  pathLengthCache.set(path, length);
  return length;
}

function interpolateAlongPath(path: LatLngPoint[], progress: number): { point: LatLngPoint; brng: number } {
  const first = path[0] ?? { lat: 0, lng: 0 };
  if (path.length < 2) return { point: first, brng: 0 };

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const totalLength = pathLengthKm(path);
  if (totalLength <= 0) {
    return {
      point: path[path.length - 1],
      brng: bearing(first.lat, first.lng, path[path.length - 1].lat, path[path.length - 1].lng),
    };
  }

  let traversed = 0;
  const target = totalLength * clampedProgress;
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const segmentLength = distanceKm(from.lat, from.lng, to.lat, to.lng);
    if (traversed + segmentLength >= target) {
      const localProgress = segmentLength <= 0 ? 1 : (target - traversed) / segmentLength;
      return {
        point: interpolatePoint(from, to, localProgress),
        brng: bearing(from.lat, from.lng, to.lat, to.lng),
      };
    }
    traversed += segmentLength;
  }

  const last = path[path.length - 1];
  const previous = path[path.length - 2];
  return {
    point: last,
    brng: bearing(previous.lat, previous.lng, last.lat, last.lng),
  };
}

function slicePathToProgress(path: LatLngPoint[], progress: number): LatLngPoint[] {
  if (progress >= 1 || path.length < 2) return path;
  if (progress <= 0) return [path[0]];

  const totalLength = pathLengthKm(path);
  const target = totalLength * progress;
  const sliced: LatLngPoint[] = [path[0]];
  let traversed = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const segmentLength = distanceKm(from.lat, from.lng, to.lat, to.lng);
    if (traversed + segmentLength >= target) {
      const localProgress = segmentLength <= 0 ? 1 : (target - traversed) / segmentLength;
      sliced.push(interpolatePoint(from, to, localProgress));
      return sliced;
    }
    sliced.push(to);
    traversed += segmentLength;
  }

  return sliced;
}

function formatRecoveryYears(years: number[] | undefined): string {
  if (!years || years.length === 0) return '';
  const sorted = Array.from(new Set(years)).sort((a, b) => a - b);
  if (sorted.length === 1) return `Year: ${sorted[0]}`;
  if (sorted.length <= 12) return `Years: ${sorted.join(', ')}`;
  return `Years: ${sorted[0]}-${sorted[sorted.length - 1]} (${sorted.length} years)`;
}

function formatRecoveryYearRange(years: number[] | undefined): string {
  if (!years || years.length === 0) return '';
  const sorted = Array.from(new Set(years)).sort((a, b) => a - b);
  if (sorted.length === 1) return `Year: ${sorted[0]}`;
  return `Years: ${sorted[0]}-${sorted[sorted.length - 1]}`;
}

function formatRecoveryYearsCompact(years: number[] | undefined): string {
  if (!years || years.length === 0) return '';
  const sorted = Array.from(new Set(years)).sort((a, b) => a - b);
  if (sorted.length === 1) return `Recovery year: ${sorted[0]}`;
  return `Recovery years: ${sorted[0]}-${sorted[sorted.length - 1]}`;
}

function formatCompactLocationNames(names: string[], maxNames = 2): string {
  const unique = Array.from(new Set(names.map(name => name.trim()).filter(Boolean)));
  if (unique.length === 0) return 'Recovery area';
  const shown = unique.slice(0, maxNames);
  return `${shown.join(', ')}${unique.length > shown.length ? ', ...' : ''}`;
}

function formatFishCount(value: number): string {
  const rounded = value > 0 ? Math.max(1, Math.round(value)) : 0;
  return rounded.toLocaleString();
}

function positionMovementDay(position: HatcheryWeeklyMovement['weeklyPositions'][number]): number {
  if (typeof position.playbackDay === 'number') return position.playbackDay;
  if (typeof position.movementDay === 'number') return position.movementDay;
  if (position.isHatchery && !position.isReturn) return 0;
  if (position.isReturn) return 367;
  if (position.isoWeek > 0) return Math.min(366, Math.max(1, (position.isoWeek - 1) * 7 + 4));
  return Math.min(366, Math.max(1, position.weekIndex));
}

function drawIndexForDay(positions: HatcheryWeeklyMovement['weeklyPositions'], currentDay: number): number {
  let index = -1;
  for (let i = 0; i < positions.length; i++) {
    if (positionMovementDay(positions[i]) <= currentDay + MOVEMENT_DAY_EPSILON) index = i;
  }
  return index;
}

function activeSegmentForDay(
  positions: HatcheryWeeklyMovement['weeklyPositions'],
  currentDay: number
): { segmentIndex: number; progress: number } | null {
  for (let i = 0; i < positions.length - 1; i++) {
    const fromDay = positionMovementDay(positions[i]);
    const toDay = positionMovementDay(positions[i + 1]);
    if (currentDay > fromDay + MOVEMENT_DAY_EPSILON && currentDay < toDay - MOVEMENT_DAY_EPSILON) {
      return {
        segmentIndex: i,
        progress: Math.min(1, Math.max(0, (currentDay - fromDay) / (toDay - fromDay))),
      };
    }
  }
  return null;
}

interface StackedMarkerInfo {
  displayPos: WeeklyMovementPosition;
  location: string;
  catchCount: number;
  recoveryYears?: number[];
  isReturn: boolean;
  eventLabel?: string;
  firstCatchWeekLabel?: string;
}

function markerEventLabelText(entry: StackedMarkerInfo): string | undefined {
  if (entry.eventLabel === 'Average First Catch' && entry.firstCatchWeekLabel) {
    return `${entry.eventLabel}: ${compactWeekLabel(entry.firstCatchWeekLabel)}`;
  }
  return entry.eventLabel;
}

function weekLabelSortDay(weekLabel: string, fallback: number): number {
  const match = weekLabel.match(/Wk\s+(\d+)/i);
  if (!match) return fallback;
  return Math.min(366, Math.max(1, (Number(match[1]) - 1) * 7 + 4));
}

function stackedMarkerTooltipHtml(opts: {
  trackLabel: string;
  entries: StackedMarkerInfo[];
  color: string;
}): string {
  const rows = opts.entries.flatMap((entry, entryIndex) => {
    const baseDay = positionMovementDay(entry.displayPos);
    return positionWeekSummaries(entry.displayPos).map((summary, summaryIndex) => ({
      entry,
      summary,
      originalIndex: entryIndex + summaryIndex / 100,
      sortDay: weekLabelSortDay(summary.weekLabel, baseDay) + summaryIndex / 100,
      eventLabel: summaryIndex === 0 ? markerEventLabelText(entry) : undefined,
    }));
  }).sort((a, b) => a.sortDay === b.sortDay ? a.originalIndex - b.originalIndex : a.sortDay - b.sortDay);

  const blocks = rows.map((row, index) => {
    const yearStr = formatRecoveryYearRange(row.entry.recoveryYears);
    const countLabel = row.entry.isReturn ? 'Tracked Fish Successfully Returned' : 'Tracked Fish';
    return `
      <div style="${index > 0 ? 'border-top:1px solid rgba(255,255,255,0.12);padding-top:5px;margin-top:5px' : ''}">
        ${row.eventLabel ? `<div style="color:${opts.color};font-size:0.72rem;font-weight:800;margin-bottom:1px">${row.eventLabel}</div>` : ''}
        <div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap">
          <span style="color:#00bfff;font-size:0.73rem;font-weight:800">${formatWeekLabel(row.summary.weekLabel)}</span>
          ${yearStr ? `<span style="color:rgba(255,255,255,0.76);font-size:0.67rem">${yearStr}</span>` : ''}
          <span style="color:rgba(255,255,255,0.48);font-size:0.66rem;overflow:hidden;text-overflow:ellipsis;max-width:150px">${row.entry.location}</span>
        </div>
        <div style="color:#4ECDC4;font-size:0.73rem;font-weight:800;margin-top:1px">${countLabel}: ${formatFishCount(row.summary.catchCount)}</div>
      </div>`;
  }).join('');

  return `
    <div style="min-width:260px;line-height:1.35">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${opts.color};flex-shrink:0"></span>
        <strong style="color:#fff;font-size:0.85rem">${opts.trackLabel}</strong>
      </div>
      ${blocks}
    </div>`;
}

function stackedMarkerDisplayPosition(entries: StackedMarkerInfo[], lat: number, lng: number): WeeklyMovementPosition {
  const sorted = entries
    .slice()
    .sort((a, b) => positionMovementDay(a.displayPos) - positionMovementDay(b.displayPos));
  const base = sorted[0]?.displayPos;
  if (!base) throw new Error('Cannot build a stacked marker without entries.');
  if (sorted.length === 1) return base;

  const recoveryYears = new Set<number>();
  for (const entry of sorted) {
    for (const year of entry.recoveryYears ?? entry.displayPos.recoveryYears ?? []) recoveryYears.add(year);
  }

  return {
    ...base,
    lat,
    lng,
    catchCount: sorted.reduce((sum, entry) => sum + entry.catchCount, 0),
    numRecords: sorted.reduce((sum, entry) => sum + entry.displayPos.numRecords, 0),
    recoveryYears: Array.from(recoveryYears).sort((a, b) => a - b),
    sourceWeekLabels: sorted.flatMap(entry => positionWeekLabels(entry.displayPos)),
    sourceWeekSummaries: sorted.flatMap(entry => positionWeekSummaries(entry.displayPos)),
    catchEvents: sorted.flatMap(entry => entry.displayPos.catchEvents ?? []),
    locationName: sorted[0]?.location ?? base.locationName,
  };
}

function pathTooltipHtml(opts: {
  trackLabel: string;
  from: HatcheryWeeklyMovement['weeklyPositions'][number];
  to: HatcheryWeeklyMovement['weeklyPositions'][number];
  color: string;
}): string {
  const { trackLabel, from, to, color } = opts;
  const fromWeek = formatPositionWeekLabel(from);
  const toWeek = formatPositionWeekLabel(to);
  return `
    <div style="min-width:180px;line-height:1.55">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="display:inline-block;width:18px;height:3px;border-radius:999px;background:${color};flex-shrink:0"></span>
        <strong style="color:#fff;font-size:0.85rem">Average salmon path</strong>
      </div>
      <div style="color:rgba(255,255,255,0.72);font-size:0.72rem;margin-bottom:5px">${trackLabel}</div>
      <div style="color:#00bfff;font-size:0.75rem;font-weight:600">From: ${fromWeek}</div>
      <div style="color:#00bfff;font-size:0.75rem;font-weight:600">To: ${toWeek}</div>
      ${to.isReturn
        ? `<div style="color:#ff9f43;font-size:0.78rem;font-weight:700;margin-top:5px">Tracked Fish Successfully Returned: ${formatFishCount(to.catchCount)}</div>`
        : ''
      }
    </div>`;
}

type WeeklyCatchEvent = NonNullable<WeeklyMovementPosition['catchEvents']>[number];

interface CombinedCatchEvent {
  lat: number;
  lng: number;
  catchCount: number;
  dates: string[];
  years: number[];
  locationNames: string[];
  eventCount: number;
}

interface CombinedCatchEventBuilder extends CombinedCatchEvent {
  dateSet: Set<string>;
  yearSet: Set<number>;
  locationSet: Set<string>;
}

interface BranchNode extends LatLngPoint {
  catchCount: number;
  events: CombinedCatchEvent[];
  locationName: string;
  recoveryYears: number[];
}

const catchEventClusterCache = new WeakMap<WeeklyMovementPosition, {
  boundary: PwsBoundary | null | undefined;
  clusters: CombinedCatchEvent[][];
}>();
const branchNodeCache = new WeakMap<WeeklyMovementPosition, {
  boundary: PwsBoundary | null | undefined;
  nodes: BranchNode[];
}>();

function catchEventTooltipHtml(
  trackLabel: string,
  event: CombinedCatchEvent
): string {
  const yearText = formatRecoveryYearsCompact(event.years);
  const dateText = event.dates.length === 1
    ? event.dates[0]
    : `${event.dates.length} catch events: ${event.dates.slice(0, 5).join(', ')}${event.dates.length > 5 ? '...' : ''}`;
  const locationText = formatCompactLocationNames(event.locationNames);
  return `
    <div style="min-width:170px;max-width:240px;line-height:1.45;white-space:normal">
      <strong style="color:#fff;font-size:0.84rem">${trackLabel}</strong>
      <div style="color:#00bfff;font-size:0.75rem;font-weight:700;margin-top:3px">${dateText}</div>
      <div style="color:rgba(255,255,255,0.62);font-size:0.72rem">${locationText}</div>
      <div style="color:#4ECDC4;font-size:0.78rem;font-weight:800;margin-top:4px">Tracked Fish: ${formatFishCount(event.catchCount)}</div>
      <div style="color:rgba(255,255,255,0.55);font-size:0.68rem">${yearText}</div>
      ${event.eventCount > 1 ? `<div style="color:rgba(255,255,255,0.45);font-size:0.68rem">Combined exact-location events: ${event.eventCount}</div>` : ''}
    </div>`;
}

const arrowIconCache = new Map<string, L.DivIcon>();

function makeArrowIcon(color: string, brng: number, opacity: number, size = 14): L.DivIcon {
  const cacheKey = `${color}:${Math.round(brng)}:${opacity.toFixed(2)}:${size}`;
  const cached = arrowIconCache.get(cacheKey);
  if (cached) return cached;

  const pad = size + 4;
  const sw = pad * 2; const sh = pad * 2;
  const cx = sw / 2; const cy = sh / 2;
  const hw = size * 0.5;
  const tip = `${cx},${cy - size}`;
  const br = `${cx + hw},${cy + size * 0.4}`;
  const notch = `${cx},${cy}`;
  const bl = `${cx - hw},${cy + size * 0.4}`;
  const icon = L.divIcon({
    className: 'movement-arrow-icon',
    html: `<svg width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">
      <polygon points="${tip} ${br} ${notch} ${bl}" fill="${color}" stroke="rgba(0,0,0,0.5)" stroke-width="1" opacity="${opacity}" transform="rotate(${brng},${cx},${cy})"/>
    </svg>`,
    iconSize: [sw, sh], iconAnchor: [cx, cy],
  });
  arrowIconCache.set(cacheKey, icon);
  return icon;
}

function addPathArrows(opts: {
  group: L.LayerGroup;
  map: L.Map;
  route: LatLngPoint[];
  color: string;
  opacity: number;
  isHovered: boolean;
  maxArrows?: number;
}) {
  const { group, map, route, color, opacity, isHovered, maxArrows = 22 } = opts;
  if (opacity <= 0.1 || maxArrows <= 0 || route.length < 2) return;

  const projected = route.map(point => map.latLngToLayerPoint([point.lat, point.lng] as L.LatLngExpression));
  const segmentLengths: number[] = [];
  let totalPixels = 0;

  for (let i = 0; i < projected.length - 1; i++) {
    const len = projected[i].distanceTo(projected[i + 1]);
    segmentLengths.push(len);
    totalPixels += len;
  }

  if (totalPixels < 8) return;

  const routeKm = pathLengthKm(route);
  const spacingPx = isHovered ? 74 : 92;
  const arrowCount = routeKm < 25
    ? 1
    : Math.min(maxArrows, Math.max(2, Math.floor(totalPixels / spacingPx) + 1));
  if (arrowCount <= 0) return;

  let segmentIndex = 0;
  let segmentStartPixels = 0;
  for (let i = 1; i <= arrowCount; i++) {
    const targetPixels = totalPixels * (i / (arrowCount + 1));
    while (
      segmentIndex < segmentLengths.length - 1 &&
      segmentStartPixels + segmentLengths[segmentIndex] < targetPixels
    ) {
      segmentStartPixels += segmentLengths[segmentIndex];
      segmentIndex++;
    }

    const segmentLen = segmentLengths[segmentIndex];
    if (segmentLen <= 0) continue;

    const fromProjected = projected[segmentIndex];
    const toProjected = projected[segmentIndex + 1];
    const t = Math.min(1, Math.max(0, (targetPixels - segmentStartPixels) / segmentLen));
    const dx = toProjected.x - fromProjected.x;
    const dy = toProjected.y - fromProjected.y;
    const point = L.point(fromProjected.x + dx * t, fromProjected.y + dy * t);
    const latLng = map.layerPointToLatLng(point);
    const screenBearing = Math.atan2(dx, -dy) * 180 / Math.PI;

    group.addLayer(L.marker(latLng, {
      icon: makeArrowIcon(color, screenBearing, opacity, isHovered ? 14 : 10),
      interactive: false,
      zIndexOffset: 120,
    }));
  }
}

function makeStarIcon(opts: {
  color: string;
  size: number;
  stroke?: string;
  strokeWidth?: number;
  glow?: boolean;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
  badgeText?: string;
}): L.DivIcon {
  const {
    color,
    size,
    stroke = '#fff',
    strokeWidth = 1.8,
    glow = false,
    offsetX = 0,
    offsetY = 0,
    opacity = 1,
    badgeText,
  } = opts;
  const canvasSize = Math.max(34, size + Math.abs(offsetX) * 2 + Math.abs(offsetY) * 2 + (badgeText ? 18 : 10));
  const cx = canvasSize / 2 + offsetX;
  const cy = canvasSize / 2 + offsetY;
  const outer = size / 2;
  const inner = outer * 0.45;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    points.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
  }

  return L.divIcon({
    className: '',
    html: `<svg width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block;${glow ? `filter:drop-shadow(0 0 12px ${color})` : ''}">
      <polygon points="${points.join(' ')}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" opacity="${opacity}"/>
      ${badgeText ? `<g transform="translate(${(canvasSize - 8).toFixed(1)} 8)">
        <circle r="8" fill="rgba(5,13,24,0.92)" stroke="${color}" stroke-width="1.4"/>
        <text text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="7" font-weight="800" font-family="Arial, sans-serif">${badgeText}</text>
      </g>` : ''}
    </svg>`,
    iconSize: [canvasSize, canvasSize],
    iconAnchor: [canvasSize / 2, canvasSize / 2],
  });
}

// ─── Static path layer ────────────────────────────────────────────────────────
function makeCatchEventIcon(color: string, count: number): L.DivIcon {
  const size = Math.min(26, Math.max(18, 16 + Math.log10(count + 1) * 5));
  const sw = size + 18;
  const sh = size + 14;
  const cx = sw / 2;
  const cy = sh / 2;
  const bodyRx = size * 0.38;
  const bodyRy = size * 0.22;
  const tailX = cx - bodyRx - size * 0.32;
  const tailTop = cy - bodyRy * 0.9;
  const tailBottom = cy + bodyRy * 0.9;
  const eyeX = cx + bodyRx * 0.45;
  return L.divIcon({
    className: 'catch-event-fish-icon',
    html: `<svg width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.75))">
      <path d="M${tailX.toFixed(1)} ${cy.toFixed(1)} L${(cx - bodyRx).toFixed(1)} ${tailTop.toFixed(1)} L${(cx - bodyRx).toFixed(1)} ${tailBottom.toFixed(1)} Z" fill="${color}" stroke="rgba(255,255,255,0.95)" stroke-width="1.4" stroke-linejoin="round"/>
      <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${bodyRx.toFixed(1)}" ry="${bodyRy.toFixed(1)}" fill="${color}" stroke="rgba(255,255,255,0.95)" stroke-width="1.4"/>
      <circle cx="${eyeX.toFixed(1)}" cy="${(cy - bodyRy * 0.25).toFixed(1)}" r="1.4" fill="#06101c"/>
    </svg>`,
    iconSize: [sw, sh],
    iconAnchor: [cx, cy],
  });
}

function groupExactCatchEvents(events: WeeklyCatchEvent[]): CombinedCatchEvent[] {
  const groups = new Map<string, CombinedCatchEventBuilder>();
  for (const event of events) {
    const key = `${event.lat}|${event.lng}`;
    const existing = groups.get(key);
    if (existing) {
      existing.catchCount += event.catchCount;
      existing.eventCount += 1;
      if (!existing.dateSet.has(event.dateLabel)) {
        existing.dateSet.add(event.dateLabel);
        existing.dates.push(event.dateLabel);
      }
      if (!existing.yearSet.has(event.recoveryYear)) {
        existing.yearSet.add(event.recoveryYear);
        existing.years.push(event.recoveryYear);
      }
      if (!existing.locationSet.has(event.locationName)) {
        existing.locationSet.add(event.locationName);
        existing.locationNames.push(event.locationName);
      }
    } else {
      groups.set(key, {
        lat: event.lat,
        lng: event.lng,
        catchCount: event.catchCount,
        dates: [event.dateLabel],
        years: [event.recoveryYear],
        locationNames: [event.locationName],
        eventCount: 1,
        dateSet: new Set([event.dateLabel]),
        yearSet: new Set([event.recoveryYear]),
        locationSet: new Set([event.locationName]),
      });
    }
  }

  return Array.from(groups.values()).map(({ dateSet, yearSet, locationSet, ...group }) => ({
    ...group,
    years: group.years.sort((a, b) => a - b),
  }));
}

function weightedBranchCenter(events: CombinedCatchEvent[]): BranchNode {
  let totalWeight = 0;
  let latSum = 0;
  let lngSum = 0;
  let catchCount = 0;
  const locationWeights = new Map<string, number>();
  const recoveryYears = new Set<number>();

  for (const event of events) {
    const weight = Math.max(0.0001, event.catchCount);
    totalWeight += weight;
    latSum += event.lat * weight;
    lngSum += event.lng * weight;
    catchCount += event.catchCount;
    for (const location of event.locationNames) {
      locationWeights.set(location, (locationWeights.get(location) ?? 0) + event.catchCount);
    }
    for (const year of event.years) recoveryYears.add(year);
  }

  const sortedLocations = Array.from(locationWeights.entries()).sort((a, b) => b[1] - a[1]);
  const primaryLocation = sortedLocations[0]?.[0] ?? 'Recovery area';
  return {
    lat: totalWeight > 0 ? latSum / totalWeight : events[0]?.lat ?? 0,
    lng: totalWeight > 0 ? lngSum / totalWeight : events[0]?.lng ?? 0,
    catchCount,
    events,
    locationName: sortedLocations.length > 1 ? `${primaryLocation} + ${sortedLocations.length - 1} more` : primaryLocation,
    recoveryYears: Array.from(recoveryYears).sort((a, b) => a - b),
  };
}

function eventsCanShareCluster(
  a: CombinedCatchEvent,
  b: CombinedCatchEvent,
  maxDistanceKm: number,
  boundary?: PwsBoundary | null
): boolean {
  if (distanceKm(a.lat, a.lng, b.lat, b.lng) > maxDistanceKm) return false;
  if (!supportsWaterRouting(boundary)) return true;

  const from = { lat: a.lat, lng: a.lng };
  const to = { lat: b.lat, lng: b.lng };
  if (!isPwsRelevantSegment(from, to, boundary)) return true;
  return segmentAllowedStrict(from, to, boundary);
}

function clusterAxisSpanExceeds(
  cluster: CombinedCatchEvent[],
  maxDistanceKm: number,
  extra?: CombinedCatchEvent
): boolean {
  let minLat = extra?.lat ?? Number.POSITIVE_INFINITY;
  let maxLat = extra?.lat ?? Number.NEGATIVE_INFINITY;
  let minLng = extra?.lng ?? Number.POSITIVE_INFINITY;
  let maxLng = extra?.lng ?? Number.NEGATIVE_INFINITY;
  let latTotal = extra?.lat ?? 0;
  let count = extra ? 1 : 0;

  for (const event of cluster) {
    minLat = Math.min(minLat, event.lat);
    maxLat = Math.max(maxLat, event.lat);
    minLng = Math.min(minLng, event.lng);
    maxLng = Math.max(maxLng, event.lng);
    latTotal += event.lat;
    count++;
  }

  if (count <= 1) return false;
  const latSpanKm = (maxLat - minLat) * 110.574;
  const midLat = latTotal / count;
  const lngSpanKm = (maxLng - minLng) * Math.max(20, 111.32 * Math.cos(midLat * Math.PI / 180));
  return latSpanKm > maxDistanceKm || lngSpanKm > maxDistanceKm;
}

function clusterIsTight(
  cluster: CombinedCatchEvent[],
  maxDistanceKm: number,
  boundary?: PwsBoundary | null
): boolean {
  if (clusterAxisSpanExceeds(cluster, maxDistanceKm)) return false;
  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      if (!eventsCanShareCluster(cluster[i], cluster[j], maxDistanceKm, boundary)) return false;
    }
  }
  return true;
}

function eventFitsCluster(
  event: CombinedCatchEvent,
  cluster: CombinedCatchEvent[],
  maxDistanceKm: number,
  boundary?: PwsBoundary | null
): boolean {
  if (clusterAxisSpanExceeds(cluster, maxDistanceKm, event)) return false;
  return cluster.every(existing => eventsCanShareCluster(event, existing, maxDistanceKm, boundary));
}

function mergedClusterIfTight(
  clusterA: CombinedCatchEvent[],
  clusterB: CombinedCatchEvent[],
  maxDistanceKm: number,
  boundary?: PwsBoundary | null
): CombinedCatchEvent[] | null {
  const merged = [...clusterA, ...clusterB];
  return clusterIsTight(merged, maxDistanceKm, boundary) ? merged : null;
}

function catchEventClustersForPosition(pos: WeeklyMovementPosition, boundary?: PwsBoundary | null): CombinedCatchEvent[][] {
  const cached = catchEventClusterCache.get(pos);
  if (cached && cached.boundary === boundary) return cached.clusters;

  let clusters: CombinedCatchEvent[][];
  if (pos.isHatchery || pos.isReturn) return [];

  const events = groupExactCatchEvents(pos.catchEvents ?? []);
  if (events.length < 2) {
    clusters = events.length === 1 ? [events] : [];
    catchEventClusterCache.set(pos, { boundary, clusters });
    return clusters;
  }

  if (clusterIsTight(events, BRANCH_SPLIT_KM, boundary)) {
    clusters = [events];
    catchEventClusterCache.set(pos, { boundary, clusters });
    return clusters;
  }

  const sortedEvents = events.slice().sort((a, b) => b.catchCount - a.catchCount);
  clusters = [];
  for (const event of sortedEvents) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < clusters.length; i++) {
      if (!eventFitsCluster(event, clusters[i], BRANCH_SPLIT_KM, boundary)) continue;
      const center = weightedBranchCenter(clusters[i]);
      const dist = distanceKm(event.lat, event.lng, center.lat, center.lng);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      clusters[bestIndex].push(event);
    } else {
      clusters.push([event]);
    }
  }

  let mergedAny = true;
  while (mergedAny) {
    mergedAny = false;
    for (let i = 0; i < clusters.length && !mergedAny; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const merged = mergedClusterIfTight(clusters[i], clusters[j], BRANCH_SPLIT_KM, boundary);
        if (!merged) continue;
        clusters[i] = merged;
        clusters.splice(j, 1);
        mergedAny = true;
        break;
      }
    }
  }

  if (clusters.length < 2) {
    const mergedClusters = [events];
    catchEventClusterCache.set(pos, { boundary, clusters: mergedClusters });
    return mergedClusters;
  }

  clusters = clusters.sort((a, b) => {
    const centerA = weightedBranchCenter(a);
    const centerB = weightedBranchCenter(b);
    return centerA.lng === centerB.lng ? centerA.lat - centerB.lat : centerA.lng - centerB.lng;
  });
  catchEventClusterCache.set(pos, { boundary, clusters });
  return clusters;
}

function branchNodesForPosition(pos: WeeklyMovementPosition, boundary?: PwsBoundary | null): BranchNode[] {
  const cached = branchNodeCache.get(pos);
  if (cached && cached.boundary === boundary) return cached.nodes;

  let nodes: BranchNode[];
  if (pos.isHatchery || pos.isReturn) {
    nodes = [{
      lat: pos.lat,
      lng: pos.lng,
      catchCount: pos.catchCount,
      events: [],
      locationName: pos.locationName,
      recoveryYears: pos.recoveryYears ?? [],
    }];
    branchNodeCache.set(pos, { boundary, nodes });
    return nodes;
  }

  const clusters = catchEventClustersForPosition(pos, boundary);
  if (clusters.length < 2) {
    nodes = [{
      lat: pos.lat,
      lng: pos.lng,
      catchCount: pos.catchCount,
      events: clusters[0] ?? [],
      locationName: pos.locationName,
      recoveryYears: pos.recoveryYears ?? [],
    }];
    branchNodeCache.set(pos, { boundary, nodes });
    return nodes;
  }

  nodes = clusters.map(weightedBranchCenter);
  branchNodeCache.set(pos, { boundary, nodes });
  return nodes;
}

function closestBranchNode(anchor: LatLngPoint, nodes: BranchNode[]): BranchNode | undefined {
  let closest: BranchNode | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const dist = distanceKm(anchor.lat, anchor.lng, node.lat, node.lng);
    if (dist < closestDistance) {
      closestDistance = dist;
      closest = node;
    }
  }
  return closest;
}

function branchPairs(fromNodes: BranchNode[], toNodes: BranchNode[]): Array<[BranchNode, BranchNode]> {
  if (fromNodes.length === 0 || toNodes.length === 0) return [];
  if (fromNodes.length === 1) return toNodes.map(to => [fromNodes[0], to]);
  if (toNodes.length === 1) return fromNodes.map(from => [from, toNodes[0]]);

  const pairs: Array<[BranchNode, BranchNode]> = [];
  const pairKeys = new Set<string>();
  const addPair = (from: BranchNode, to: BranchNode) => {
    const key = `${from.lat.toFixed(5)}:${from.lng.toFixed(5)}>${to.lat.toFixed(5)}:${to.lng.toFixed(5)}`;
    if (pairKeys.has(key)) return;
    pairKeys.add(key);
    pairs.push([from, to]);
  };

  for (const from of fromNodes) {
    let closest: BranchNode | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const to of toNodes) {
      const dist = distanceKm(from.lat, from.lng, to.lat, to.lng);
      if (dist < closestDistance) {
        closestDistance = dist;
        closest = to;
      }
    }

    if (closest) addPair(from, closest);
  }

  for (const to of toNodes) {
    const from = closestBranchNode(to, fromNodes) ?? fromNodes[0];
    addPair(from, to);
  }

  return pairs;
}

function primaryReturnSourceNode(
  from: WeeklyMovementPosition,
  fromNodes: BranchNode[]
): BranchNode | undefined {
  if (fromNodes.length === 0) return undefined;
  return fromNodes.reduce((best, node) => {
    if (node.catchCount !== best.catchCount) {
      return node.catchCount > best.catchCount ? node : best;
    }
    const nodeDistance = distanceKm(node.lat, node.lng, from.lat, from.lng);
    const bestDistance = distanceKm(best.lat, best.lng, from.lat, from.lng);
    return nodeDistance < bestDistance ? node : best;
  }, fromNodes[0]);
}

function movementBranchPairs(
  from: WeeklyMovementPosition,
  to: WeeklyMovementPosition,
  fromNodes: BranchNode[],
  toNodes: BranchNode[],
  boundaries?: MovementBoundaryContext
): Array<[BranchNode, BranchNode]> {
  if (!to.isReturn) return branchPairs(fromNodes, toNodes);

  const eligibleFromNodes = boundaries
    ? fromNodes.filter(node => pointInsideConfiguredBoundary(node, boundaries))
    : fromNodes;
  const fromNode = primaryReturnSourceNode(from, eligibleFromNodes);
  if (!fromNode || toNodes.length === 0) return [];

  const toNode = closestBranchNode(fromNode, toNodes) ?? toNodes[0];
  return [[fromNode, toNode]];
}

function movementPathLegKey(fromPoint: LatLngPoint, toPoint: LatLngPoint, to: WeeklyMovementPosition): string {
  return [
    fromPoint.lat.toFixed(5),
    fromPoint.lng.toFixed(5),
    toPoint.lat.toFixed(5),
    toPoint.lng.toFixed(5),
    to.isReturn ? 'return' : 'movement',
  ].join(':');
}

function markerNodeKeyForPath(index: number, node: LatLngPoint): string {
  return `${index}:${node.lat.toFixed(5)}:${node.lng.toFixed(5)}`;
}

function buildDisplayNodeForPath(
  positions: WeeklyMovementPosition[],
  boundary: PwsBoundary | null,
  drawUpTo: number
): (index: number, node: BranchNode, position: WeeklyMovementPosition) => BranchNode {
  const firstDataIndex = positions.findIndex(pos => !pos.isHatchery && !pos.isReturn);
  const firstAttachmentIndexes = firstDataIndex >= 0
    ? firstCatchAttachmentIndexes(positions, firstDataIndex, drawUpTo)
    : new Set<number>();
  const firstAttachments = Array.from(firstAttachmentIndexes).map(index => positions[index]);
  const displayedNodeByRawNode = new Map<string, BranchNode>();
  const markerEntries: Array<{
    index: number;
    displayPos: WeeklyMovementPosition;
    node: BranchNode;
    isReturnPoint: boolean;
    isFirstDataPoint: boolean;
  }> = [];

  for (let i = 0; i <= drawUpTo && i < positions.length; i++) {
    const pos = positions[i];
    if (pos.isHatchery && !pos.isReturn) continue;
    if (firstAttachmentIndexes.has(i)) continue;
    const isFirstDataPoint = i === firstDataIndex;
    const displayPos = isFirstDataPoint ? firstCatchDisplayPosition(pos, firstAttachments) : pos;
    for (const node of branchNodesForPosition(pos, boundary)) {
      markerEntries.push({
        index: i,
        displayPos,
        node,
        isReturnPoint: pos.isReturn,
        isFirstDataPoint,
      });
    }
  }

  const markerGroups: Array<typeof markerEntries> = [];
  for (const entry of markerEntries) {
    const existingGroup = markerGroups.find(existing => (
      existing.every(existingEntry => existingEntry.isReturnPoint === entry.isReturnPoint) &&
      distanceKm(existing[0].node.lat, existing[0].node.lng, entry.node.lat, entry.node.lng) <= STACKED_MARKER_KM
    ));
    if (existingGroup) {
      existingGroup.push(entry);
    } else {
      markerGroups.push([entry]);
    }
  }

  for (const markerGroup of markerGroups) {
    markerGroup.sort((a, b) => positionMovementDay(a.displayPos) - positionMovementDay(b.displayPos));
    const primary = markerGroup.find(entry => entry.isFirstDataPoint) ?? markerGroup[0];
    for (const entry of markerGroup) {
      displayedNodeByRawNode.set(markerNodeKeyForPath(entry.index, entry.node), primary.node);
    }
  }

  if (firstDataIndex >= 0 && firstAttachmentIndexes.size > 0) {
    const firstDisplayPos = firstCatchDisplayPosition(positions[firstDataIndex], firstAttachments);
    const firstDisplayNodes = branchNodesForPosition(firstDisplayPos, boundary);
    for (const index of firstAttachmentIndexes) {
      for (const rawNode of branchNodesForPosition(positions[index], boundary)) {
        const visibleNode = closestBranchNode(rawNode, firstDisplayNodes) ?? firstDisplayNodes[0];
        if (visibleNode) {
          displayedNodeByRawNode.set(markerNodeKeyForPath(index, rawNode), visibleNode);
        }
      }
    }
  }

  return (index: number, node: BranchNode, position: WeeklyMovementPosition) => {
    if (position.isReturn) return node;
    return displayedNodeByRawNode.get(markerNodeKeyForPath(index, node)) ?? node;
  };
}

interface MovementProgressDescriptor {
  lat: number;
  lng: number;
  travelBearing: number;
  catchCount: number;
  recoveryYears: number[];
  locationName: string;
  isReturn: boolean;
  weekLabel: string;
}

function movementProgressDescriptor(opts: {
  fromPoint: LatLngPoint;
  toPoint: LatLngPoint;
  to: WeeklyMovementPosition;
  targetNode: BranchNode;
  targetNodeCount: number;
  boundaries: MovementBoundaryContext;
  progress: number;
  showBoundaryConnectors?: boolean;
  forceShowOutOfBoundary?: boolean;
}): { key: string; descriptor: MovementProgressDescriptor } | null {
  const {
    fromPoint,
    toPoint,
    to,
    targetNode,
    targetNodeCount,
    boundaries,
    progress,
    showBoundaryConnectors = true,
    forceShowOutOfBoundary = false,
  } = opts;

  const { route, isOutOfBoundary } = movementLegPath(fromPoint, toPoint, boundaries, Boolean(to.isReturn));
  if (isOutOfBoundary && !showBoundaryConnectors && !forceShowOutOfBoundary) return null;
  if (route.length < 2 || pathLengthKm(route) < 0.05) return null;

  const interpolated = interpolateAlongPath(route, progress);
  const branchTargetCount = to.isReturn || targetNodeCount === 1 ? to.catchCount : targetNode.catchCount;
  const branchRecoveryYears = targetNodeCount === 1 ? to.recoveryYears ?? [] : targetNode.recoveryYears;
  const branchLocationName = targetNodeCount === 1 ? to.locationName : targetNode.locationName;
  const targetKey = `${targetNode.lat.toFixed(5)}:${targetNode.lng.toFixed(5)}`;
  const key = [
    interpolated.point.lat.toFixed(5),
    interpolated.point.lng.toFixed(5),
    targetKey,
    to.isReturn ? 'return' : 'movement',
  ].join(':');

  return {
    key,
    descriptor: {
      lat: interpolated.point.lat,
      lng: interpolated.point.lng,
      travelBearing: interpolated.brng,
      catchCount: branchTargetCount,
      recoveryYears: branchRecoveryYears,
      locationName: branchLocationName,
      isReturn: to.isReturn,
      weekLabel: to.weekLabel,
    },
  };
}

function addMovementProgressMarker(opts: {
  group: L.LayerGroup;
  descriptor: MovementProgressDescriptor;
  color: string;
  opacity: number;
  isHovered: boolean;
  trackLabel: string;
}) {
  const { group, descriptor, color, opacity, isHovered, trackLabel } = opts;
  const glowColor = color;
  const dotSize = isHovered ? 20 : 15;
  const glowSize = isHovered ? 28 : 20;
  const totalW = glowSize + 48; const totalH = glowSize + 48;
  const cx = totalW / 2; const cy = totalH / 2;
  const r = dotSize / 2;
  const arrowLen = r + 14; const arrowHW = 6;
  const tipX = cx; const tipY = cy - arrowLen;
  const brX = cx + arrowHW; const brY = cy - r - 2;
  const notchX = cx; const notchY = cy - r - 2 + arrowHW * 0.6;
  const blX = cx - arrowHW; const blY = cy - r - 2;
  const recoveryYearLabel = formatRecoveryYears(descriptor.recoveryYears);

  const fishIcon = L.divIcon({
    className: '',
    html: `<svg width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">
      <circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="none" stroke="${glowColor}" stroke-width="1.5" opacity="${opacity * 0.3}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${glowColor}" stroke="rgba(255,255,255,0.9)" stroke-width="2.5" opacity="${opacity}"/>
      <polygon points="${tipX},${tipY} ${brX},${brY} ${notchX},${notchY} ${blX},${blY}" fill="${glowColor}" stroke="rgba(0,0,0,0.55)" stroke-width="0.8" opacity="${opacity}" transform="rotate(${descriptor.travelBearing},${cx},${cy})"/>
    </svg>`,
    iconSize: [totalW, totalH], iconAnchor: [cx, cy],
  });

  const marker = L.marker([descriptor.lat, descriptor.lng], { icon: fishIcon, zIndexOffset: 600 });
  const countLine = descriptor.isReturn
    ? `<br/>Tracked Fish Successfully Returned: <strong style="color:#4ECDC4">${formatFishCount(descriptor.catchCount)}</strong>`
    : descriptor.catchCount > 0
      ? `<br/>Tracked Fish: <strong style="color:#4ECDC4">${formatFishCount(descriptor.catchCount)}</strong>`
      : '';
  const returnLabel = descriptor.isReturn
    ? `<br/><span style="color:${color};font-size:0.75rem;font-weight:800">Average First Return to Hatchery</span>`
    : '';
  marker.bindTooltip(
    `<strong>${trackLabel}</strong>` +
    returnLabel +
    `<br/>${descriptor.weekLabel}` +
    (recoveryYearLabel ? `<br/>${recoveryYearLabel}` : '') +
    countLine +
    `<br/>${descriptor.locationName}`,
    { sticky: true, className: 'movement-tooltip' }
  );
  group.addLayer(marker);
}

function drawPathLeg(opts: {
  group: L.LayerGroup;
  map: L.Map;
  from: WeeklyMovementPosition;
  to: WeeklyMovementPosition;
  fromPoint: LatLngPoint;
  toPoint: LatLngPoint;
  boundaries: MovementBoundaryContext;
  progress?: number;
  color: string;
  weight: number;
  opacity: number;
  isHovered: boolean;
  trackLabel: string;
  maxArrows?: number;
  showBoundaryConnectors?: boolean;
  forceDrawOutOfBoundary?: boolean;
}): boolean {
  const {
    group,
    map,
    from,
    to,
    fromPoint,
    toPoint,
    boundaries,
    progress,
    color,
    weight,
    opacity,
    isHovered,
    trackLabel,
    maxArrows,
    showBoundaryConnectors = true,
    forceDrawOutOfBoundary = false,
  } = opts;
  if (distanceKm(fromPoint.lat, fromPoint.lng, toPoint.lat, toPoint.lng) < 0.05) return false;

  const { route, isOutOfBoundary } = movementLegPath(fromPoint, toPoint, boundaries, Boolean(to.isReturn));
  if (isOutOfBoundary && !showBoundaryConnectors && !forceDrawOutOfBoundary) return false;
  const visibleRoute = typeof progress === 'number'
    ? slicePathToProgress(route, progress)
    : route;
  if (visibleRoute.length < 2 || pathLengthKm(visibleRoute) < 0.05) return false;

  const polyline = L.polyline(visibleRoute.map(point => [point.lat, point.lng] as L.LatLngExpression), {
    color,
    weight,
    opacity,
    dashArray: isOutOfBoundary ? '1 7' : to.isReturn ? '8 5' : undefined,
    lineCap: 'round',
    lineJoin: 'round',
  });
  polyline.bindTooltip(
    pathTooltipHtml({ trackLabel, from, to, color }),
    { sticky: true, className: 'movement-tooltip' }
  );
  group.addLayer(polyline);

  if (!isOutOfBoundary) {
    addPathArrows({
      group,
      map,
      route: visibleRoute,
      color,
      opacity,
      isHovered,
      maxArrows: maxArrows ?? 22,
    });
  }
  return true;
}

function vicinityAreaLatLngs(
  pos: WeeklyMovementPosition,
  options: {
    nextPos?: WeeklyMovementPosition;
    nextAnchor?: LatLngPoint;
    nextReliable?: boolean;
    previousAnchor?: LatLngPoint;
    events?: CombinedCatchEvent[];
    origin?: LatLngPoint;
    segments?: number;
  } = {}
): L.LatLngExpression[] {
  const {
    nextPos,
    nextAnchor,
    nextReliable,
    previousAnchor,
    events: providedEvents,
    origin,
    segments = 96,
  } = options;
  const originLat = origin?.lat ?? pos.lat;
  const originLng = origin?.lng ?? pos.lng;
  const latKm = 110.574;
  const lngKm = Math.max(20, 111.32 * Math.cos(originLat * Math.PI / 180));
  const events = providedEvents ?? groupExactCatchEvents(pos.catchEvents ?? []);
  const currentPoints = events.map(event => ({
    x: (event.lng - originLng) * lngKm,
    y: (event.lat - originLat) * latKm,
    bufferKm: Math.min(10, Math.max(4.5, 3.2 + Math.sqrt(Math.max(event.catchCount, 1)) / 3)),
  }));

  if (currentPoints.length === 0) {
    currentPoints.push({ x: 0, y: 0, bufferKm: 4.5 });
  } else {
    currentPoints.push({ x: 0, y: 0, bufferKm: 3.5 });
  }

  const pullPoints: Array<{ x: number; y: number; bufferKm: number }> = [];
  const nextPullAnchor = nextAnchor ?? (nextPos && !nextPos.isReturn && !nextPos.isHatchery ? nextPos : undefined);
  if (nextPullAnchor) {
    const nextX = (nextPullAnchor.lng - originLng) * lngKm;
    const nextY = (nextPullAnchor.lat - originLat) * latKm;
    const nextDistance = Math.sqrt(nextX * nextX + nextY * nextY);
    if (nextDistance > 1) {
      const reliableNext = nextReliable ?? (nextPos ? nextPos.catchCount > 250 : false);
      const pullFactor = reliableNext ? 0.34 : 0.16;
      const pullDistance = Math.min(reliableNext ? 35 : 18, nextDistance * pullFactor);
      pullPoints.push({
        x: (nextX / nextDistance) * pullDistance,
        y: (nextY / nextDistance) * pullDistance,
        bufferKm: reliableNext ? 8 : 5.5,
      });
    }
  }

  if (previousAnchor) {
    const prevX = (previousAnchor.lng - originLng) * lngKm;
    const prevY = (previousAnchor.lat - originLat) * latKm;
    const prevDistance = Math.sqrt(prevX * prevX + prevY * prevY);
    if (prevDistance > 1) {
      const pullDistance = Math.min(14, prevDistance * 0.12);
      pullPoints.push({
        x: (prevX / prevDistance) * pullDistance,
        y: (prevY / prevDistance) * pullDistance,
        bufferKm: 5,
      });
    }
  }

  const influencePoints = [...currentPoints, ...pullPoints];
  let radii: number[] = [];

  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const dirX = Math.cos(theta);
    const dirY = Math.sin(theta);
    let radius = 2.5;

    for (const influence of influencePoints) {
      const projection = influence.x * dirX + influence.y * dirY;
      const distSq = influence.x * influence.x + influence.y * influence.y;
      const perpSq = Math.max(0, distSq - projection * projection);
      const bufferSq = influence.bufferKm * influence.bufferKm;
      if (perpSq <= bufferSq && projection > -influence.bufferKm) {
        radius = Math.max(radius, projection + Math.sqrt(bufferSq - perpSq));
      }
    }

    radii.push(radius);
  }

  for (let pass = 0; pass < 3; pass++) {
    radii = radii.map((radius, i) => {
      const prev2 = radii[(i - 2 + segments) % segments];
      const prev1 = radii[(i - 1 + segments) % segments];
      const next1 = radii[(i + 1) % segments];
      const next2 = radii[(i + 2) % segments];
      const roundedRadius = (prev2 + prev1 * 2 + radius * 3 + next1 * 2 + next2) / 9;
      return Math.max(radius, roundedRadius);
    });
  }

  return radii.map((radius, i) => {
    const theta = (i / segments) * Math.PI * 2;
    const dirX = Math.cos(theta);
    const dirY = Math.sin(theta);
    return [originLat + (dirY * radius) / latKm, originLng + (dirX * radius) / lngKm];
  });
}

function vicinityAreasForPosition(
  pos: WeeklyMovementPosition,
  nextPos?: WeeklyMovementPosition,
  previousAnchor?: LatLngPoint,
  boundary?: PwsBoundary | null
): L.LatLngExpression[][] {
  const clusters = catchEventClustersForPosition(pos, boundary);
  if (clusters.length < 2) {
    return [vicinityAreaLatLngs(pos, { nextPos, previousAnchor })];
  }

  const nextNodes = nextPos && !nextPos.isReturn && !nextPos.isHatchery
    ? branchNodesForPosition(nextPos, boundary)
    : [];

  return clusters.map(cluster => {
    const center = weightedBranchCenter(cluster);
    const nextNode = nextNodes.length > 0 ? closestBranchNode(center, nextNodes) : undefined;
    return vicinityAreaLatLngs(pos, {
      events: cluster,
      origin: center,
      nextPos,
      nextAnchor: nextNode,
      nextReliable: nextNode ? nextNode.catchCount > 250 : undefined,
      previousAnchor,
    });
  });
}

interface StaticPathLayerProps {
  movements: HatcheryWeeklyMovement[];
  enabledYears: Set<number>;
  hoveredYear: number | null;
  currentFrame?: number;
  currentDay?: number;
  showLinesAndArrows?: boolean;
  showVicinityLayer?: boolean;
  showBoundaryConnectors?: boolean;
  boundaryRegion?: string | null;
}

export function MovementBoundsController({ movements, enabledYears }: { movements: HatcheryWeeklyMovement[]; enabledYears: Set<number> }) {
  const map = useMap();
  const lastBoundsKeyRef = useRef<string>('');

  useEffect(() => {
    const points: L.LatLngExpression[] = [];
    const keyParts: string[] = [];

    for (const movement of movements) {
      if (!enabledYears.has(movement.year)) continue;
      keyParts.push(`${movement.year}:${movement.weeklyPositions.length}:${movement.totalCatch}`);
      points.push([movement.hatcheryLat, movement.hatcheryLng]);
      for (const pos of movement.weeklyPositions) {
        points.push([pos.lat, pos.lng]);
      }
    }

    if (points.length < 2) return;
    const boundsKey = keyParts.sort().join('|');
    if (!boundsKey || boundsKey === lastBoundsKeyRef.current) return;
    lastBoundsKeyRef.current = boundsKey;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, {
      animate: false,
      maxZoom: 8,
      paddingTopLeft: [72, 72],
      paddingBottomRight: [72, 72],
    });
  }, [map, movements, enabledYears]);

  return null;
}

export function PwsBoundaryPreloader({ region = 'Prince William Sound' }: { region?: string | null }) {
  useMovementBoundaries(region);
  return null;
}

export function StaticPathLayer({
  movements,
  enabledYears,
  hoveredYear,
  currentFrame = 0,
  currentDay,
  showLinesAndArrows = true,
  showVicinityLayer = false,
  showBoundaryConnectors = true,
  boundaryRegion = 'Prince William Sound',
}: StaticPathLayerProps) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);
  const boundaryContext = useMovementBoundaries(boundaryRegion);
  const pwsBoundary = boundaryContext.primary;

  useEffect(() => {
    if (groupRef.current) map.removeLayer(groupRef.current);
    const group = L.layerGroup();
    const eventLayer = L.layerGroup();
    const vicinityLayers = new Map<string, L.Polygon[]>();
    let selectedPointKey: string | null = null;

    function styleVicinityLayers(focusedKey: string | null) {
      for (const [key, layers] of vicinityLayers) {
        const focused = focusedKey === key;
        for (const layer of layers) {
          layer.setStyle({
            opacity: focused ? 0.95 : focusedKey ? 0.12 : 0.35,
            weight: focused ? 3 : 1.2,
            fillOpacity: focused ? 0.07 : focusedKey ? 0.01 : 0.08,
          });
          if (focused) layer.bringToFront();
        }
      }
    }

    function clearCatchSelection() {
      selectedPointKey = null;
      eventLayer.clearLayers();
      styleVicinityLayers(null);
    }

    group.addLayer(eventLayer);
    const visibleMovements = movements.filter(mv => enabledYears.has(mv.year));

    function showCatchSelection(
      pointKey: string,
      pos: WeeklyMovementPosition,
      nextPos: WeeklyMovementPosition | undefined,
      previousAnchor: LatLngPoint | undefined,
      color: string,
      trackLabel: string
    ) {
      selectedPointKey = pointKey;
      eventLayer.clearLayers();
      styleVicinityLayers(pointKey);

      const selectedWeekLabel = formatPositionWeekLabel(pos);
      for (const area of vicinityAreasForPosition(pos, nextPos, previousAnchor, pwsBoundary)) {
        const selectedArea = L.polygon(area, {
          color,
          weight: 2.6,
          opacity: 0.98,
          fillColor: color,
          fillOpacity: 0.08,
          interactive: false,
        });
        eventLayer.addLayer(selectedArea);
        selectedArea.bringToFront();
      }

      const events = groupExactCatchEvents(pos.catchEvents ?? []);
      for (const event of events) {
        const marker = L.marker([event.lat, event.lng] as L.LatLngExpression, {
          icon: makeCatchEventIcon(color, event.catchCount),
          zIndexOffset: 1250,
        });
        marker.bindTooltip(catchEventTooltipHtml(trackLabel, event), {
          sticky: true,
          className: 'movement-tooltip',
        });
        marker.on('click', evt => {
          L.DomEvent.stopPropagation(evt.originalEvent);
        });
        eventLayer.addLayer(marker);
      }

      if (events.length === 0) {
        const emptyMarker = L.marker([pos.lat, pos.lng] as L.LatLngExpression, {
          icon: makeCatchEventIcon(color, pos.catchCount),
          zIndexOffset: 1250,
        });
        emptyMarker.bindTooltip(
          `<strong>${trackLabel}</strong><br/>${selectedWeekLabel}<br/>Raw catch events were not available for this cached point.`,
          { sticky: true, className: 'movement-tooltip' }
        );
        eventLayer.addLayer(emptyMarker);
      }
    }

    for (const mv of visibleMovements) {
      const color = yearColor(mv.year);
      const trackLabel = mv.label ?? String(mv.year);
      const isHovered = hoveredYear === mv.year;
      const opacity = hoveredYear === null ? 0.6 : isHovered ? 0.9 : 0.12;
      const weight = isHovered ? 3.5 : 2.5;
      const positions = mv.weeklyPositions;
      const drawUpTo = typeof currentDay === 'number'
        ? drawIndexForDay(positions, currentDay)
        : Math.min(currentFrame + 1, positions.length - 1);
      if (drawUpTo < 0) continue;
      const firstDataIndex = positions.findIndex(pos => !pos.isHatchery && !pos.isReturn);
      const firstAttachmentIndexes = firstDataIndex >= 0
        ? firstCatchAttachmentIndexes(positions, firstDataIndex, drawUpTo)
        : new Set<number>();
      const firstAttachments = Array.from(firstAttachmentIndexes).map(index => positions[index]);

      const markerEntries: Array<{
        index: number;
        pointKey: string;
        displayPos: WeeklyMovementPosition;
        node: BranchNode;
        icon: L.DivIcon;
        zIndexOffset: number;
        isReturnPoint: boolean;
        isFirstDataPoint: boolean;
        location: string;
        catchCount: number;
        recoveryYears?: number[];
        eventLabel?: string;
        firstCatchWeekLabel?: string;
        nextPos?: WeeklyMovementPosition;
        previousAnchor?: LatLngPoint;
      }> = [];

      for (let i = 0; i <= drawUpTo && i < positions.length; i++) {
        const pos = positions[i];
        if (pos.isHatchery && !pos.isReturn) continue;
        if (firstAttachmentIndexes.has(i)) continue;
        const isReturnPoint = pos.isReturn;
        const isFirstDataPoint = i === firstDataIndex;
        const displayPos = isFirstDataPoint ? firstCatchDisplayPosition(pos, firstAttachments) : pos;
        const markerNodes = branchNodesForPosition(pos, pwsBoundary);
        const isSplitPoint = markerNodes.length > 1;

        for (let nodeIndex = 0; nodeIndex < markerNodes.length; nodeIndex++) {
          const node = markerNodes[nodeIndex];
          const nodeCatchCount = isSplitPoint ? node.catchCount : displayPos.catchCount;
          const catchScale = nodeCatchCount > 0 ? Math.min(Math.log10(nodeCatchCount + 1) * 2.5, 10) : 0;
          const isCurrentFrame = i === drawUpTo;
          const dotOpacity = isCurrentFrame ? 1.0 : opacity * 0.85;
          const sourceWeekCount = positionWeekCount(displayPos);
          const multiWeekScale = Math.min(7, Math.max(0, sourceWeekCount - 1) * 1.8);
          const dotSize = isReturnPoint
            ? Math.max(12, 8 + catchScale + multiWeekScale)
            : Math.max(6, 6 + catchScale + multiWeekScale);

          const icon = isFirstDataPoint
            ? makeStarIcon({
                color,
                size: 16 + multiWeekScale,
                stroke: 'rgba(255,255,255,0.95)',
                strokeWidth: 1.4,
                glow: false,
                opacity: dotOpacity,
              })
            : L.divIcon({
                className: '',
                html: nodeCatchCount > 0 || isReturnPoint
                  ? `<div style="position:relative;width:${dotSize}px;height:${dotSize}px">
                       <div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${color};border:${isReturnPoint ? 3 : 2}px solid rgba(255,255,255,0.92);opacity:${dotOpacity};box-shadow:0 0 ${isReturnPoint ? 18 : isCurrentFrame ? 14 : 6}px ${color}99;"></div>
                     </div>`
                  : `<div style="width:5px;height:5px;border-radius:50%;background:${color};opacity:${dotOpacity * 0.6};border:1px solid rgba(255,255,255,0.4)"></div>`,
                iconSize: [dotSize, dotSize],
                iconAnchor: [dotSize / 2, dotSize / 2],
              });

          const pointKey = `${mv.year}:${i}`;
          const nextPos = positions.slice(i + 1).find((next, offset) => {
            const nextIndex = i + 1 + offset;
            return !firstAttachmentIndexes.has(nextIndex) && !next.isHatchery && !next.isReturn;
          });
          markerEntries.push({
            index: i,
            pointKey,
            displayPos,
            node,
            icon,
            zIndexOffset: isReturnPoint ? 780 : isFirstDataPoint ? 760 : 90,
            isReturnPoint,
            isFirstDataPoint,
            location: isSplitPoint ? node.locationName : displayPos.locationName,
            catchCount: nodeCatchCount,
            recoveryYears: isSplitPoint ? node.recoveryYears : displayPos.recoveryYears,
            eventLabel: isReturnPoint
              ? 'Average First Return to Hatchery'
              : isFirstDataPoint
                ? 'Average First Catch'
                : undefined,
            firstCatchWeekLabel: isFirstDataPoint ? positionWeekLabels(pos)[0] : undefined,
            nextPos,
            previousAnchor: i === firstDataIndex ? { lat: mv.hatcheryLat, lng: mv.hatcheryLng } : undefined,
          });
        }
      }

      const markerGroups: Array<typeof markerEntries> = [];
      for (const entry of markerEntries) {
        const existingGroup = markerGroups.find(existing => (
          existing.every(existingEntry => existingEntry.isReturnPoint === entry.isReturnPoint) &&
          distanceKm(existing[0].node.lat, existing[0].node.lng, entry.node.lat, entry.node.lng) <= STACKED_MARKER_KM
        ));
        if (existingGroup) {
          existingGroup.push(entry);
        } else {
          markerGroups.push([entry]);
        }
      }

      const markerNodeKey = (index: number, node: LatLngPoint) =>
        `${index}:${node.lat.toFixed(5)}:${node.lng.toFixed(5)}`;
      const pathNodeKey = (node: LatLngPoint) =>
        `${node.lat.toFixed(5)}:${node.lng.toFixed(5)}`;
      const displayedNodeByRawNode = new Map<string, BranchNode>();
      type PathNodeRecord = {
        index: number;
        position: WeeklyMovementPosition;
        rawNode: BranchNode;
        displayedNode: BranchNode;
      };
      const pathNodeRecords = new Map<string, PathNodeRecord[]>();
      const pendingReturnLegs: Array<{
        fromIndex: number;
        fromPosition: WeeklyMovementPosition;
        fromRawNode: BranchNode;
        fromDisplayedNode: BranchNode;
        toIndex: number;
        toPosition: WeeklyMovementPosition;
        toRawNode: BranchNode;
        toDisplayedNode: BranchNode;
        explicitReturn: boolean;
        terminalLeaf: boolean;
      }> = [];
      const outgoingPathRecordKeys = new Set<string>();
      const drawnPathLegKeys = new Set<string>();
      const reachablePathNodeKeys = new Set<string>();
      const visibleIndexForPathIndex = (index: number) =>
        firstAttachmentIndexes.has(index) && firstDataIndex >= 0 ? firstDataIndex : index;
      const canReturnFromNode = (node: LatLngPoint) => pointInsideConfiguredBoundary(node, boundaryContext);

      for (const markerGroup of markerGroups) {
        markerGroup.sort((a, b) => positionMovementDay(a.displayPos) - positionMovementDay(b.displayPos));
        const primary = markerGroup.find(entry => entry.isFirstDataPoint) ?? markerGroup[0];
        for (const entry of markerGroup) {
          displayedNodeByRawNode.set(markerNodeKey(entry.index, entry.node), primary.node);
        }
      }

      if (firstDataIndex >= 0 && firstAttachmentIndexes.size > 0) {
        const firstDisplayPos = firstCatchDisplayPosition(positions[firstDataIndex], firstAttachments);
        const firstDisplayNodes = branchNodesForPosition(firstDisplayPos, pwsBoundary);
        for (const index of firstAttachmentIndexes) {
          for (const rawNode of branchNodesForPosition(positions[index], pwsBoundary)) {
            const visibleNode = closestBranchNode(rawNode, firstDisplayNodes) ?? firstDisplayNodes[0];
            if (visibleNode) {
              displayedNodeByRawNode.set(markerNodeKey(index, rawNode), visibleNode);
            }
          }
        }
      }

      const displayNodeForPath = (
        index: number,
        node: BranchNode,
        position: WeeklyMovementPosition
      ): BranchNode => {
        if (position.isReturn) return node;
        return displayedNodeByRawNode.get(markerNodeKey(index, node)) ?? node;
      };
      const pathRecordKey = (record: PathNodeRecord) => [
        record.index,
        record.rawNode.lat.toFixed(5),
        record.rawNode.lng.toFixed(5),
        record.displayedNode.lat.toFixed(5),
        record.displayedNode.lng.toFixed(5),
      ].join(':');
      const upsertPathNodeRecord = (
        index: number,
        position: WeeklyMovementPosition,
        rawNode: BranchNode,
        displayedNode: BranchNode
      ): PathNodeRecord => {
        const record: PathNodeRecord = {
          index: visibleIndexForPathIndex(index),
          position,
          rawNode,
          displayedNode,
        };
        const key = pathNodeKey(displayedNode);
        const existingRecords = pathNodeRecords.get(key) ?? [];
        const existingIndex = existingRecords.findIndex(existing => pathRecordKey(existing) === pathRecordKey(record));
        if (existingIndex >= 0) {
          existingRecords[existingIndex] = record;
        } else {
          existingRecords.push(record);
          existingRecords.sort((a, b) => a.index - b.index);
        }
        pathNodeRecords.set(key, existingRecords);
        return record;
      };
      const seedReachablePathNode = (
        index: number,
        position: WeeklyMovementPosition,
        rawNode: BranchNode,
        displayedNode: BranchNode
      ) => {
        const key = pathNodeKey(displayedNode);
        reachablePathNodeKeys.add(key);
        upsertPathNodeRecord(index, position, rawNode, displayedNode);
      };
      const markDrawnPathLeg = (
        fromIndex: number,
        fromPosition: WeeklyMovementPosition,
        fromRawNode: BranchNode,
        fromDisplayedNode: BranchNode,
        toIndex: number,
        toPosition: WeeklyMovementPosition,
        toRawNode: BranchNode,
        toDisplayedNode: BranchNode
      ) => {
        const fromKey = pathNodeKey(fromDisplayedNode);
        const toKey = pathNodeKey(toDisplayedNode);
        reachablePathNodeKeys.add(fromKey);
        reachablePathNodeKeys.add(toKey);
        const fromRecord = upsertPathNodeRecord(fromIndex, fromPosition, fromRawNode, fromDisplayedNode);
        upsertPathNodeRecord(toIndex, toPosition, toRawNode, toDisplayedNode);
        outgoingPathRecordKeys.add(pathRecordKey(fromRecord));
      };
      const closestReachablePathRecord = (target: LatLngPoint, beforeIndex: number) => {
        let closest: {
          key: string;
          record: PathNodeRecord;
          distance: number;
        } | null = null;

        for (const [key, records] of pathNodeRecords.entries()) {
          if (!reachablePathNodeKeys.has(key)) continue;
          for (const record of records) {
            if (record.index >= beforeIndex) continue;
            if (record.position.isHatchery || record.position.isReturn) continue;

            const distance = distanceKm(record.displayedNode.lat, record.displayedNode.lng, target.lat, target.lng);
            if (
              !closest ||
              distance < closest.distance - 0.001 ||
              (Math.abs(distance - closest.distance) <= 0.001 && record.index > closest.record.index)
            ) {
              closest = { key, record, distance };
            }
          }
        }

        return closest;
      };
      const ensureReachablePathNode = (
        index: number,
        position: WeeklyMovementPosition,
        rawNode: BranchNode,
        displayedNode: BranchNode
      ): boolean => {
        const targetKey = pathNodeKey(displayedNode);
        if (reachablePathNodeKeys.has(targetKey)) return true;
        if (index === firstDataIndex) {
          seedReachablePathNode(index, position, rawNode, displayedNode);
          return true;
        }

        const source = closestReachablePathRecord(displayedNode, index);
        if (!source) {
          seedReachablePathNode(index, position, rawNode, displayedNode);
          return true;
        }

        const legKey = movementPathLegKey(source.record.displayedNode, displayedNode, position);
        let bridgeIsVisible = true;
        if (!drawnPathLegKeys.has(legKey)) {
          bridgeIsVisible = drawPathLeg({
            group,
            from: source.record.position,
            to: position,
            fromPoint: source.record.displayedNode,
            toPoint: displayedNode,
            boundaries: boundaryContext,
            color,
            weight,
            opacity: Math.max(0.35, opacity * 0.72),
            isHovered,
            trackLabel,
            map,
            showBoundaryConnectors,
          });
          if (bridgeIsVisible) drawnPathLegKeys.add(legKey);
        }

        if (bridgeIsVisible) {
          markDrawnPathLeg(
            source.record.index,
            source.record.position,
            source.record.rawNode,
            source.record.displayedNode,
            index,
            position,
            rawNode,
            displayedNode
          );
        } else {
          seedReachablePathNode(index, position, rawNode, displayedNode);
        }
        return true;
      };

      if (firstDataIndex >= 0 && firstDataIndex <= drawUpTo) {
        for (const rawNode of branchNodesForPosition(positions[firstDataIndex], pwsBoundary)) {
          seedReachablePathNode(
            firstDataIndex,
            positions[firstDataIndex],
            rawNode,
            displayNodeForPath(firstDataIndex, rawNode, positions[firstDataIndex])
          );
        }
      }

      if (showVicinityLayer && !boundaryContext.isLoading) {
        for (let i = 0; i <= drawUpTo && i < positions.length; i++) {
          const pos = positions[i];
          if (pos.isHatchery || pos.isReturn || !pos.vicinityRadiusKm) continue;
          if (firstAttachmentIndexes.has(i)) continue;
          const displayPos = i === firstDataIndex ? firstCatchDisplayPosition(pos, firstAttachments) : pos;
          const pointKey = `${mv.year}:${i}`;
          const nextPos = positions.slice(i + 1).find((next, offset) => {
            const nextIndex = i + 1 + offset;
            return !firstAttachmentIndexes.has(nextIndex) && !next.isHatchery && !next.isReturn;
          });
          const previousAnchor = i === firstDataIndex ? { lat: mv.hatcheryLat, lng: mv.hatcheryLng } : undefined;
          const polygons: L.Polygon[] = [];
          for (const area of vicinityAreasForPosition(displayPos, nextPos, previousAnchor, pwsBoundary)) {
            const vicinity = L.polygon(area, {
              color,
              weight: 1.2,
              opacity: Math.max(0.25, opacity * 0.7),
              fillColor: color,
              fillOpacity: hoveredYear === null || isHovered ? 0.08 : 0.025,
              interactive: true,
            });
            vicinity.bindTooltip(
              `<strong>${trackLabel}</strong><br/>Likely weekly vicinity<br/>${formatPositionWeekLabel(displayPos)}<br/>Includes current week catch locations<br/>Tracked Fish: ${formatFishCount(displayPos.catchCount)}`,
              { sticky: true, className: 'movement-tooltip' }
            );
            vicinity.on('click', evt => {
              L.DomEvent.stopPropagation(evt.originalEvent);
              showCatchSelection(pointKey, displayPos, nextPos, previousAnchor, color, trackLabel);
            });
            polygons.push(vicinity);
            group.addLayer(vicinity);
          }
          vicinityLayers.set(pointKey, polygons);
        }
      }

      if (showLinesAndArrows && !boundaryContext.isLoading) {
        for (let i = 0; i < drawUpTo; i++) {
          const from = positions[i];
          const to = positions[i + 1];
          const fromNodes = branchNodesForPosition(from, pwsBoundary);
          const toNodes = branchNodesForPosition(to, pwsBoundary);
          for (const [fromPoint, toPoint] of movementBranchPairs(from, to, fromNodes, toNodes, boundaryContext)) {
            const displayedFromPoint = displayNodeForPath(i, fromPoint, from);
            const displayedToPoint = displayNodeForPath(i + 1, toPoint, to);
            if (to.isReturn) {
              pendingReturnLegs.push({
                fromIndex: i,
                fromPosition: from,
                fromRawNode: fromPoint,
                fromDisplayedNode: displayedFromPoint,
                toIndex: i + 1,
                toPosition: to,
                toRawNode: toPoint,
                toDisplayedNode: displayedToPoint,
                explicitReturn: true,
                terminalLeaf: false,
              });
              continue;
            }
            ensureReachablePathNode(i, from, fromPoint, displayedFromPoint);
            const legKey = movementPathLegKey(displayedFromPoint, displayedToPoint, to);
            if (drawnPathLegKeys.has(legKey)) {
              markDrawnPathLeg(i, from, fromPoint, displayedFromPoint, i + 1, to, toPoint, displayedToPoint);
              continue;
            }
            const drewLeg = drawPathLeg({
              group,
              from,
              to,
              fromPoint: displayedFromPoint,
              toPoint: displayedToPoint,
              boundaries: boundaryContext,
              color,
              weight,
              opacity,
              isHovered,
              trackLabel,
              map,
              showBoundaryConnectors,
            });
            if (drewLeg) {
              drawnPathLegKeys.add(legKey);
              markDrawnPathLeg(i, from, fromPoint, displayedFromPoint, i + 1, to, toPoint, displayedToPoint);
            } else {
              seedReachablePathNode(i, from, fromPoint, displayedFromPoint);
              seedReachablePathNode(i + 1, to, toPoint, displayedToPoint);
            }
          }
        }

        const activeSegment = typeof currentDay === 'number'
          ? activeSegmentForDay(positions, currentDay)
          : null;
        if (activeSegment) {
          const from = positions[activeSegment.segmentIndex];
          const to = positions[activeSegment.segmentIndex + 1];
          const segmentT = activeSegment.progress;

          if (segmentT > 0 && !to.isReturn) {
            const partialOpacity = to.isReturn ? Math.max(opacity, 0.85) : opacity;
            const fromNodes = branchNodesForPosition(from, pwsBoundary);
            const toNodes = branchNodesForPosition(to, pwsBoundary);
            for (const [fromPoint, toPoint] of movementBranchPairs(from, to, fromNodes, toNodes, boundaryContext)) {
              const displayedFromPoint = displayNodeForPath(activeSegment.segmentIndex, fromPoint, from);
              const displayedToPoint = displayNodeForPath(activeSegment.segmentIndex + 1, toPoint, to);
              if (to.isReturn && !canReturnFromNode(displayedFromPoint)) continue;
              if (!to.isReturn) ensureReachablePathNode(activeSegment.segmentIndex, from, fromPoint, displayedFromPoint);
              const drewLeg = drawPathLeg({
                group,
                from,
                to,
                fromPoint: displayedFromPoint,
                toPoint: displayedToPoint,
                boundaries: boundaryContext,
                progress: segmentT,
                color,
                weight,
                opacity: partialOpacity,
                isHovered,
                trackLabel,
                map,
                maxArrows: segmentT > 0.15 ? 22 : 0,
                showBoundaryConnectors,
              });
              if (drewLeg) {
                markDrawnPathLeg(
                  activeSegment.segmentIndex,
                  from,
                  fromPoint,
                  displayedFromPoint,
                  activeSegment.segmentIndex + 1,
                  to,
                  toPoint,
                  displayedToPoint
                );
              }
            }
          }
        }

        const returnPositionIndex = positions.findIndex(pos => pos.isReturn);
        const returnPosition = returnPositionIndex >= 0 ? positions[returnPositionIndex] : undefined;
        const returnNodes = returnPosition ? branchNodesForPosition(returnPosition, pwsBoundary) : [];
        const activeReturnSegment = activeSegment &&
          positions[activeSegment.segmentIndex + 1]?.isReturn
          ? activeSegment
          : null;
        const shouldDrawReturnLegs = returnPosition && returnNodes.length > 0 && (
          drawUpTo >= positions.length - 1 || Boolean(activeReturnSegment)
        );
        if (returnPosition && returnNodes.length > 0 && shouldDrawReturnLegs) {
          let returnCandidates = activeReturnSegment ? [] : [...pendingReturnLegs];
          for (const records of Array.from(pathNodeRecords.values())) {
            for (const record of records) {
              if (outgoingPathRecordKeys.has(pathRecordKey(record))) continue;
              if (record.position.isReturn || record.position.isHatchery) continue;

              const returnNode = closestBranchNode(record.displayedNode, returnNodes) ?? returnNodes[0];
              returnCandidates.push({
                fromIndex: record.index,
                fromPosition: record.position,
                fromRawNode: record.rawNode,
                fromDisplayedNode: record.displayedNode,
                toIndex: returnPositionIndex,
                toPosition: returnPosition,
                toRawNode: returnNode,
                toDisplayedNode: returnNode,
                explicitReturn: false,
                terminalLeaf: true,
              });
            }
          }

          const insideReturnCandidates = returnCandidates.filter(candidate => canReturnFromNode(candidate.fromDisplayedNode));
          if (insideReturnCandidates.length > 0) returnCandidates = insideReturnCandidates;

          const returnCandidateGroups: typeof returnCandidates[] = [];
          for (const candidate of returnCandidates) {
            const existingGroup = returnCandidateGroups.find(group => (
              group.some(existing => (
                distanceKm(
                  existing.fromDisplayedNode.lat,
                  existing.fromDisplayedNode.lng,
                  candidate.fromDisplayedNode.lat,
                  candidate.fromDisplayedNode.lng
                ) <= RETURN_LOCAL_AREA_KM
              ))
            ));
            if (existingGroup) {
              existingGroup.push(candidate);
            } else {
              returnCandidateGroups.push([candidate]);
            }
          }

          const bestReturnCandidates = returnCandidateGroups.map(group => (
            group.reduce((best, candidate) => {
              const candidateDay = positionMovementDay(candidate.fromPosition);
              const bestDay = positionMovementDay(best.fromPosition);
              if (Math.abs(candidateDay - bestDay) > MOVEMENT_DAY_EPSILON) {
                return candidateDay > bestDay ? candidate : best;
              }
              if (candidate.terminalLeaf !== best.terminalLeaf) return candidate.terminalLeaf ? candidate : best;
              const candidateCount = candidate.fromDisplayedNode.catchCount || candidate.fromPosition.catchCount || 0;
              const bestCount = best.fromDisplayedNode.catchCount || best.fromPosition.catchCount || 0;
              if (candidateCount !== bestCount) return candidateCount > bestCount ? candidate : best;
              if (candidate.explicitReturn !== best.explicitReturn) return candidate.explicitReturn ? candidate : best;
              return best;
            }, group[0])
          ));

          for (const candidate of bestReturnCandidates) {
            const legKey = movementPathLegKey(candidate.fromDisplayedNode, candidate.toDisplayedNode, candidate.toPosition);
            if (drawnPathLegKeys.has(legKey)) {
              markDrawnPathLeg(
                candidate.fromIndex,
                candidate.fromPosition,
                candidate.fromRawNode,
                candidate.fromDisplayedNode,
                candidate.toIndex,
                candidate.toPosition,
                candidate.toRawNode,
                candidate.toDisplayedNode
              );
              continue;
            }
            const drewReturn = drawPathLeg({
              group,
              from: candidate.fromPosition,
              to: candidate.toPosition,
              fromPoint: candidate.fromDisplayedNode,
              toPoint: candidate.toDisplayedNode,
              boundaries: boundaryContext,
              color,
              weight,
              opacity: Math.max(opacity, 0.75),
              isHovered,
              trackLabel,
              map,
              progress: activeReturnSegment?.progress,
              maxArrows: activeReturnSegment && activeReturnSegment.progress <= 0.15 ? 0 : undefined,
              showBoundaryConnectors,
            });
            if (drewReturn) {
              drawnPathLegKeys.add(legKey);
              if (activeReturnSegment && activeReturnSegment.progress > 0.001 && activeReturnSegment.progress < 0.999) {
                const progressDescriptor = movementProgressDescriptor({
                  fromPoint: candidate.fromDisplayedNode,
                  toPoint: candidate.toDisplayedNode,
                  to: candidate.toPosition,
                  targetNode: candidate.toDisplayedNode,
                  targetNodeCount: returnNodes.length,
                  boundaries: boundaryContext,
                  progress: activeReturnSegment.progress,
                  showBoundaryConnectors,
                });
                if (progressDescriptor) {
                  addMovementProgressMarker({
                    group,
                    descriptor: progressDescriptor.descriptor,
                    color,
                    opacity: Math.max(opacity, 0.95),
                    isHovered,
                    trackLabel,
                  });
                }
              }
              markDrawnPathLeg(
                candidate.fromIndex,
                candidate.fromPosition,
                candidate.fromRawNode,
                candidate.fromDisplayedNode,
                candidate.toIndex,
                candidate.toPosition,
                candidate.toRawNode,
                candidate.toDisplayedNode
              );
            }
          }
        }
      }

      for (const markerGroup of markerGroups) {
        markerGroup.sort((a, b) => positionMovementDay(a.displayPos) - positionMovementDay(b.displayPos));
        const primary = markerGroup.find(entry => entry.isFirstDataPoint) ?? markerGroup[0];
        const stackKey = markerGroup.length === 1
          ? primary.pointKey
          : `${mv.year}:stack:${markerGroup.map(entry => entry.index).join('-')}`;
        const tooltipEntries = markerGroup.map(entry => ({
          displayPos: entry.displayPos,
          location: entry.location,
          catchCount: entry.catchCount,
          recoveryYears: entry.recoveryYears,
          isReturn: entry.isReturnPoint,
          eventLabel: entry.eventLabel,
          firstCatchWeekLabel: entry.firstCatchWeekLabel,
        }));
        const marker = L.marker([primary.node.lat, primary.node.lng], {
          icon: primary.icon,
          zIndexOffset: Math.max(...markerGroup.map(entry => entry.zIndexOffset)) + (markerGroup.length > 1 ? 12 : 0),
        });
        marker.bindTooltip(
          stackedMarkerTooltipHtml({ trackLabel, entries: tooltipEntries, color }),
          { sticky: true, className: 'movement-tooltip' }
        );

        if (!markerGroup.every(entry => entry.isReturnPoint)) {
          marker.on('click', evt => {
            L.DomEvent.stopPropagation(evt.originalEvent);
            if (selectedPointKey === stackKey) {
              clearCatchSelection();
            } else {
              const selectionPos = stackedMarkerDisplayPosition(tooltipEntries, primary.node.lat, primary.node.lng);
              showCatchSelection(stackKey, selectionPos, primary.nextPos, primary.previousAnchor, color, trackLabel);
            }
          });
        }
        group.addLayer(marker);
      }
    }

    group.addTo(map);
    map.on('click', clearCatchSelection);
    groupRef.current = group;
    return () => {
      map.off('click', clearCatchSelection);
      map.removeLayer(group);
    };
  }, [map, movements, enabledYears, hoveredYear, currentFrame, currentDay, showLinesAndArrows, showVicinityLayer, showBoundaryConnectors, pwsBoundary, boundaryContext]);

  return null;
}

// â”€â”€â”€ Animated fish dot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface AnimatedFishLayerProps {
  movements: HatcheryWeeklyMovement[];
  enabledYears: Set<number>;
  hoveredYear: number | null;
  fractionalFrame?: number;
  currentDay?: number;
  showBoundaryConnectors?: boolean;
  boundaryRegion?: string | null;
}

export function AnimatedFishLayer({
  movements,
  enabledYears,
  hoveredYear,
  fractionalFrame = 0,
  currentDay,
  showBoundaryConnectors = true,
  boundaryRegion = 'Prince William Sound',
}: AnimatedFishLayerProps) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);
  const boundaryContext = useMovementBoundaries(boundaryRegion);
  const pwsBoundary = boundaryContext.primary;

  useEffect(() => {
    if (groupRef.current) map.removeLayer(groupRef.current);
    const group = L.layerGroup();
    if (boundaryContext.isLoading) {
      group.addTo(map);
      groupRef.current = group;
      return () => { map.removeLayer(group); };
    }

    const frameIdx = Math.floor(fractionalFrame);
    const frameT = fractionalFrame - frameIdx;

    for (const mv of movements) {
      if (!enabledYears.has(mv.year)) continue;
      const positions = mv.weeklyPositions;
      if (positions.length < 2) continue;
      const color = yearColor(mv.year);
      const trackLabel = mv.label ?? String(mv.year);
      const isHovered = hoveredYear === mv.year;
      const opacity = hoveredYear === null ? 1.0 : isHovered ? 1.0 : 0.25;

      let segIdx = Math.min(frameIdx, positions.length - 2);
      let t = frameT;
      if (typeof currentDay === 'number') {
        const firstDay = positionMovementDay(positions[0]);
        const lastDay = positionMovementDay(positions[positions.length - 1]);
        if (currentDay < firstDay - MOVEMENT_DAY_EPSILON || currentDay > lastDay + MOVEMENT_DAY_EPSILON) continue;

        segIdx = -1;
        for (let i = 0; i < positions.length - 1; i++) {
          const toDay = positionMovementDay(positions[i + 1]);
          if (currentDay <= toDay + MOVEMENT_DAY_EPSILON) {
            segIdx = i;
            break;
          }
        }
        if (segIdx < 0) continue;

        const fromDay = positionMovementDay(positions[segIdx]);
        const toDay = positionMovementDay(positions[segIdx + 1]);
        t = toDay <= fromDay ? 1 : Math.min(1, Math.max(0, (currentDay - fromDay) / (toDay - fromDay)));
      }

      if (t <= 0.001 || t >= 0.999) continue;

      const from = positions[segIdx];
      const to = positions[segIdx + 1];
      const fromNodes = branchNodesForPosition(from, pwsBoundary);
      const toNodes = branchNodesForPosition(to, pwsBoundary);
      const displayNodeForPath = buildDisplayNodeForPath(positions, pwsBoundary, Math.min(segIdx + 1, positions.length - 1));
      const markerDescriptors = new Map<string, MovementProgressDescriptor>();

      for (const [fromPoint, toPoint] of movementBranchPairs(from, to, fromNodes, toNodes, boundaryContext)) {
        const displayedFromPoint = displayNodeForPath(segIdx, fromPoint, from);
        const displayedToPoint = displayNodeForPath(segIdx + 1, toPoint, to);
        const progressDescriptor = movementProgressDescriptor({
          fromPoint: displayedFromPoint,
          toPoint: displayedToPoint,
          to,
          targetNode: toPoint,
          targetNodeCount: toNodes.length,
          boundaries: boundaryContext,
          progress: t,
          showBoundaryConnectors,
        });
        if (!progressDescriptor) continue;

        const existing = markerDescriptors.get(progressDescriptor.key);

        if (existing) {
          const mergedYears = new Set([...existing.recoveryYears, ...progressDescriptor.descriptor.recoveryYears]);
          markerDescriptors.set(progressDescriptor.key, {
            ...existing,
            catchCount: existing.locationName === progressDescriptor.descriptor.locationName
              ? Math.max(existing.catchCount, progressDescriptor.descriptor.catchCount)
              : existing.catchCount + progressDescriptor.descriptor.catchCount,
            recoveryYears: Array.from(mergedYears).sort((a, b) => a - b),
            locationName: existing.locationName === progressDescriptor.descriptor.locationName
              ? existing.locationName
              : `${existing.locationName} + branch`,
          });
        } else {
          markerDescriptors.set(progressDescriptor.key, progressDescriptor.descriptor);
        }
      }

      for (const descriptor of markerDescriptors.values()) {
        addMovementProgressMarker({ group, descriptor, color, opacity, isHovered, trackLabel });
      }
    }

    group.addTo(map);
    groupRef.current = group;
    return () => { map.removeLayer(group); };
  }, [map, movements, enabledYears, hoveredYear, fractionalFrame, currentDay, pwsBoundary, boundaryContext, showBoundaryConnectors]);

  return null;
}

// ─── Hatchery pin ─────────────────────────────────────────────────────────────
export function HatcheryMarker({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (markerRef.current) map.removeLayer(markerRef.current);
    const icon = L.divIcon({
      className: '',
      html: `<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block;filter:drop-shadow(0 0 12px #00bfff)">
        <polygon points="17,2 21.4,12 32,13 24,20.5 26.5,31 17,25.5 7.5,31 10,20.5 2,13 12.6,12" fill="#00bfff" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
      </svg>`,
      iconSize: [34, 34], iconAnchor: [17, 17],
    });
    const marker = L.marker([lat, lng], { icon, zIndexOffset: 700 });
    marker.bindTooltip(`<strong>${name}</strong><br/>🏭 Hatchery Origin / Return`, { className: 'movement-tooltip' });
    marker.addTo(map);
    markerRef.current = marker;
    return () => { map.removeLayer(marker); };
  }, [map, lat, lng, name]);

  return null;
}

// ─── Date view map layer ──────────────────────────────────────────────────────
interface DateViewLayerProps {
  positions: DateViewPosition[];
  hatcheryLat: number;
  hatcheryLng: number;
  hatcheryName: string;
}

export function DateViewLayer({ positions, hatcheryLat, hatcheryLng, hatcheryName }: DateViewLayerProps) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (groupRef.current) map.removeLayer(groupRef.current);
    const group = L.layerGroup();
    const showHatcheryOrigin = hatcheryName.trim().length > 0;

    if (showHatcheryOrigin) {
    const hatchIcon = L.divIcon({
      className: '',
      html: `<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block;filter:drop-shadow(0 0 12px #00bfff)">
        <polygon points="17,2 21.4,12 32,13 24,20.5 26.5,31 17,25.5 7.5,31 10,20.5 2,13 12.6,12" fill="#00bfff" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
      </svg>`,
      iconSize: [34, 34], iconAnchor: [17, 17],
    });
    const hatchMarker = L.marker([hatcheryLat, hatcheryLng], { icon: hatchIcon, zIndexOffset: 700 });
    hatchMarker.bindTooltip(`<strong>${hatcheryName}</strong><br/>🏭 Hatchery`, { className: 'movement-tooltip' });
    group.addLayer(hatchMarker);
    }

    for (const pos of positions) {
      const color = yearColor(pos.runYear);
      const scale = pos.catchCount > 0 ? Math.min(Math.log10(pos.catchCount + 1) * 3, 14) : 4;
      const dotSize = Math.max(8, 6 + scale);

      const dotIcon = L.divIcon({
        className: '',
        html: `<div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 12px ${color}80;"></div>`,
        iconSize: [dotSize, dotSize], iconAnchor: [dotSize / 2, dotSize / 2],
      });

      const m = L.marker([pos.lat, pos.lng], { icon: dotIcon, zIndexOffset: 90 });
      m.bindTooltip(
        `<div style="min-width:150px;line-height:1.6">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></span>
            <strong style="color:#fff;font-size:0.85rem">Run Year ${pos.runYear}</strong>
          </div>
          <div style="color:#00bfff;font-size:0.75rem;font-weight:600;margin-bottom:2px">ISO Week ${pos.isoWeek} · ${pos.calYear}</div>
          <div style="color:rgba(255,255,255,0.6);font-size:0.72rem;margin-bottom:4px">${pos.locationName}</div>
          <div style="color:#4ECDC4;font-size:0.78rem;font-weight:700">🐟 ${pos.catchCount.toLocaleString()} fish</div>
        </div>`,
        { sticky: true, className: 'movement-tooltip' }
      );
      group.addLayer(m);

      if (showHatcheryOrigin) {
      const line = L.polyline([[hatcheryLat, hatcheryLng], [pos.lat, pos.lng]], {
        color, weight: 1.5, opacity: 0.3, dashArray: '4 6',
      });
      group.addLayer(line);
      }
    }

    group.addTo(map);
    groupRef.current = group;
    return () => { map.removeLayer(group); };
  }, [map, positions, hatcheryLat, hatcheryLng, hatcheryName]);

  return null;
}

// ─── Live stats overlay ───────────────────────────────────────────────────────
export interface LiveStatsOverlayProps {
  movements: HatcheryWeeklyMovement[];
  enabledYears: Set<number>;
  currentFrame: number;
  currentWeekLabel: string;
}

export function LiveStatsOverlay({ movements, enabledYears, currentFrame }: LiveStatsOverlayProps) {
  let totalCatch = 0; let activeYears = 0; let weekCatch = 0;
  let sumAllYears = 0;
  for (const mv of movements) {
    sumAllYears += mv.totalCatch;
    if (!enabledYears.has(mv.year)) continue;
    activeYears++;
    const upTo = Math.min(currentFrame + 1, mv.weeklyPositions.length);
    for (let i = 0; i < upTo; i++) {
      if (!mv.weeklyPositions[i].isHatchery) totalCatch += mv.weeklyPositions[i].catchCount;
    }
    const thisWeekPos = mv.weeklyPositions[Math.min(currentFrame, mv.weeklyPositions.length - 1)];
    if (thisWeekPos && !thisWeekPos.isHatchery) weekCatch += thisWeekPos.catchCount;
  }
  if (activeYears === 0) return null;
  return (
    <div className="live-stats-overlay">
      <div className="live-stat">
        <span className="live-stat-label">SUM DATA (All Years)</span>
        <span className="live-stat-value">{sumAllYears.toLocaleString()}</span>
      </div>
      <div className="live-stat-divider" />
      <div className="live-stat">
        <span className="live-stat-label">Cumulative (Selected)</span>
        <span className="live-stat-value">{totalCatch.toLocaleString()}</span>
      </div>
      <div className="live-stat-divider" />
      <div className="live-stat">
        <span className="live-stat-label">This Week</span>
        <span className="live-stat-value live-stat-week">{weekCatch > 0 ? weekCatch.toLocaleString() : '—'}</span>
      </div>
      <div className="live-stat-divider" />
      <div className="live-stat">
        <span className="live-stat-label">Years Shown</span>
        <span className="live-stat-value">{activeYears}</span>
      </div>
    </div>
  );
}

// ─── Playback controls ────────────────────────────────────────────────────────
export interface PlaybackControlsProps {
  isPlaying: boolean; onTogglePlay: () => void; onReset: () => void;
  fractionalFrame: number; maxFrames: number; speed: number;
  onSpeedChange: (s: number) => void; onScrub: (f: number) => void;
  currentWeekLabel: string;
}

export function PlaybackControls({ isPlaying, onTogglePlay, onReset, fractionalFrame, maxFrames, speed, onSpeedChange, onScrub, currentWeekLabel }: PlaybackControlsProps) {
  const pct = maxFrames > 0 ? (fractionalFrame / maxFrames) * 100 : 0;
  return (
    <div className="playback-controls">
      <div className="playback-week-label">{currentWeekLabel}</div>
      <div className="playback-row">
        <button className="playback-btn" onClick={onReset} title="Reset" aria-label="Reset">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 7a5 5 0 1 0 1.5-3.5L2 2v4h4L4.5 4.5A3.5 3.5 0 1 1 3.5 7H2z"/></svg>
        </button>
        <button className="playback-btn play-btn" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying
            ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="4" height="10" rx="1"/><rect x="8" y="2" width="4" height="10" rx="1"/></svg>
            : <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2l10 5-10 5V2z"/></svg>
          }
        </button>
        <input type="range" className="playback-scrubber" min={0} max={maxFrames} step={0.05} value={fractionalFrame} onChange={e => onScrub(parseFloat(e.target.value))} aria-label="Week scrubber" />
        <div className="playback-speed">
          <span>Speed</span>
          <select value={speed} onChange={e => onSpeedChange(parseFloat(e.target.value))} className="speed-select" aria-label="Animation speed">
            <option value={0.25}>0.25×</option>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
            <option value={8}>8×</option>
          </select>
        </div>
      </div>
      <div className="playback-progress-bar">
        <div className="playback-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Week timeline strip ──────────────────────────────────────────────────────
export interface WeekTimelineProps {
  movements: HatcheryWeeklyMovement[];
  enabledYears: Set<number>;
  currentFrame: number;
  maxFrames: number;
  onSeek: (frame: number) => void;
}

export function WeekTimeline({ movements, enabledYears, currentFrame, maxFrames, onSeek }: WeekTimelineProps) {
  if (maxFrames === 0) return null;
  const frames: Array<{ frame: number; label: string; totalCatch: number }> = [];
  for (let f = 0; f <= maxFrames; f++) {
    let label = ''; let totalCatch = 0;
    for (const mv of movements) {
      if (!enabledYears.has(mv.year)) continue;
      const pos = mv.weeklyPositions[Math.min(f, mv.weeklyPositions.length - 1)];
      if (pos) { if (!label) label = pos.weekLabel; totalCatch += pos.catchCount; }
    }
    frames.push({ frame: f, label, totalCatch });
  }
  const maxCatch = Math.max(...frames.map(f => f.totalCatch), 1);
  return (
    <div className="week-timeline">
      <div className="week-timeline-title">Week Timeline</div>
      <div className="week-timeline-track">
        {frames.map(({ frame, label, totalCatch }) => {
          const isCurrent = frame === currentFrame;
          const isPast = frame < currentFrame;
          const barH = totalCatch > 0 ? Math.max(3, (totalCatch / maxCatch) * 28) : 2;
          return (
            <button key={frame} className={`week-tick ${isCurrent ? 'current' : isPast ? 'past' : 'future'}`} onClick={() => onSeek(frame)} title={`${label}${totalCatch > 0 ? ` — ${totalCatch.toLocaleString()} fish` : ''}`} aria-label={label}>
              <div className="week-tick-bar" style={{ height: `${barH}px`, opacity: isPast || isCurrent ? 1 : 0.3 }} />
              {isCurrent && <div className="week-tick-cursor" />}
            </button>
          );
        })}
      </div>
      <div className="week-timeline-label">{frames[currentFrame]?.label ?? ''}</div>
    </div>
  );
}
