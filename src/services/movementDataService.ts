/**
 * Movement Data Service — 100% real RMIS data, no mock data.
 *
 * Life cycle per brood year:
 *   1. Hatchery release (origin point)
 *   2. Each seasonal week that has CWT recoveries -> avg lat/lng over selected years
 *   3. Inferred return to hatchery (natal homing — final context segment)
 *
 * Strategy: collect CWT `tag_code`s from `/release?hatchery_location_code=…`, then
 * query `/recovery?tag_code=…` (RMIS requires a bounded query — see
 * https://www.rmpc.org/submission/api/ — bulk recovery files:
 * https://www.rmpc.org/data-selection/rmis-files/). PSC v5 recovery locations that
 * lack point coordinates get lat/lng via prefix match on the `/location` map.
 *
 * Releases: only `hatchery_location_code` for the resolved hatchery RMIS code(s).
 * Recoveries: all mappable catch/recovery rows except hatchery-return fishery
 * bands, so fishery, survey, research, sport, and similar recovery records can
 * contribute to the weekly movement averages.
 */

import {
  fetchOfficialRecoveryDataFile,
  fetchLocations,
  fetchRecoveries,
  fetchReleases,
  isOceanNonHatcheryFishery,
  SPECIES_CODES,
  type RmisLocation,
  type RmisRecovery,
} from './rmisApiService';
import { OFFICIAL_STAT_AREA_WATER_COORDS } from '../data/statAreaWaterCoords';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HatcheryEntry {
  name: string;
  lat: number;
  lng: number;
  location: string;
  region: string;
  locationCode: string;
  species: Array<{ name: string }>;
}

export interface WeeklyPosition {
  weekIndex: number;
  weekLabel: string;
  /** ISO week number (1-53), retained for shared map/timeline compatibility. */
  isoWeek: number;
  /** Calendar year of this recovery point. */
  recoveryYear: number;
  /** Seasonal day used for time-scaled lifecycle playback (0=start, 367=return). */
  movementDay?: number;
  /** Playback-only day; used to compress slow visual return segments without changing date labels. */
  playbackDay?: number;
  lat: number;
  lng: number;
  catchCount: number;
  locationName: string;
  isHatchery: boolean;
  isReturn: boolean;
  numRecords: number;
  recoveryYears?: number[];
  sourceWeekLabels?: string[];
  sourceWeekSummaries?: WeeklyPositionWeekSummary[];
  isOutlier?: boolean;
  vicinityRadiusKm?: number;
  vicinityMajorKm?: number;
  vicinityMinorKm?: number;
  vicinityBearingDeg?: number;
  catchEvents?: WeeklyCatchEvent[];
}

export interface WeeklyPositionWeekSummary {
  weekLabel: string;
  catchCount: number;
}

export interface WeeklyCatchEvent {
  movementDay: number;
  dateLabel: string;
  lat: number;
  lng: number;
  catchCount: number;
  locationName: string;
  locationCode?: string;
  recoveryYear: number;
}

export interface HatcheryWeeklyMovement {
  year: number;
  label?: string;
  hatcheryName: string;
  hatcheryLat: number;
  hatcheryLng: number;
  weeklyPositions: WeeklyPosition[];
  totalCatch: number;
  weekCount: number;
  species?: string;
  pathConfidence?: PathConfidence;
  lowOfficialData?: boolean;
}

export interface PathConfidence {
  percentage: number;
  trackedFish: number;
  returnedFish: number;
  rawPointCount: number;
  activeDayCount: number;
  timeframeDays: number;
  averageGapDays: number;
  maxGapDays: number;
  routeDistanceKm: number;
  lowOfficialData?: boolean;
  officialWeeklyPointCount?: number;
}

export const YEAR_RANGE_START = 1976;
export const YEAR_RANGE_END = new Date().getFullYear();
export const MOVEMENT_OUTLIER_MIN_TRACKED_FISH = 50;
const MIN_OFFICIAL_WEEKLY_POINTS = 5;
const HATCHERY_RETURN_PLAYBACK_SPEEDUP = 4;

export function allDisplayYears(): number[] {
  const years: number[] = [];
  for (let y = YEAR_RANGE_START; y <= YEAR_RANGE_END; y++) years.push(y);
  return years;
}

const OCEAN_RECOVERY_FISHERY_CODES = Array.from({ length: 100 }, (_, code) => String(code)).filter(code =>
  isOceanNonHatcheryFishery(code)
);
const OCEAN_RECOVERY_PAGE_SIZE = '500';
const OCEAN_RECOVERY_MAX_PAGES_PER_FISHERY = 80;
const _oceanRecoveryYearCache = new Map<number, Promise<RmisRecovery[]>>();
const _officialRecoveryYearCache = new Map<number, Promise<RmisRecovery[]>>();
const _officialRecoveryTagIndexCache = new Map<number, Promise<Map<string, RmisRecovery[]>>>();
const OFFICIAL_ALASKA_RECOVERY_FILE_PREFIX = 'RC050_ADFG';
const OFFICIAL_LOCATION_FILE = 'LC050_ALL_FULLSET.csv';
let _officialLocationMapPromise: Promise<Map<string, RmisLocation>> | null = null;

const SALMON_SPECIES_CODES = ['1', '4', '2', '5', '6'];
const MOVEMENT_SPECIES_DISPLAY_NAMES: Record<string, string> = {
  '1': 'King (Chinook)',
  '2': 'Silver (Coho)',
  '4': 'Red (Sockeye)',
  '5': 'Pink (Humpy)',
  '6': 'Chum (Dog)',
};

export const MOVEMENT_SPECIES_OPTIONS = SALMON_SPECIES_CODES.map(code => ({
  code,
  name: MOVEMENT_SPECIES_DISPLAY_NAMES[code] ?? SPECIES_CODES[code] ?? `Species ${code}`,
}));

function recoveryDateParts(rec: RmisRecovery): { calYear: number; month: number; day: number; date: Date } | null {
  const compactDate = String(rec.recovery_date ?? '').replace(/\D/g, '');
  const calYear = Number(rec.recovery_date_year ?? (compactDate.length >= 4 ? compactDate.slice(0, 4) : 0));
  const month = Number(rec.recovery_date_month ?? (compactDate.length >= 6 ? compactDate.slice(4, 6) : 0));
  const day = Number(rec.recovery_date_day ?? (compactDate.length >= 8 ? compactDate.slice(6, 8) : 15));
  if (!calYear || !month || month < 1 || month > 12) return null;
  const safeDay = Math.min(Math.max(day || 15, 1), 31);
  const date = new Date(calYear, month - 1, safeDay);
  if (Number.isNaN(date.getTime())) return null;
  return { calYear, month, day: safeDay, date };
}

function recoveryCatchCount(rec: RmisRecovery): number {
  const raw = Number(rec.number_cwt_estimated ?? rec.estimated_number ?? 1);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function validRecoveryCoords(lat: number, lng: number): boolean {
  return lat >= 40 && lat <= 72 && lng >= -180 && lng <= -110;
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

const LOW_COUNT_TOWN_FALSE_FLAG_MAX_CATCH = 5;
const TOWN_POINT_FALSE_FLAG_RADIUS_KM = 5;
const LOW_COUNT_TOWN_FALSE_FLAG_RADIUS_KM = 10;
const HATCHERY_NEAR_TOWN_RADIUS_KM = 30;
const HATCHERY_RETURN_RADIUS_KM = 2.5;
const FALSE_FLAG_TOWNS = [
  { name: 'Cordova', lat: 60.5428, lng: -145.7575 },
  { name: 'Valdez', lat: 61.1308, lng: -146.3483 },
  { name: 'Whittier', lat: 60.7731, lng: -148.6834 },
  { name: 'Seward', lat: 60.1042, lng: -149.4422 },
  { name: 'Homer', lat: 59.6425, lng: -151.5483 },
  { name: 'Kenai', lat: 60.5544, lng: -151.2583 },
  { name: 'Anchorage', lat: 61.2181, lng: -149.9003 },
  { name: 'Kodiak', lat: 57.79, lng: -152.4072 },
  { name: 'Juneau', lat: 58.3019, lng: -134.4197 },
  { name: 'Sitka', lat: 57.0531, lng: -135.33 },
  { name: 'Ketchikan', lat: 55.3422, lng: -131.6461 },
  { name: 'Wrangell', lat: 56.4708, lng: -132.3767 },
  { name: 'Petersburg', lat: 56.8125, lng: -132.9556 },
  { name: 'Craig', lat: 55.4764, lng: -133.1483 },
  { name: 'Yakutat', lat: 59.5469, lng: -139.7272 },
  { name: 'Dillingham', lat: 59.0397, lng: -158.4575 },
  { name: 'Naknek', lat: 58.7283, lng: -157.0139 },
  { name: 'King Salmon', lat: 58.6883, lng: -156.6614 },
  { name: 'Sand Point', lat: 55.3397, lng: -160.4972 },
  { name: 'Nome', lat: 64.5011, lng: -165.4064 },
];

function isTownFalseFlag(
  recLat: number,
  recLng: number,
  catchCount: number,
  hatchery: HatcheryEntry
): boolean {
  return FALSE_FLAG_TOWNS.some(town => {
    const hatcheryTownDistanceKm = distanceKm(hatchery.lat, hatchery.lng, town.lat, town.lng);
    if (hatcheryTownDistanceKm <= HATCHERY_NEAR_TOWN_RADIUS_KM) return false;

    const recoveryTownDistanceKm = distanceKm(recLat, recLng, town.lat, town.lng);
    if (recoveryTownDistanceKm <= TOWN_POINT_FALSE_FLAG_RADIUS_KM) return true;
    return (
      catchCount < LOW_COUNT_TOWN_FALSE_FLAG_MAX_CATCH &&
      recoveryTownDistanceKm <= LOW_COUNT_TOWN_FALSE_FLAG_RADIUS_KM
    );
  });
}

function recoveryLocationName(rec: RmisRecovery, locationMap: Map<string, RmisLocation>): string {
  const loc = locationMap.get(rec.recovery_location_code);
  return String(loc?.name ?? loc?.location_name ?? rec.recovery_location_code);
}

function isJuvenileSamplingFishery(fishery: string | undefined): boolean {
  if (fishery == null || String(fishery).trim() === '') return false;
  const n = parseInt(String(fishery).trim(), 10);
  if (Number.isNaN(n)) return false;
  return n >= 70 && n <= 79;
}

function isMovementRecoveryFishery(fishery: string | undefined): boolean {
  if (fishery == null || String(fishery).trim() === '') return true;
  // Juvenile sampling tracks a different life-stage movement path than the
  // adult recovery path shown here.
  return !isJuvenileSamplingFishery(fishery);
}

function normalizeLocationCode(code: unknown): string {
  return String(code ?? '').trim().toUpperCase();
}

function locationNameMatchesHatchery(locName: string, hatchery: HatcheryEntry): boolean {
  const locKey = hatcheryLookupKey(locName);
  if (!locKey) return false;
  return movementHatcheryAliases(hatchery.name).some(alias => {
    const aliasKey = hatcheryLookupKey(alias);
    return Boolean(aliasKey) && (locKey.includes(aliasKey) || aliasKey.includes(locKey));
  });
}

function isSelectedHatcheryReturnRecovery(
  rec: RmisRecovery,
  hatchery: HatcheryEntry,
  locationMap: Map<string, RmisLocation>,
  hatcheryCodeSet: Set<string>
): boolean {
  const rawCode = String(rec.recovery_location_code ?? '').trim();
  if (rawCode && hatcheryCodeSet.has(normalizeLocationCode(rawCode))) return true;
  if (!rawCode) return false;

  const loc = locationMap.get(rawCode);
  if (loc && String(loc.location_type ?? '').trim() === '3') {
    const locName = String(loc.name ?? loc.location_name ?? '');
    if (locationNameMatchesHatchery(locName, hatchery)) return true;
  }

  const coords = resolveCoords(rawCode, locationMap);
  if (!coords) return false;
  return distanceKm(coords[0], coords[1], hatchery.lat, hatchery.lng) <= HATCHERY_RETURN_RADIUS_KM;
}

function isHatcheryLocationRecovery(
  rec: RmisRecovery,
  recLat: number,
  recLng: number,
  hatchery: HatcheryEntry,
  locationMap: Map<string, RmisLocation>
): boolean {
  const loc = locationMap.get(rec.recovery_location_code);
  if (String(loc?.location_type ?? '').trim() === '3') return true;
  return distanceKm(recLat, recLng, hatchery.lat, hatchery.lng) <= HATCHERY_RETURN_RADIUS_KM;
}

function normalizedMovementDay(day: number): number {
  if (!Number.isFinite(day)) return 1;
  return ((Math.max(1, Math.round(day)) - 1) % 365) + 1;
}

function movementDayLabel(day: number): string {
  const normalizedDay = normalizedMovementDay(day);
  const date = new Date(2001, 0, normalizedDay);
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
}

interface HatcheryReturnBucket {
  weightedMovementDay: number;
  weight: number;
  catchTotal: number;
  numRecords: number;
  years: Set<number>;
}

interface HatcheryReturnInfo {
  movementDay: number;
  catchTotal: number;
  numRecords: number;
  years: number[];
}

interface ConfidenceRecoveryPoint {
  movementDay: number;
  lat: number;
  lng: number;
  count: number;
  year: number;
  dateLabel?: string;
  locationName?: string;
  locationCode?: string;
}

interface DailyConfidencePoint {
  movementDay: number;
  lat: number;
  lng: number;
  count: number;
}

interface VicinityEllipse {
  radiusKm: number;
  majorKm: number;
  minorKm: number;
  bearingDeg: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function buildPathConfidence(
  points: ConfidenceRecoveryPoint[],
  returnInfo: HatcheryReturnInfo | undefined,
  hatchery: HatcheryEntry,
  selectedYearCount: number,
  lowOfficialData = false,
  officialWeeklyPointCount = points.length
): PathConfidence {
  const trackedFish = points.reduce((sum, point) => sum + point.count, 0);
  const returnedFish = returnInfo?.catchTotal ?? 0;

  if (points.length === 0 || trackedFish <= 0) {
    return {
      percentage: 0,
      trackedFish,
      returnedFish,
      rawPointCount: points.length,
      activeDayCount: 0,
      timeframeDays: 0,
      averageGapDays: 0,
      maxGapDays: 0,
      routeDistanceKm: 0,
      lowOfficialData,
      officialWeeklyPointCount,
    };
  }

  const dailyMap = new Map<number, {
    weightedLat: number;
    weightedLng: number;
    count: number;
    records: number;
  }>();
  const observedYears = new Set<number>();

  for (const point of points) {
    observedYears.add(point.year);
    const day = normalizedMovementDay(point.movementDay);
    const bucket = dailyMap.get(day) ?? {
      weightedLat: 0,
      weightedLng: 0,
      count: 0,
      records: 0,
    };
    bucket.weightedLat += point.lat * point.count;
    bucket.weightedLng += point.lng * point.count;
    bucket.count += point.count;
    bucket.records += 1;
    dailyMap.set(day, bucket);
  }

  if (returnInfo) {
    for (const year of returnInfo.years) observedYears.add(year);
  }

  const dailyPoints: DailyConfidencePoint[] = Array.from(dailyMap.entries())
    .map(([movementDay, bucket]) => ({
      movementDay,
      lat: bucket.weightedLat / Math.max(bucket.count, 1),
      lng: bucket.weightedLng / Math.max(bucket.count, 1),
      count: bucket.count,
    }))
    .sort((a, b) => a.movementDay - b.movementDay);

  const activeDayCount = dailyPoints.length;
  const lastCatchDay = dailyPoints[dailyPoints.length - 1]?.movementDay ?? dailyPoints[0].movementDay;
  const returnMovementDay = returnInfo
    ? returnInfo.movementDay <= lastCatchDay ? returnInfo.movementDay + 365 : returnInfo.movementDay
    : undefined;

  const routePoints: DailyConfidencePoint[] = returnMovementDay
    ? [
        ...dailyPoints,
        {
          movementDay: returnMovementDay,
          lat: hatchery.lat,
          lng: hatchery.lng,
          count: Math.max(returnedFish, 1),
        },
      ]
    : dailyPoints;

  const gaps: number[] = [];
  const speedScores: number[] = [];
  let routeDistanceKm = 0;

  for (let i = 1; i < routePoints.length; i++) {
    const prev = routePoints[i - 1];
    const next = routePoints[i];
    const gap = Math.max(0.25, next.movementDay - prev.movementDay);
    if (gap <= 0) continue;
    const dist = distanceKm(prev.lat, prev.lng, next.lat, next.lng);
    routeDistanceKm += dist;
    gaps.push(gap);

    const speedKmPerDay = dist / gap;
    const speedPenalty = Math.max(0, speedKmPerDay - 90) / 140;
    speedScores.push(1 / (1 + speedPenalty * speedPenalty));
  }

  const timeframeDays = Math.max(1, routePoints[routePoints.length - 1].movementDay - routePoints[0].movementDay);
  const averageGapDays = gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : timeframeDays;
  const maxGapDays = gaps.length > 0 ? Math.max(...gaps) : timeframeDays;
  const dailyCounts = dailyPoints.map(point => point.count);
  const countSquaredSum = dailyCounts.reduce((sum, count) => sum + count * count, 0);
  const effectiveDayCount = countSquaredSum > 0 ? trackedFish * trackedFish / countSquaredSum : activeDayCount;
  const observedYearCount = observedYears.size;
  const selectedYearBaseline = selectedYearCount > 0 ? selectedYearCount : Math.max(observedYearCount, 1);
  const observedYearScore = selectedYearCount > 0
    ? clamp01(0.25 + 0.75 * Math.sqrt(clamp01(observedYearCount / selectedYearBaseline)))
    : clamp01(1 - Math.exp(-observedYearCount / 5));

  const fishSupport = clamp01(Math.log1p(trackedFish) / Math.log1p(120000));
  const returnReference = Math.max(500, trackedFish * 0.08);
  const returnSupport = returnInfo && returnedFish > 0
    ? clamp01(0.2 + 0.8 * Math.log1p(returnedFish) / Math.log1p(returnReference))
    : 0;
  const pointSupport = clamp01(Math.log1p(points.length) / Math.log1p(240));
  const daySupport = clamp01(Math.log1p(effectiveDayCount) / Math.log1p(36));
  const officialWeekSupport = clamp01(officialWeeklyPointCount / 14);
  const dayBalanceSupport = activeDayCount > 0 ? clamp01(effectiveDayCount / activeDayCount) : 0;
  const sampleSupport =
    0.32 * pointSupport +
    0.28 * daySupport +
    0.22 * officialWeekSupport +
    0.18 * dayBalanceSupport;
  const shortSpanSupport = clamp01(timeframeDays / 35);
  const longSpanSupport = timeframeDays > 240 ? clamp01(1 - (timeframeDays - 240) / 160) : 1;
  const spanSupport = 0.25 + 0.75 * clamp01(shortSpanSupport * longSpanSupport);
  const continuitySupport =
    0.6 * (1 / (1 + Math.max(0, averageGapDays - 7) / 10)) +
    0.4 * (1 / (1 + Math.max(0, maxGapDays - 21) / 35));
  const spatialSupport = speedScores.length > 0
    ? speedScores.reduce((sum, score) => sum + score, 0) / speedScores.length
    : 0.4;
  const routeAverageSpeedKmPerDay = routeDistanceKm / Math.max(timeframeDays, 1);
  const routePlausibilitySupport = 1 / (1 + Math.max(0, routeAverageSpeedKmPerDay - 65) / 90);

  const evidenceRatio =
    0.35 * fishSupport +
    0.27 * sampleSupport +
    0.23 * observedYearScore +
    0.15 * returnSupport;
  const structureRatio =
    0.36 * continuitySupport +
    0.26 * spatialSupport +
    0.18 * routePlausibilitySupport +
    0.12 * spanSupport +
    0.08 * officialWeekSupport;
  const confidenceRatio = clamp01(
    0.03 +
    0.97 * Math.pow(clamp01(evidenceRatio), 0.9) * Math.pow(clamp01(structureRatio), 1.15)
  );
  const basePercentage = Math.round(clamp01(confidenceRatio) * 100);
  const returnAdjustedPercentage = returnedFish === 0 ? Math.round(basePercentage * 0.8) : basePercentage;
  const percentage = lowOfficialData ? Math.max(0, returnAdjustedPercentage - 20) : returnAdjustedPercentage;

  return {
    percentage,
    trackedFish,
    returnedFish,
    rawPointCount: points.length,
    activeDayCount,
    timeframeDays: Math.round(timeframeDays),
    averageGapDays: Number(averageGapDays.toFixed(1)),
    maxGapDays: Math.round(maxGapDays),
    routeDistanceKm: Math.round(routeDistanceKm),
    lowOfficialData,
    officialWeeklyPointCount,
  };
}

function weightedPercentile(values: Array<{ value: number; weight: number }>, percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = values
    .filter(item => Number.isFinite(item.value) && item.value >= 0 && item.weight > 0)
    .sort((a, b) => a.value - b.value);
  if (sorted.length === 0) return 0;

  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  const target = totalWeight * clamp01(percentile);
  let running = 0;
  for (const item of sorted) {
    running += item.weight;
    if (running >= target) return item.value;
  }
  return sorted[sorted.length - 1].value;
}

function weeklyVicinityEllipse(points: ConfidenceRecoveryPoint[], centerLat: number, centerLng: number): VicinityEllipse {
  if (points.length <= 1) {
    return { radiusKm: 5, majorKm: 5, minorKm: 3, bearingDeg: 0 };
  }

  const latKm = 110.574;
  const lngKm = Math.max(20, 111.32 * Math.cos(centerLat * Math.PI / 180));
  const projected = points.map(point => {
    const x = (point.lng - centerLng) * lngKm;
    const y = (point.lat - centerLat) * latKm;
    return {
      x,
      y,
      distance: Math.sqrt(x * x + y * y),
      weight: Math.max(point.count, 1),
    };
  });

  const clipDistance = Math.max(6, weightedPercentile(projected.map(point => ({
    value: point.distance,
    weight: point.weight,
  })), 0.68));
  const clipped = projected.filter(point => point.distance <= clipDistance);
  const usable = clipped.length >= 2 ? clipped : projected.slice().sort((a, b) => a.distance - b.distance).slice(0, 2);
  const totalWeight = usable.reduce((sum, point) => sum + point.weight, 0);

  const meanX = usable.reduce((sum, point) => sum + point.x * point.weight, 0) / Math.max(totalWeight, 1);
  const meanY = usable.reduce((sum, point) => sum + point.y * point.weight, 0) / Math.max(totalWeight, 1);
  const varX = usable.reduce((sum, point) => sum + (point.x - meanX) ** 2 * point.weight, 0) / Math.max(totalWeight, 1);
  const varY = usable.reduce((sum, point) => sum + (point.y - meanY) ** 2 * point.weight, 0) / Math.max(totalWeight, 1);
  const covXY = usable.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY) * point.weight, 0) / Math.max(totalWeight, 1);
  const trace = varX + varY;
  const delta = Math.sqrt(Math.max(0, ((varX - varY) / 2) ** 2 + covXY ** 2));
  const lambda1 = Math.max(0, trace / 2 + delta);
  const lambda2 = Math.max(0, trace / 2 - delta);
  const angleFromEast = 0.5 * Math.atan2(2 * covXY, varX - varY);
  const bearingDeg = (90 - angleFromEast * 180 / Math.PI + 360) % 360;

  const weightedSpread = weightedPercentile(usable.map(point => ({
    value: point.distance,
    weight: point.weight,
  })), 0.78);
  const majorKm = Math.min(24, Math.max(4, Math.sqrt(lambda1) * 1.65 + weightedSpread * 0.25 + 3));
  const minorKm = Math.min(12, Math.max(2.5, Math.sqrt(lambda2) * 1.65 + 2.5));
  const radiusKm = Math.sqrt(majorKm * minorKm);

  return {
    radiusKm: Math.round(radiusKm * 10) / 10,
    majorKm: Math.round(majorKm * 10) / 10,
    minorKm: Math.round(Math.min(minorKm, majorKm) * 10) / 10,
    bearingDeg,
  };
}

function compactWeeklyCatchEvents(events: WeeklyCatchEvent[]): WeeklyCatchEvent[] {
  const groups = new Map<string, WeeklyCatchEvent>();

  for (const event of events) {
    const key = [
      event.lat.toFixed(5),
      event.lng.toFixed(5),
      event.movementDay,
      event.recoveryYear,
      event.dateLabel,
      event.locationCode ?? '',
      event.locationName,
    ].join('|');
    const existing = groups.get(key);
    if (existing) {
      existing.catchCount += event.catchCount;
    } else {
      groups.set(key, { ...event });
    }
  }

  return Array.from(groups.values()).sort((a, b) => (
    a.movementDay - b.movementDay ||
    a.recoveryYear - b.recoveryYear ||
    a.locationName.localeCompare(b.locationName)
  ));
}

function buildHatcheryReturnDateMap(
  recoveries: RmisRecovery[],
  selectedRecoveryYears: Set<number>,
  selectedSpeciesCodes: Set<string>,
  tagSpecies: Map<string, string>,
  hatchery: HatcheryEntry,
  locationMap: Map<string, RmisLocation>,
  hatcheryLocationCodes: string[]
): Map<string, HatcheryReturnInfo> {
  const buckets = new Map<string, HatcheryReturnBucket>();
  const hatcheryCodeSet = new Set(hatcheryLocationCodes.map(normalizeLocationCode));

  for (const rec of recoveries) {
    const parts = recoveryDateParts(rec);
    if (!parts) continue;
    if (selectedRecoveryYears.size > 0 && !selectedRecoveryYears.has(parts.calYear)) continue;
    if (isJuvenileSamplingFishery(String(rec.fishery ?? ''))) continue;
    if (!isSelectedHatcheryReturnRecovery(rec, hatchery, locationMap, hatcheryCodeSet)) continue;

    const recoveryTag = String(rec.tag_code ?? '').trim();
    const speciesCode = String(rec.species ?? tagSpecies.get(recoveryTag) ?? '');
    if (!speciesCode) continue;
    if (selectedSpeciesCodes.size > 0 && !selectedSpeciesCodes.has(speciesCode)) continue;

    const count = recoveryCatchCount(rec);

    if (!buckets.has(speciesCode)) {
      buckets.set(speciesCode, {
        weightedMovementDay: 0,
        weight: 0,
        catchTotal: 0,
        numRecords: 0,
        years: new Set(),
      });
    }

    const bucket = buckets.get(speciesCode)!;
    const weight = Math.max(count, 1);
    bucket.weightedMovementDay += dayOfYear(parts.date) * weight;
    bucket.weight += weight;
    bucket.catchTotal += count;
    bucket.numRecords++;
    bucket.years.add(parts.calYear);
  }

  const output = new Map<string, HatcheryReturnInfo>();
  for (const [speciesCode, bucket] of buckets) {
    if (bucket.weight <= 0) continue;
    output.set(speciesCode, {
      movementDay: normalizedMovementDay(bucket.weightedMovementDay / bucket.weight),
      catchTotal: bucket.catchTotal,
      numRecords: bucket.numRecords,
      years: Array.from(bucket.years).sort((a, b) => a - b),
    });
  }

  return output;
}

async function fetchOceanRecoveryRecordsForYear(year: number): Promise<RmisRecovery[]> {
  if (_oceanRecoveryYearCache.has(year)) return _oceanRecoveryYearCache.get(year)!;

  const promise = (async () => {
    const seen = new Set<string>();
    const records: RmisRecovery[] = [];

    async function fetchFishery(fishery: string): Promise<void> {
      for (let page = 1; page <= OCEAN_RECOVERY_MAX_PAGES_PER_FISHERY; page++) {
        let res;
        try {
          res = await fetchRecoveries({
            recovery_date_year: String(year),
            fishery,
            perpage: OCEAN_RECOVERY_PAGE_SIZE,
            page: String(page),
          });
        } catch {
          break;
        }

        const pageRecords = res.records ?? [];
        for (const rec of pageRecords) {
          if (!isOceanNonHatcheryFishery(String(rec.fishery ?? ''))) continue;
          const parts = recoveryDateParts(rec);
          if (!parts || parts.calYear !== year) continue;
          const key = String(rec.id ?? rec.recovery_id ?? `${rec.recovery_location_code}-${rec.tag_code}-${parts.calYear}-${parts.month}-${parts.day}-${rec.fishery}`);
          if (seen.has(key)) continue;
          seen.add(key);
          records.push(rec);
        }

        if (pageRecords.length < Number(OCEAN_RECOVERY_PAGE_SIZE)) break;
      }
    }

    const batchSize = 4;
    for (let i = 0; i < OCEAN_RECOVERY_FISHERY_CODES.length; i += batchSize) {
      const batch = OCEAN_RECOVERY_FISHERY_CODES.slice(i, i + batchSize);
      await Promise.all(batch.map(fetchFishery));
    }

    return records;
  })();

  _oceanRecoveryYearCache.set(year, promise);
  return promise;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function compactRecoveryDateParts(value: string): { year: number; month: number; day: number } | null {
  const compact = value.replace(/\D/g, '');
  if (compact.length < 6) return null;
  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6));
  const day = Number(compact.slice(6, 8) || '15');
  if (!year || !month || month < 1 || month > 12) return null;
  return { year, month, day: Math.min(Math.max(day || 15, 1), 31) };
}

function csvNumber(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function yieldToMainThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function normalizeRecoveryCsvRecord(row: Record<string, string>, fallbackYear: number, filename: string): RmisRecovery | null {
  const dateParts = compactRecoveryDateParts(row.recovery_date ?? '');
  if (!dateParts) return null;

  const recoveryId = row.recovery_id?.trim() || `${filename}:${row.tag_code}:${row.recovery_date}:${row.recovery_location_code}`;
  const runYear = csvNumber(row.run_year) ?? dateParts.year ?? fallbackYear;

  return {
    id: `${filename}:${recoveryId}`,
    record_code: row.record_code?.trim() || 'R',
    format_version: row.format_version?.trim() || '',
    submission_date: row.submission_date?.trim() || '',
    reporting_agency: row.reporting_agency?.trim() || '',
    sampling_agency: row.sampling_agency?.trim() || undefined,
    recovery_id: recoveryId,
    species: row.species?.trim() || '',
    run_year: runYear,
    recovery_date_year: dateParts.year,
    recovery_date_month: dateParts.month,
    recovery_date_day: dateParts.day,
    recovery_date_type: row.recovery_date_type?.trim() || undefined,
    recovery_date: row.recovery_date?.trim(),
    period_type: row.period_type?.trim() || '',
    period: row.period?.trim() || undefined,
    fishery: row.fishery?.trim() || '',
    gear: row.gear?.trim() || undefined,
    adclip_selective_fishery: row.adclip_selective_fishery?.trim() || undefined,
    estimation_level: row.estimation_level?.trim() || undefined,
    recovery_location_code: row.recovery_location_code?.trim() || '',
    sampling_site: row.sampling_site?.trim() || undefined,
    recorded_mark: row.recorded_mark?.trim() || undefined,
    tag_code: row.tag_code?.trim() || undefined,
    tag_status: row.tag_status?.trim() || undefined,
    unresolved_reason: row.unresolved_reason?.trim() || undefined,
    number_cwt_estimated: csvNumber(row.number_cwt_estimated),
    sampled_maturity: row.sampled_maturity?.trim() || undefined,
    sampled_sex: row.sampled_sex?.trim() || undefined,
    sampled_run: row.sampled_run?.trim() || undefined,
    sampled_length: csvNumber(row.sampled_length_range),
    detection_method: row.detection_method?.trim() || undefined,
  };
}

function normalizeLocationCsvRecord(row: Record<string, string>, filename: string): RmisLocation | null {
  const locationCode = row.location_code?.trim();
  if (!locationCode) return null;

  return {
    id: `${filename}:${locationCode}:${row.location_type?.trim() ?? ''}`,
    location_code: locationCode,
    location_type: row.location_type?.trim() || '',
    name: row.name?.trim() || row.location_name?.trim() || undefined,
    location_name: row.location_name?.trim() || row.name?.trim() || undefined,
    psc_region: row.psc_region?.trim() || undefined,
    psc_basin: row.psc_basin?.trim() || undefined,
    state_or_province: row.state_or_province?.trim() || undefined,
    latitude: csvNumber(row.latitude),
    longitude: csvNumber(row.longitude),
    description: row.description?.trim() || undefined,
    epa_reach: row.epa_reach?.trim() || undefined,
  };
}

async function fetchOfficialLocationMap(): Promise<Map<string, RmisLocation>> {
  if (_officialLocationMapPromise) return _officialLocationMapPromise;

  _officialLocationMapPromise = (async () => {
    const map = new Map<string, RmisLocation>();
    const csvText = await fetchOfficialRecoveryDataFile(OFFICIAL_LOCATION_FILE);
    if (!csvText.trim()) return map;

    const rows = parseCsvRows(csvText);
    const header = rows.shift()?.map(col => col.trim()) ?? [];
    if (header.length === 0) return map;

    for (const cells of rows) {
      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = cells[i]?.trim() ?? '';
      const loc = normalizeLocationCsvRecord(row, OFFICIAL_LOCATION_FILE);
      if (loc) preferLocationRecord(map, loc);
    }

    return map;
  })();

  return _officialLocationMapPromise;
}

async function fetchOfficialRecoveryRecordsForYear(year: number): Promise<RmisRecovery[]> {
  if (_officialRecoveryYearCache.has(year)) return _officialRecoveryYearCache.get(year)!;

  const promise = (async () => {
    const filename = `${OFFICIAL_ALASKA_RECOVERY_FILE_PREFIX}_${year}.csv`;
    const csvText = await fetchOfficialRecoveryDataFile(filename);
    if (!csvText.trim()) return [];

    const rows = parseCsvRows(csvText);
    const header = rows.shift()?.map(col => col.trim()) ?? [];
    if (header.length === 0) return [];

    const records: RmisRecovery[] = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const cells = rows[rowIndex];
      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = cells[i]?.trim() ?? '';
      const rec = normalizeRecoveryCsvRecord(row, year, filename);
      if (rec) records.push(rec);
      if (rowIndex > 0 && rowIndex % 5000 === 0) await yieldToMainThread();
    }

    return records;
  })();

  _officialRecoveryYearCache.set(year, promise);
  return promise;
}

function officialRecoveryRecordKey(rec: RmisRecovery): string {
  const tag = String(rec.tag_code ?? '').trim();
  return String(
    rec.id ??
    rec.recovery_id ??
    `${tag}-${rec.recovery_date_year}-${rec.recovery_date_month}-${rec.recovery_date_day}-${rec.fishery}-${rec.recovery_location_code}`
  );
}

async function fetchOfficialRecoveryTagIndexForYear(year: number): Promise<Map<string, RmisRecovery[]>> {
  if (_officialRecoveryTagIndexCache.has(year)) return _officialRecoveryTagIndexCache.get(year)!;

  const promise = (async () => {
    const index = new Map<string, RmisRecovery[]>();
    const records = await fetchOfficialRecoveryRecordsForYear(year);
    for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
      const rec = records[recordIndex];
      const tag = String(rec.tag_code ?? '').trim();
      if (!tag) continue;
      const list = index.get(tag);
      if (list) {
        list.push(rec);
      } else {
        index.set(tag, [rec]);
      }
      if (recordIndex > 0 && recordIndex % 10000 === 0) await yieldToMainThread();
    }
    return index;
  })();

  _officialRecoveryTagIndexCache.set(year, promise);
  return promise;
}

async function fetchOfficialRecoveryRecordsForTagsByYears(tagCodes: Set<string>, years: number[]): Promise<RmisRecovery[]> {
  if (tagCodes.size === 0 || years.length === 0) return [];

  const sortedYears = Array.from(new Set(years)).sort((a, b) => a - b);
  const tagCodeArray = Array.from(tagCodes);
  const output: RmisRecovery[] = [];
  const seen = new Set<string>();
  const batchSize = 4;

  for (let i = 0; i < sortedYears.length; i += batchSize) {
    const yearBatch = sortedYears.slice(i, i + batchSize);
    const yearIndexes = await Promise.all(
      yearBatch.map(year => fetchOfficialRecoveryTagIndexForYear(year).catch(() => new Map<string, RmisRecovery[]>()))
    );

    let lookupCount = 0;
    for (const index of yearIndexes) {
      for (const tag of tagCodeArray) {
        lookupCount++;
        if (lookupCount % 20000 === 0) await yieldToMainThread();
        const records = index.get(tag);
        if (!records) continue;
        for (const rec of records) {
          const key = officialRecoveryRecordKey(rec);
          if (seen.has(key)) continue;
          seen.add(key);
          output.push(rec);
        }
      }
    }
    await yieldToMainThread();
  }

  return output;
}

// ─── PSC basin → region label ─────────────────────────────────────────────────

const PSC_BASIN_LABELS: Record<string, string> = {
  BRIS: 'Bristol Bay', COOK: 'Cook Inlet', KODI: 'Kodiak',
  PWS: 'Prince William Sound', SEAK: 'Southeast Alaska',
  SEAKG: 'Southeast Alaska', CEAKG: 'Central Alaska',
  CHIG: 'Chignik', PENI: 'Alaska Peninsula',
  KUSK: 'Kuskokwim', YUKN: 'Yukon',
  KOTZ: 'Kotzebue / AYK', NORT: 'Northern Alaska',
};

function basinToRegion(basin: string | undefined): string {
  if (!basin) return 'Alaska';
  return PSC_BASIN_LABELS[basin] ?? basin;
}

// ─── ISO week helpers ─────────────────────────────────────────────────────────

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function weekToApproxMonth(isoWeek: number): string {
  const dayOfYear = (isoWeek - 1) * 7 + 4;
  const monthIdx = Math.min(11, Math.floor((dayOfYear - 1) / 30.44));
  return MONTH_ABBR[monthIdx];
}

function buildWeekLabel(isoWeek: number, calYear: number): string {
  return `Wk ${isoWeek} · ${weekToApproxMonth(isoWeek)} ${calYear}`;
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function movementWeekLabel(week: number): string {
  return `Wk ${week} · ${weekToApproxMonth(week)}`;
}

// ─── Stat-area coordinate fallback table ──────────────────────────────────────
// RMIS recovery location codes for Alaska stat areas often lack lat/lng in the
// API response. This table maps known ADF&G stat area codes to approximate
// center coordinates so recoveries are never silently dropped.
//
// Prince William Sound stat areas (ADF&G Districts 6–10):
//   District 6  = NW PWS (Coghill, Port Wells, Passage Canal, Whittier)
//   District 7  = NE PWS (Valdez Arm, Tatitlek, Bligh Island)
//   District 8  = Central PWS (Columbia Bay, Naked Island, Montague Strait)
//   District 9  = SW PWS (Chenega, Knight Island, Eshamy Bay)
//   District 10 = SE PWS / Copper River (Hinchinbrook, Cordova, Copper River Flats)
//
// Stat area numbers 222–232 correspond to PWS sub-areas.
// Sources: ADF&G Commercial Fisheries statistical area maps, RMIS location schema.

const STAT_AREA_COORDS: Record<string, [number, number]> = {
  // ── Prince William Sound ──────────────────────────────────────────────────
  // Generic / whole-sound fallback
  '222':    [60.742006, -147.365499], // Northern District representative water
  '22200':  [60.742006, -147.365499],
  // District 6 — NW PWS
  '22201':  [60.95, -148.50],  // Passage Canal / Whittier
  '22202':  [60.90, -148.20],  // Port Wells north
  '22203':  [60.80, -148.00],  // Port Wells south / Esther Island
  '22204':  [60.85, -147.80],  // Coghill Lake area
  '22205':  [60.75, -148.30],  // Bainbridge Passage
  '22206':  [60.70, -148.10],  // Eshamy Bay / Port Nellie Juan
  // District 7 — NE PWS (Valdez Arm)
  '22210':  [60.840000, -147.060000],  // North Glacier Island / Columbia Bay
  '22211':  [61.05, -146.60],  // Valdez Arm north
  '22212':  [60.90, -146.80],  // Valdez Arm south
  '22213':  [60.80, -146.60],  // Tatitlek Narrows
  '22214':  [60.75, -146.40],  // Bligh Island / Valdez Arm mouth
  '22215':  [60.70, -146.20],  // Tatitlek area
  // District 8 — Central PWS
  '22220':  [60.60, -147.20],  // Columbia Bay
  '22221':  [60.55, -147.00],  // Central PWS / Naked Island
  '22222':  [60.50, -147.00],  // Central PWS centroid
  '22223':  [60.45, -147.30],  // Montague Strait north
  '22224':  [60.40, -147.10],  // Montague Strait central
  '22225':  [60.35, -147.00],  // Montague Strait south
  '22226':  [60.50, -146.80],  // Hawkins Island area
  // District 9 — SW PWS (Knight Island, Chenega)
  '22230':  [60.30, -148.00],  // Knight Island Passage north
  '22231':  [60.20, -148.10],  // Knight Island Passage south
  '22232':  [60.10, -148.00],  // Chenega / Evans Island
  '22233':  [60.05, -147.80],  // Icy Bay / SW PWS
  '22234':  [60.15, -148.30],  // Elrington Passage
  '22235':  [60.25, -148.50],  // Dangerous Passage
  // District 10 — SE PWS / Copper River
  '22240':  [60.40, -146.00],  // Hinchinbrook Island west
  '22241':  [60.30, -146.20],  // Hinchinbrook Entrance
  '22242':  [60.20, -146.00],  // Cape Hinchinbrook
  '22243':  [60.50, -145.50],  // Copper River Flats west
  '22244':  [60.45, -145.20],  // Copper River Flats east
  '22245':  [60.55, -145.80],  // Eyak / Cordova area
  '22246':  [60.60, -145.60],  // Cordova harbor area
  '22247':  [60.35, -145.00],  // Softuk Bar / Copper River mouth
  '22248':  [60.25, -145.50],  // Gulf of Alaska approach SE
  // Broader PWS stat area prefixes (catch-all for sub-codes)
  '2220':   [60.80, -148.20],  // NW PWS
  '2221':   [60.70, -147.00],  // Central-N PWS
  '2222':   [60.50, -147.00],  // Central PWS
  '2223':   [60.30, -147.50],  // SW PWS
  '2224':   [60.40, -146.00],  // SE PWS
  '2225':   [60.55, -145.50],  // Copper River area
  // ── Cook Inlet ────────────────────────────────────────────────────────────
  '247':    [60.80, -151.50],
  '24700':  [60.80, -151.50],
  '24701':  [61.20, -150.00],  // Upper Cook Inlet
  '24702':  [60.50, -151.80],  // Lower Cook Inlet
  '24703':  [59.80, -152.50],  // Kamishak Bay
  '24704':  [60.00, -151.50],  // Kachemak Bay
  '24710':  [60.801258, -151.741690], // Trading Bay District
  '24720':  [61.015246, -151.311627], // Tyonek District
  '24730':  [61.196504, -150.899258], // Beluga District
  '24741':  [61.243677, -150.449988], // Susitna Flats / Upper Cook Inlet
  '24742':  [61.242709, -150.081332], // Point MacKenzie District
  '24743':  [61.159794, -150.241057], // Fire Island District
  '24750':  [61.395979, -149.683000], // Knik Arm
  '24760':  [61.008208, -149.900271], // Turnagain Arm
  '24770':  [61.002838, -150.543493], // Point Possession District
  '24780':  [60.897787, -150.826647], // Birch Hill District
  '24790':  [60.798747, -151.116478], // Number Three Bay District
  // ── Bristol Bay ───────────────────────────────────────────────────────────
  '350':    [58.578259, -158.780430], // Bristol Bay broad fallback, Nushagak water
  '35000':  [58.578259, -158.780430],
  '35001':  [58.624713, -157.290623], // Naknek-Kvichak District
  '35002':  [58.164042, -157.561875], // Egegik District
  '35003':  [57.482889, -157.915554], // Ugashik District
  '35004':  [58.895530, -160.367640], // Togiak Bay Section
  '32100':  [57.482889, -157.915554], // ADF&G Ugashik District
  '32200':  [58.164042, -157.561875], // ADF&G Egegik District
  '32400':  [58.624713, -157.290623], // ADF&G Naknek-Kvichak District
  '32500':  [58.578259, -158.780430], // ADF&G Nushagak District
  '32670':  [58.895530, -160.367640], // ADF&G Togiak Bay Section
  // ── Kodiak ────────────────────────────────────────────────────────────────
  '260':    [57.50, -153.00],
  '26000':  [57.50, -153.00],
  '26001':  [57.80, -152.50],  // Kodiak Island north
  '26002':  [57.20, -153.50],  // Shelikof Strait
  // ── Southeast Alaska ──────────────────────────────────────────────────────
  '101':    [57.00, -135.50],
  '10100':  [57.00, -135.50],
  '10101':  [57.10, -135.50],  // Sitka Sound
  '10102':  [57.50, -135.80],  // N Chatham Strait
  '10103':  [58.20, -136.50],  // Cross Sound
  '10104':  [58.80, -137.20],  // Yakutat Bay
  '10105':  [56.50, -134.00],  // Frederick Sound
  '10106':  [56.80, -134.30],  // Stephens Passage
  '10107':  [55.40, -131.80],  // Ketchikan / Dixon Entrance
  '10108':  [56.00, -132.40],  // Clarence Strait
};

// Water-safe coordinates for official recovery area rows that are valid
// reporting locations but do not carry their own lat/lng in the location file.
// These must win before broad child-location centroids, because the broad
// centroid can average hatcheries, stock sites, harbors, and freshwater points.
const SE_SITKA_SOUND_WATER: [number, number] = [57.017813, -135.492413];
const SE_JUNEAU_GASTINEAU_WATER: [number, number] = [58.252163, -134.329114];
const SE_PETERSBURG_WRANGELL_NARROWS_WATER: [number, number] = [56.814000, -132.960000];
const SE_KETCHIKAN_TONGASS_NARROWS_WATER: [number, number] = [55.341500, -131.648500];
const BC_LANGARA_ISLAND_OFFSHORE_WATER: [number, number] = [54.258000, -133.064500];

const NO_POINT_FISHERY_AREA_COORDS: Record<string, [number, number]> = {
  // British Columbia, Langara Island fishery-location rows. The official
  // records identify the island feature, so place movement recoveries just
  // offshore near Langara Point instead of on the landmass.
  '2MN25H001LANG^IS': BC_LANGARA_ISLAND_OFFSHORE_WATER,
  '2MN25H001LANG^IS^02': BC_LANGARA_ISLAND_OFFSHORE_WATER,
  '2MN25P001LANG^IS^02': BC_LANGARA_ISLAND_OFFSHORE_WATER,
  '2MN39H001LANG^IS': BC_LANGARA_ISLAND_OFFSHORE_WATER,
  '2MN39P001LANG^IS^02': BC_LANGARA_ISLAND_OFFSHORE_WATER,
  '2M^BMP001LANG^IS^02': BC_LANGARA_ISLAND_OFFSHORE_WATER,
  '2MN06H001^^^^^^^628': BC_LANGARA_ISLAND_OFFSHORE_WATER,
  '2MN09H001^^^^^^^628': BC_LANGARA_ISLAND_OFFSHORE_WATER,
  // Southeast Alaska broad city/gear sample rows. These RMPC rows identify
  // the city/management-area sample bucket, not a precise catch point, and
  // the official row can otherwise resolve to a town centroid on land.
  // Water points are inside the matching ADF&G Southeast statistical polygons.
  '1M1^^^^^^^^03': SE_SITKA_SOUND_WATER,
  '1M1^^^^^^^^03^^DE': SE_SITKA_SOUND_WATER,
  '1M1^^^^^^^^03^^DT': SE_SITKA_SOUND_WATER,
  '1M1^^^^^^^^03^^FF': SE_SITKA_SOUND_WATER,
  '1M1^^^^^^^^03^^MB': SE_SITKA_SOUND_WATER,
  '1M1^^^^^^^^03^^MS': SE_SITKA_SOUND_WATER,
  '1M1^^^^^^^^03^^TFA': SE_SITKA_SOUND_WATER,
  '1M1NW^^^^^^03^^MS': SE_SITKA_SOUND_WATER,
  '1M1-03': SE_SITKA_SOUND_WATER,
  '1M1-03-DE': SE_SITKA_SOUND_WATER,
  '1M1-03-DT': SE_SITKA_SOUND_WATER,
  '1M1-03-FF': SE_SITKA_SOUND_WATER,
  '1M1-03-MB': SE_SITKA_SOUND_WATER,
  '1M1-03-MS': SE_SITKA_SOUND_WATER,
  '1M1-03-TFA': SE_SITKA_SOUND_WATER,
  '1M1NW-03-MS': SE_SITKA_SOUND_WATER,
  'AKM1-03': SE_SITKA_SOUND_WATER,
  'AKM1-03-DE': SE_SITKA_SOUND_WATER,
  'AKM1-03DE': SE_SITKA_SOUND_WATER,
  'AKM1-03-DT': SE_SITKA_SOUND_WATER,
  'AKM1-03DT': SE_SITKA_SOUND_WATER,
  'AKM1-03-FF': SE_SITKA_SOUND_WATER,
  'AKM1-03FF': SE_SITKA_SOUND_WATER,
  'AKM1-03-MB': SE_SITKA_SOUND_WATER,
  'AKM1-03MB': SE_SITKA_SOUND_WATER,
  'AKM1-03-MS': SE_SITKA_SOUND_WATER,
  'AKM1-03MS': SE_SITKA_SOUND_WATER,
  'AKM1-03-TFA': SE_SITKA_SOUND_WATER,
  'AKM1-03TFA': SE_SITKA_SOUND_WATER,
  'AKM1NW-03-MS': SE_SITKA_SOUND_WATER,
  'AKM1NW-03MS': SE_SITKA_SOUND_WATER,
  '1M1NE^^^^^^04^^DE': SE_JUNEAU_GASTINEAU_WATER,
  '1M1^^^^^^^^04^^DE': SE_JUNEAU_GASTINEAU_WATER,
  '1M1NE-04-DE': SE_JUNEAU_GASTINEAU_WATER,
  '1M1-04-DE': SE_JUNEAU_GASTINEAU_WATER,
  'AKM1NE-04-DE': SE_JUNEAU_GASTINEAU_WATER,
  'AKM1NE-04DE': SE_JUNEAU_GASTINEAU_WATER,
  'AKM1-04-DE': SE_JUNEAU_GASTINEAU_WATER,
  'AKM1-04DE': SE_JUNEAU_GASTINEAU_WATER,
  '1M1^^^^^^^^05^^MS': SE_PETERSBURG_WRANGELL_NARROWS_WATER,
  '1M1SE^^^^^^05^^MS': SE_PETERSBURG_WRANGELL_NARROWS_WATER,
  '1M1-05-MS': SE_PETERSBURG_WRANGELL_NARROWS_WATER,
  '1M1SE-05-MS': SE_PETERSBURG_WRANGELL_NARROWS_WATER,
  'AKM1-05-MS': SE_PETERSBURG_WRANGELL_NARROWS_WATER,
  'AKM1-05MS': SE_PETERSBURG_WRANGELL_NARROWS_WATER,
  'AKM1SE-05-MS': SE_PETERSBURG_WRANGELL_NARROWS_WATER,
  'AKM1SE-05MS': SE_PETERSBURG_WRANGELL_NARROWS_WATER,
  '1M1^^^^^^^^06^^MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  '1M1SE^^^^^^06^^MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  '1M1SE101^^^06^^MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  '1M1-06-MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  '1M1SE-06-MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  '1M1SE101-06-MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  'AKM1-06-MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  'AKM1-06MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  'AKM1SE-06-MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  'AKM1SE-06MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  'AKM1SE101-06-MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  'AKM1SE101-06MS': SE_KETCHIKAN_TONGASS_NARROWS_WATER,
  // Prince William Sound, Eastern District / Valdez-side statistical areas.
  // Values are WGS84 representative water points from ADF&G public GIS layers.
  '1M2': [60.420000, -147.280000],
  '1M2PW': [60.420000, -147.280000],
  '1M2PW221': [60.786578, -146.568127],
  '1M2PW221^23': [60.982006, -146.725499],
  '1M2PW221^^^23': [60.982006, -146.725499],
  '1M2PW221^^^23^^MB': [60.982006, -146.725499],
  '1F2PW221^23': [60.982006, -146.725499],
  '1F2PW221^40': [60.771869, -146.672917],
  '1M2PW221^40': [60.771869, -146.672917],
  '1M2PW221^45': [60.843683, -146.666470],
  '1F2PW221^50': [60.931300, -146.806436],
  '1M2PW221^50': [60.931300, -146.806436],
  '1M2PW221^5023': [60.931300, -146.806436],
  '1M2PW221^5023^^MB': [60.931300, -146.806436],
  '1M2PW221^60': [61.099167, -146.591202],
  '1M2PW221^6023': [61.099167, -146.591202],
  '1M2PW221^6023^^MB': [61.099167, -146.591202],
  '1M2PW221^61': [61.125300, -146.349600],
  '1M2PW221^6123': [61.125300, -146.349600],
  '1M2PW221^6123^^MB': [61.125300, -146.349600],
  '1M2PW221^62': [61.103526, -146.468292],
  '1M2PW221^6223': [61.103526, -146.468292],
  '1F2PW222': [60.742006, -147.365499],
  '1M2PW222': [60.742006, -147.365499],
  '1F2PW222^10': [60.840000, -147.060000],
  '1M2PW222^10': [60.840000, -147.060000],
  '1M2PW223': [60.957485, -148.091119],
  '1F2PW223': [60.957485, -148.091119],
  '1M2PW223^20': [60.424653, -147.995733],
  '1S2PW223^20': [60.424653, -147.995733],
  '1F2PW225^20': [60.539444, -148.058333],
  '1M2PW225^20': [60.539444, -148.058333],
  '1S2PW225^20': [60.539444, -148.058333],
  '1F2PW225^30': [60.468889, -147.984167],
  '1M2PW225^30': [60.468889, -147.984167],
  '1S2PW225^30': [60.468889, -147.984167],
  '1F2PW226^10': [60.438006, -147.717499],
  '1M2PW226^10': [60.438006, -147.717499],
  '1F2PW226^40': [60.054006, -148.037499],
  '1M2PW226^40': [60.054006, -148.037499],
  '1S2PW226^40': [60.054006, -148.037499],
  '1M2LC': [59.450000, -152.100000],
  '1F2LC': [59.450000, -152.100000],
  'AKM2': [60.420000, -147.280000],
  'AKM2PW': [60.420000, -147.280000],
  '221': [60.786578, -146.568127],
  '221-23': [60.982006, -146.725499],
  '221-23-MB': [60.982006, -146.725499],
  '221-23MB': [60.982006, -146.725499],
  '221-40': [60.771869, -146.672917],
  '221-45': [60.843683, -146.666470],
  '221-50': [60.931300, -146.806436],
  '221-5023': [60.931300, -146.806436],
  '221-5023-MB': [60.931300, -146.806436],
  '221-5023MB': [60.931300, -146.806436],
  '221-60': [61.099167, -146.591202],
  '221-6023': [61.099167, -146.591202],
  '221-6023-MB': [61.099167, -146.591202],
  '221-6023MB': [61.099167, -146.591202],
  '221-61': [61.125300, -146.349600],
  '221-6123': [61.125300, -146.349600],
  '221-6123-MB': [61.125300, -146.349600],
  '221-6123MB': [61.125300, -146.349600],
  '221-62': [61.103526, -146.468292],
  '221-6223': [61.103526, -146.468292],
  '222': [60.742006, -147.365499],
  '222-10': [60.840000, -147.060000],
  '223': [60.957485, -148.091119],
  '225-20': [60.539444, -148.058333],
  '225-30': [60.468889, -147.984167],
  '226-10': [60.438006, -147.717499],
  '226-40': [60.054006, -148.037499],
  'AKM2PW221': [60.786578, -146.568127],
  'AKM2PW221-23': [60.982006, -146.725499],
  'AKF2PW221-23': [60.982006, -146.725499],
  'AKM2PW221-23-MB': [60.982006, -146.725499],
  'AKM2PW221-23MB': [60.982006, -146.725499],
  'AKF2PW221-23-MB': [60.982006, -146.725499],
  'AKF2PW221-23MB': [60.982006, -146.725499],
  'AKF2PW221-40': [60.771869, -146.672917],
  'AKM2PW221-40': [60.771869, -146.672917],
  'AKM2PW221-45': [60.843683, -146.666470],
  'AKF2PW221-50': [60.931300, -146.806436],
  'AKM2PW221-5023': [60.931300, -146.806436],
  'AKM2PW221-5023-MB': [60.931300, -146.806436],
  'AKM2PW221-5023MB': [60.931300, -146.806436],
  'AKM2PW221-6023': [61.099167, -146.591202],
  'AKM2PW221-6023-MB': [61.099167, -146.591202],
  'AKM2PW221-6023MB': [61.099167, -146.591202],
  'AKM2PW221-6123': [61.125300, -146.349600],
  'AKM2PW221-6123-MB': [61.125300, -146.349600],
  'AKM2PW221-6123MB': [61.125300, -146.349600],
  'AKM2PW221-62': [61.103526, -146.468292],
  'AKM2PW221-6223': [61.103526, -146.468292],
  'AKF2PW222': [60.742006, -147.365499],
  'AKM2PW222': [60.742006, -147.365499],
  'AKF2PW222-10': [60.840000, -147.060000],
  'AKM2PW222-10': [60.840000, -147.060000],
  'AKM2PW223': [60.957485, -148.091119],
  'AKF2PW223': [60.957485, -148.091119],
  'AKM2PW223-20': [60.424653, -147.995733],
  'AKS2PW223-20': [60.424653, -147.995733],
  'AKMPW223-20': [60.424653, -147.995733],
  'AKSPW223-20': [60.424653, -147.995733],
  'GRANITEBAY223-20': [60.424653, -147.995733],
  'AKF2PW225-20': [60.539444, -148.058333],
  'AKM2PW225-20': [60.539444, -148.058333],
  'AKS2PW225-20': [60.539444, -148.058333],
  'AKFPW225-20': [60.539444, -148.058333],
  'MAINBAY225-20': [60.539444, -148.058333],
  'AKF2PW225-30': [60.468889, -147.984167],
  'AKM2PW225-30': [60.468889, -147.984167],
  'AKS2PW225-30': [60.468889, -147.984167],
  'AKFPW225-30': [60.468889, -147.984167],
  'ESHAMYBAY225-30': [60.468889, -147.984167],
  'AKF2PW226-10': [60.438006, -147.717499],
  'AKM2PW226-10': [60.438006, -147.717499],
  'AKF2PW226-40': [60.054006, -148.037499],
  'AKM2PW226-40': [60.054006, -148.037499],
  'AKS2PW226-40': [60.054006, -148.037499],
  'PORTSANJUAN226-40': [60.054006, -148.037499],
  'SAWMILLBAY226-40': [60.054006, -148.037499],
  'AFKOERNIGH': [60.054006, -148.037499],
  'SOLFLK226-10': [60.438006, -147.717499],
  'SOLFLK226-10(B)': [60.438006, -147.717499],
  'AKM2LC': [59.450000, -152.100000],
  'AKF2LC': [59.450000, -152.100000],
  // Cook Inlet, Susitna Flats statistical area. Representative water point
  // selected from the ADF&G Upper Cook Inlet statistical-area polygon.
  '1F2UC247^41': [61.243677, -150.449988],
  '1M2UC247^41': [61.243677, -150.449988],
  '1S2UC247^41': [61.243677, -150.449988],
  '1F2UC247^4195': [61.243677, -150.449988],
  '1M2UC247^4195': [61.243677, -150.449988],
  '1S2UC247^4195': [61.243677, -150.449988],
  '1F2UC247^4195^^FF': [61.243677, -150.449988],
  '1M2UC247^4195^^FF': [61.243677, -150.449988],
  '1S2UC247^4195^^FF': [61.243677, -150.449988],
  '247-41': [61.243677, -150.449988],
  '247-4195': [61.243677, -150.449988],
  '247-4195-FF': [61.243677, -150.449988],
  '2474195': [61.243677, -150.449988],
  '2474195-FF': [61.243677, -150.449988],
  'AKF2UC247-41': [61.243677, -150.449988],
  'AKM2UC247-41': [61.243677, -150.449988],
  'AKS2UC247-41': [61.243677, -150.449988],
  'AKF2UC247-4195': [61.243677, -150.449988],
  'AKM2UC247-4195': [61.243677, -150.449988],
  'AKS2UC247-4195': [61.243677, -150.449988],
  'AKF2UC247-4195-FF': [61.243677, -150.449988],
  'AKM2UC247-4195-FF': [61.243677, -150.449988],
  'AKS2UC247-4195-FF': [61.243677, -150.449988],
  'AKF2UC247-4195FF': [61.243677, -150.449988],
  'AKM2UC247-4195FF': [61.243677, -150.449988],
  'AKS2UC247-4195FF': [61.243677, -150.449988],
  'AKF2UC2474195': [61.243677, -150.449988],
  'AKM2UC2474195': [61.243677, -150.449988],
  'AKS2UC2474195': [61.243677, -150.449988],
  'AKF2UC2474195-FF': [61.243677, -150.449988],
  'AKM2UC2474195-FF': [61.243677, -150.449988],
  'AKS2UC2474195-FF': [61.243677, -150.449988],
  'AKF2UC2474195FF': [61.243677, -150.449988],
  'AKM2UC2474195FF': [61.243677, -150.449988],
  'AKS2UC2474195FF': [61.243677, -150.449988],
  // Cook Inlet, Knik Arm and Turnagain Arm statistical-area rows.
  // Official point rows for these area-coded recoveries can resolve to shore;
  // these representative water points keep movement nodes inside the district.
  '1F2UC247^50': [61.395979, -149.683000],
  '1M2UC247^50': [61.395979, -149.683000],
  '1S2UC247^50': [61.395979, -149.683000],
  '1F2UC247^5028': [61.395979, -149.683000],
  '1M2UC247^5028': [61.395979, -149.683000],
  '1S2UC247^5028': [61.395979, -149.683000],
  '1F2UC247^5028^^FF': [61.395979, -149.683000],
  '1M2UC247^5028^^FF': [61.395979, -149.683000],
  '1S2UC247^5028^^FF': [61.395979, -149.683000],
  '1F2UC247^50DC': [61.395979, -149.683000],
  '1M2UC247^50DC': [61.395979, -149.683000],
  '1S2UC247^50DC': [61.395979, -149.683000],
  '1F2UC247^50DC^^FF': [61.395979, -149.683000],
  '1M2UC247^50DC^^FF': [61.395979, -149.683000],
  '1S2UC247^50DC^^FF': [61.395979, -149.683000],
  '247-50': [61.395979, -149.683000],
  '247-5028': [61.395979, -149.683000],
  '247-5028-FF': [61.395979, -149.683000],
  '247-50DC': [61.395979, -149.683000],
  '247-50DC-FF': [61.395979, -149.683000],
  '2475028': [61.395979, -149.683000],
  '2475028-FF': [61.395979, -149.683000],
  '24750DC': [61.395979, -149.683000],
  '24750DC-FF': [61.395979, -149.683000],
  'AKFUC247-5028': [61.395979, -149.683000],
  'AKFUC247-5028-FF': [61.395979, -149.683000],
  'AKFUC247-50DC': [61.395979, -149.683000],
  'AKFUC247-50DC-FF': [61.395979, -149.683000],
  'AKF2UC247-50': [61.395979, -149.683000],
  'AKM2UC247-50': [61.395979, -149.683000],
  'AKS2UC247-50': [61.395979, -149.683000],
  'AKF2UC247-5028': [61.395979, -149.683000],
  'AKM2UC247-5028': [61.395979, -149.683000],
  'AKS2UC247-5028': [61.395979, -149.683000],
  'AKF2UC247-5028-FF': [61.395979, -149.683000],
  'AKM2UC247-5028-FF': [61.395979, -149.683000],
  'AKS2UC247-5028-FF': [61.395979, -149.683000],
  'AKF2UC247-5028FF': [61.395979, -149.683000],
  'AKM2UC247-5028FF': [61.395979, -149.683000],
  'AKS2UC247-5028FF': [61.395979, -149.683000],
  'AKF2UC247-50DC': [61.395979, -149.683000],
  'AKM2UC247-50DC': [61.395979, -149.683000],
  'AKS2UC247-50DC': [61.395979, -149.683000],
  'AKF2UC247-50DC-FF': [61.395979, -149.683000],
  'AKM2UC247-50DC-FF': [61.395979, -149.683000],
  'AKS2UC247-50DC-FF': [61.395979, -149.683000],
  'AKF2UC247-50DCFF': [61.395979, -149.683000],
  'AKM2UC247-50DCFF': [61.395979, -149.683000],
  'AKS2UC247-50DCFF': [61.395979, -149.683000],
  '1F2UC247^60': [61.008208, -149.900271],
  '1M2UC247^60': [61.008208, -149.900271],
  '1S2UC247^60': [61.008208, -149.900271],
  '1F2UC247^6028': [61.008208, -149.900271],
  '1M2UC247^6028': [61.008208, -149.900271],
  '1S2UC247^6028': [61.008208, -149.900271],
  '1F2UC247^6028^^FF': [61.008208, -149.900271],
  '1M2UC247^6028^^FF': [61.008208, -149.900271],
  '1S2UC247^6028^^FF': [61.008208, -149.900271],
  '247-60': [61.008208, -149.900271],
  '247-6028': [61.008208, -149.900271],
  '247-6028-FF': [61.008208, -149.900271],
  '2476028': [61.008208, -149.900271],
  '2476028-FF': [61.008208, -149.900271],
  'AKFUC247-6028': [61.008208, -149.900271],
  'AKFUC247-6028-FF': [61.008208, -149.900271],
  'AKF2UC247-60': [61.008208, -149.900271],
  'AKM2UC247-60': [61.008208, -149.900271],
  'AKS2UC247-60': [61.008208, -149.900271],
  'AKF2UC247-6028': [61.008208, -149.900271],
  'AKM2UC247-6028': [61.008208, -149.900271],
  'AKS2UC247-6028': [61.008208, -149.900271],
  'AKF2UC247-6028-FF': [61.008208, -149.900271],
  'AKM2UC247-6028-FF': [61.008208, -149.900271],
  'AKS2UC247-6028-FF': [61.008208, -149.900271],
  'AKF2UC247-6028FF': [61.008208, -149.900271],
  'AKM2UC247-6028FF': [61.008208, -149.900271],
  'AKS2UC247-6028FF': [61.008208, -149.900271],
  // Southeast Alaska, Sitka District 113 statistical-area fallbacks.
  // 113-31 is Outside Crawfish Inlet; 113 is a broad District 113 water fallback.
  '1M1NW113': [56.977416, -135.559344],
  '1M1NW113^31': [56.752565, -135.404988],
  '1M1NW113-31': [56.752565, -135.404988],
  'AKM1NW113': [56.977416, -135.559344],
  'AKM1NW113-31': [56.752565, -135.404988],
  'AKM1NW11331': [56.752565, -135.404988],
  '113': [56.977416, -135.559344],
  '113-31': [56.752565, -135.404988],
  '11331': [56.752565, -135.404988],
};

/** Centroid of geographic points (for RMIS PSC v5 coarse codes). */
function centroidOf(points: [number, number][]): [number, number] {
  const s = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0] as [number, number]);
  return [s[0] / points.length, s[1] / points.length];
}

/**
 * Last-resort centroids for PSC marine / basin keys that still have no finer
 * locations in the map (uncommon — most codes resolve via prefix scan).
 */
const PSC_COARSE_ZONE_COORDS: Record<string, [number, number]> = {
  '1M2PW': [60.42, -147.28],
  '1M2LC': [59.45, -152.10],
  '1F2LC': [59.45, -152.10],
  '1M2UC247': [60.85, -151.4],
  '1F2UC247': [60.85, -151.4],
  '1S2UC247': [60.85, -151.4],
  '1M2BB350': [58.5, -158.0],
  '1M2KO260': [57.5, -153.0],
  '1M1SE101': [57.0, -135.5],
};

const _coordResolveCache = new Map<string, [number, number] | null>();
const _locationCodeFetchCache = new Set<string>();

function validOfficialCoordPair(loc: RmisLocation | undefined): [number, number] | null {
  if (!loc || loc.latitude == null || loc.longitude == null) return null;

  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  if (lat >= 30 && lat <= 75 && lng >= -180 && lng <= -110) {
    return [lat, lng];
  }

  return null;
}

function preferLocationRecord(locationMap: Map<string, RmisLocation>, loc: RmisLocation) {
  const code = String(loc.location_code ?? '').trim();
  if (!code) return;

  const existingCoords = validOfficialCoordPair(locationMap.get(code));
  const incomingCoords = validOfficialCoordPair(loc);
  if (!locationMap.has(code) || (!existingCoords && incomingCoords)) {
    locationMap.set(code, loc);
  }
}

function locationQueryVariants(code: string): string[] {
  const trimmed = code.trim();
  const compact = trimmed.replace(/\s+/g, '');
  const caretFromDash = compact.replace(/^([1-8][MFS][A-Z0-9][A-Z0-9]{2}[A-Z0-9]{3,4})-([A-Z0-9]+)$/i, '$1^$2');
  return Array.from(new Set([trimmed, compact, caretFromDash].filter(Boolean)));
}

function normalizeAreaLookupKey(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

function noPointFisheryAreaAliases(code: string): string[] {
  const aliases = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const normalized = normalizeAreaLookupKey(value);
    if (normalized) aliases.add(normalized);
  };

  for (const variant of locationQueryVariants(code)) {
    add(variant);
    add(variant.replace(/\^+/g, '-').replace(/-+/g, '-'));

    const pwsMatch = normalizeAreaLookupKey(variant).match(/^1([MFS])2PW(\d{3})\^(.+)$/);
    if (pwsMatch) {
      const waterType = pwsMatch[1];
      const district = pwsMatch[2];
      const suffix = pwsMatch[3].replace(/\^+/g, '-').replace(/^-|-$/g, '');
      add(`1${waterType}2PW${district}`);
      add(`1M2PW${district}`);
      add(district);
      add(`${district}-${suffix}`);
      add(`AK${waterType}2PW${district}`);
      add(`AKM2PW${district}`);
      add(`AK${waterType}2PW${district}-${suffix}`);
      add(`AKM2PW${district}-${suffix}`);

      const subdistrict = suffix.match(/^(\d{2})/);
      if (subdistrict) {
        add(`1${waterType}2PW${district}^${subdistrict[1]}`);
        add(`1M2PW${district}^${subdistrict[1]}`);
        add(`${district}-${subdistrict[1]}`);
        add(`AK${waterType}2PW${district}-${subdistrict[1]}`);
        add(`AKM2PW${district}-${subdistrict[1]}`);
      }
    }

    const pscAreaMatch = normalizeAreaLookupKey(variant).match(/^1([MFS])([1-8])([A-Z]{2})(\d{3})\^(.+)$/);
    if (pscAreaMatch) {
      const waterType = pscAreaMatch[1];
      const region = pscAreaMatch[2];
      const quadrant = pscAreaMatch[3];
      const district = pscAreaMatch[4];
      const suffix = pscAreaMatch[5].replace(/\^+/g, '-').replace(/^-|-$/g, '');
      add(`1${waterType}${region}${quadrant}${district}`);
      add(`1M${region}${quadrant}${district}`);
      add(district);
      add(`${district}-${suffix}`);
      add(`${district}${suffix}`);
      add(`AK${waterType}${region}${quadrant}${district}`);
      add(`AKM${region}${quadrant}${district}`);
      add(`AK${waterType}${region}${quadrant}${district}-${suffix}`);
      add(`AKM${region}${quadrant}${district}-${suffix}`);
      add(`AK${waterType}${region}${quadrant}${district}${suffix}`);
      add(`AKM${region}${quadrant}${district}${suffix}`);

      const subdistrict = suffix.match(/^(\d{2})/);
      if (subdistrict) {
        add(`1${waterType}${region}${quadrant}${district}^${subdistrict[1]}`);
        add(`1M${region}${quadrant}${district}^${subdistrict[1]}`);
        add(`${district}-${subdistrict[1]}`);
        add(`${district}${subdistrict[1]}`);
        add(`AK${waterType}${region}${quadrant}${district}-${subdistrict[1]}`);
        add(`AKM${region}${quadrant}${district}-${subdistrict[1]}`);
        add(`AK${waterType}${region}${quadrant}${district}${subdistrict[1]}`);
        add(`AKM${region}${quadrant}${district}${subdistrict[1]}`);
      }
    }

    const pscDistrictMatch = normalizeAreaLookupKey(variant).match(/^1([MFS])([1-8])([A-Z]{2})(\d{3})$/);
    if (pscDistrictMatch) {
      const waterType = pscDistrictMatch[1];
      const region = pscDistrictMatch[2];
      const quadrant = pscDistrictMatch[3];
      const district = pscDistrictMatch[4];
      add(district);
      add(`1${waterType}${region}${quadrant}${district}`);
      add(`1M${region}${quadrant}${district}`);
      add(`AK${waterType}${region}${quadrant}${district}`);
      add(`AKM${region}${quadrant}${district}`);
    }

    const akAreaMatch = normalizeAreaLookupKey(variant).match(/^AK([MFS])([1-8])?([A-Z]{2})(\d{3})[-^](.+)$/);
    if (akAreaMatch) {
      const waterType = akAreaMatch[1];
      const region = akAreaMatch[2] ?? '';
      const quadrant = akAreaMatch[3];
      const district = akAreaMatch[4];
      const suffix = akAreaMatch[5].replace(/\^+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      add(district);
      add(`${district}-${suffix}`);
      add(`${district}${suffix}`);
      add(`AK${waterType}${region}${quadrant}${district}`);
      add(`AK${waterType}${region}${quadrant}${district}-${suffix}`);
      add(`AK${waterType}${region}${quadrant}${district}${suffix}`);

      if (!region) {
        add(`AK${waterType}2${quadrant}${district}`);
        add(`AK${waterType}2${quadrant}${district}-${suffix}`);
        add(`AK${waterType}2${quadrant}${district}${suffix}`);
      }

      const subdistrict = suffix.match(/^(\d{2})/);
      if (subdistrict) {
        add(`${district}-${subdistrict[1]}`);
        add(`${district}${subdistrict[1]}`);
        add(`AK${waterType}${region}${quadrant}${district}-${subdistrict[1]}`);
        add(`AK${waterType}${region}${quadrant}${district}${subdistrict[1]}`);
        if (!region) {
          add(`AK${waterType}2${quadrant}${district}-${subdistrict[1]}`);
          add(`AK${waterType}2${quadrant}${district}${subdistrict[1]}`);
        }
      }
    }

    const akDistrictMatch = normalizeAreaLookupKey(variant).match(/^AK([MFS])([1-8])?([A-Z]{2})(\d{3})$/);
    if (akDistrictMatch) {
      const waterType = akDistrictMatch[1];
      const region = akDistrictMatch[2] ?? '';
      const quadrant = akDistrictMatch[3];
      const district = akDistrictMatch[4];
      add(district);
      add(`AK${waterType}${region}${quadrant}${district}`);
      add(`AKM${region}${quadrant}${district}`);
      if (!region) {
        add(`AK${waterType}2${quadrant}${district}`);
        add(`AKM2${quadrant}${district}`);
      }
    }
  }

  return Array.from(aliases);
}

function statAreaCoordsByKey(key: string): [number, number] | null {
  return OFFICIAL_STAT_AREA_WATER_COORDS[key] ?? STAT_AREA_COORDS[key] ?? null;
}

function statAreaCoordsFromAlias(alias: string): [number, number] | null {
  const normalized = normalizeAreaLookupKey(alias);
  const exactStat = normalized.match(/^(\d{5})/);
  if (exactStat) {
    const coords = statAreaCoordsByKey(exactStat[1]);
    if (coords) return coords;
  }

  const dashedStat = normalized.match(/^(\d{3})-(\d{2})/);
  if (dashedStat) {
    const key = `${dashedStat[1]}${dashedStat[2]}`;
    const coords = statAreaCoordsByKey(key);
    if (coords) return coords;
  }

  const districtStat = normalized.match(/^(\d{3})$/);
  if (districtStat) {
    const coords = statAreaCoordsByKey(districtStat[1]);
    if (coords) return coords;
  }

  return null;
}

function preciseStatAreaCoordsFromAliases(aliases: string[]): [number, number] | null {
  for (const alias of aliases) {
    const normalized = normalizeAreaLookupKey(alias);
    const exactStat = normalized.match(/^(\d{5})/);
    if (exactStat) {
      const coords = statAreaCoordsByKey(exactStat[1]);
      if (coords) return coords;
    }

    const dashedStat = normalized.match(/^(\d{3})-(\d{2})/);
    if (dashedStat) {
      const coords = statAreaCoordsByKey(`${dashedStat[1]}${dashedStat[2]}`);
      if (coords) return coords;
    }
  }

  return null;
}

function noPointFisheryAreaCoords(locationCode: string): [number, number] | null {
  const aliases = noPointFisheryAreaAliases(locationCode);
  const preciseStatCoords = preciseStatAreaCoordsFromAliases(aliases);
  if (preciseStatCoords) return preciseStatCoords;

  for (const alias of aliases) {
    const coords = NO_POINT_FISHERY_AREA_COORDS[alias] ?? statAreaCoordsFromAlias(alias);
    if (coords) return coords;
  }

  return null;
}

function isLikelyNoPointFisheryAreaCode(locationCode: string): boolean {
  for (const alias of noPointFisheryAreaAliases(locationCode)) {
    const suffixMatch = alias.match(/^\d{3}-(.+)$/);
    if (!suffixMatch) continue;
    const compactSuffix = suffixMatch[1].replace(/-/g, '');
    if (/[A-Z]/.test(compactSuffix)) return true;
    if (/^\d{1,4}$/.test(compactSuffix)) return true;
  }

  return false;
}

function isPscDistrictAreaCode(locationCode: string): boolean {
  const normalized = normalizeAreaLookupKey(locationCode);
  return /^1[MFS][1-8][A-Z]{2}\d{3}$/.test(normalized) ||
    /^AK[MFS][1-8]?[A-Z]{2}\d{3}$/.test(normalized);
}

function isBroadPscRegionOnlyCode(locationCode: string): boolean {
  const normalized = normalizeAreaLookupKey(locationCode);
  return /^1[MFS][1-8]([A-Z]{2})?$/.test(normalized) ||
    /^AK[MFS][1-8]?([A-Z]{2})?$/.test(normalized);
}

function exactNoPointFisheryAreaCoords(locationCode: string): [number, number] | null {
  for (const variant of locationQueryVariants(locationCode)) {
    const exactKey = normalizeAreaLookupKey(variant);
    const dashKey = normalizeAreaLookupKey(variant.replace(/\^+/g, '-').replace(/-+/g, '-'));
    const coords = NO_POINT_FISHERY_AREA_COORDS[exactKey] ?? NO_POINT_FISHERY_AREA_COORDS[dashKey];
    if (coords) return coords;
  }

  return null;
}

async function enrichLocationMapForRecoveryCodes(
  recoveries: RmisRecovery[],
  locationMap: Map<string, RmisLocation>
) {
  const codes = Array.from(new Set(
    recoveries
      .map(rec => String(rec.recovery_location_code ?? '').trim())
      .filter(Boolean)
  ));
  const missingPreciseCodes = codes.filter(code => (
    !_locationCodeFetchCache.has(code) && !validOfficialCoordPair(locationMap.get(code))
  ));
  if (missingPreciseCodes.length === 0) return;

  const BATCH_SIZE = 12;
  for (let i = 0; i < missingPreciseCodes.length; i += BATCH_SIZE) {
    const batch = missingPreciseCodes.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async code => {
      _locationCodeFetchCache.add(code);
      for (const variant of locationQueryVariants(code)) {
        try {
          const res = await fetchLocations({ location_code: variant, perpage: '25', page: '1' });
          for (const loc of res.records ?? []) preferLocationRecord(locationMap, loc);
          if (validOfficialCoordPair(locationMap.get(code)) || validOfficialCoordPair(locationMap.get(variant))) break;
        } catch {
          // Keep rendering resilient; unresolved codes fall through to coarser fallbacks.
        }
      }
    }));
  }

  _coordResolveCache.clear();
}

/**
 * Resolve recovery location → coords. Handles PSC v5 coarse codes (e.g. `1M2PW`,
 * `1M2PW221`) by averaging all finer RMIS locations in the map that share the prefix.
 */
function resolveCoords(
  locationCode: string,
  locationMap: Map<string, RmisLocation>
): [number, number] | null {
  const trimmed = locationCode.trim();
  if (_coordResolveCache.has(trimmed)) {
    return _coordResolveCache.get(trimmed)!;
  }

  const out = resolveCoordsUncached(trimmed, locationMap);
  _coordResolveCache.set(trimmed, out);
  return out;
}

function resolveCoordsUncached(
  locationCode: string,
  locationMap: Map<string, RmisLocation>
): [number, number] | null {
  // 1) Known water-safe fixes for official area rows that land on shore.
  const exactWaterSafeCoords = exactNoPointFisheryAreaCoords(locationCode);
  if (exactWaterSafeCoords) return exactWaterSafeCoords;

  const likelyAreaCoords = (isLikelyNoPointFisheryAreaCode(locationCode) || isPscDistrictAreaCode(locationCode))
    ? noPointFisheryAreaCoords(locationCode)
    : null;
  if (likelyAreaCoords) return likelyAreaCoords;

  if (isBroadPscRegionOnlyCode(locationCode)) {
    return null;
  }

  // 2) Exact match in location map
  const exactCoords = validOfficialCoordPair(locationMap.get(locationCode));
  if (exactCoords) return exactCoords;
  for (const variant of locationQueryVariants(locationCode)) {
    if (variant === locationCode) continue;
    const variantCoords = validOfficialCoordPair(locationMap.get(variant));
    if (variantCoords) return variantCoords;
  }

  const noPointAreaCoords = noPointFisheryAreaCoords(locationCode);
  if (noPointAreaCoords) return noPointAreaCoords;

  const bases = Array.from(new Set(locationQueryVariants(locationCode).map(variant => variant.split('^')[0].trim())));

  // 3) Prefer official child locations before static stat-area centroids.

  // 4) PSC v5: centroid of all mapped sites under this prefix (e.g. `1M2PW221` → `1M2PW221^60`, …)
  for (const base of bases) {
    const sub: [number, number][] = [];
    for (const [code, rl] of locationMap) {
      if (!code.startsWith(base)) continue;
      const coords = validOfficialCoordPair(rl);
      if (coords) sub.push(coords);
    }
    if (sub.length > 0) {
      return centroidOf(sub);
    }
  }

  // 5) Legacy stat-area table (numeric ADF&G codes), only after official location data.
  for (const base of bases) {
    if (STAT_AREA_COORDS[base]) return STAT_AREA_COORDS[base];
    for (let len = base.length - 1; len >= 3; len--) {
      const prefix = base.slice(0, len);
      if (STAT_AREA_COORDS[prefix]) return STAT_AREA_COORDS[prefix];
    }
  }

  // 6) Explicit coarse-zone fallbacks
  for (const base of bases) {
    const coarse = PSC_COARSE_ZONE_COORDS[base] ?? PSC_COARSE_ZONE_COORDS[locationCode];
    if (coarse) return coarse;
  }

  return null;
}

// ─── Static seed: known Alaska hatcheries ────────────────────────────────────
// These are real ADF&G / PWSAC hatcheries with verified coordinates.
// They seed the hatchery dropdown so all facilities always appear even if the
// RMIS API doesn't return them (e.g. missing location_type=3 records, no coords).
// RMIS API data takes precedence for locationCode when available.
//
// locationCode here is a placeholder used only to derive the stat-area prefix
// for the RMIS name/release search. The real RMIS type-3 location_code is
// resolved at runtime via findLocationCodesByName (location_type=3).
// Sources: ADF&G hatchery records, PWSAC facility pages, RMIS location schema.

interface StaticHatcherySeed {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  region: string;
  locationCode: string; // best-known RMIS hatchery location code
}

const KNOWN_ALASKA_HATCHERIES: StaticHatcherySeed[] = [
  // ── Prince William Sound ──────────────────────────────────────────────────
  {
    name: 'ARMIN F KOERNIG H',
    displayName: 'Armin F. Koernig Hatchery',
    lat: 60.0700, lng: -148.0700,
    region: 'Prince William Sound',
    locationCode: '22232-AFK',
  },
  {
    name: 'WALLY NOERENBERG H',
    displayName: 'Wally Noerenberg (Esther) Hatchery',
    lat: 60.8450, lng: -148.0336,
    region: 'Prince William Sound',
    locationCode: '1F2PW223^40',
  },
  {
    name: 'ESTHER ISLAND H',
    displayName: 'Wally Noerenberg (Esther) Hatchery',
    lat: 60.9167, lng: -148.0500,
    region: 'Prince William Sound',
    locationCode: '22203-EIH',
  },
  {
    name: 'CANNERY CREEK H',
    displayName: 'Cannery Creek Hatchery',
    lat: 61.0000, lng: -147.6200,
    region: 'Prince William Sound',
    locationCode: '22220-CCH',
  },
  {
    name: 'MAIN BAY H',
    displayName: 'Main Bay Hatchery',
    lat: 60.5186, lng: -148.0928,
    region: 'Prince William Sound',
    locationCode: '22205-MBH',
  },
  {
    name: 'SOLOMON GULCH H',
    displayName: 'Solomon Gulch (Valdez Fisheries) Hatchery',
    lat: 61.1308, lng: -146.3483,
    region: 'Prince William Sound',
    locationCode: '22210-SGH',
  },
  {
    name: 'VALDEZ FISHERIES DEVELOPMENT H',
    displayName: 'Solomon Gulch (Valdez Fisheries) Hatchery',
    lat: 61.1150, lng: -146.3700,
    region: 'Prince William Sound',
    locationCode: '22210-VFD',
  },
  {
    name: 'PORT CHALMERS H',
    displayName: 'Port Chalmers Hatchery',
    lat: 60.8500, lng: -148.1000,
    region: 'Prince William Sound',
    locationCode: '22203-PCH',
  },
  {
    name: 'CHENEGA H',
    displayName: 'Chenega Hatchery',
    lat: 60.0667, lng: -148.0167,
    region: 'Prince William Sound',
    locationCode: '22232-CHG',
  },
  {
    name: 'ESTHER ISLAND H',
    displayName: 'Wally Noerenberg (Esther) Hatchery',
    lat: 60.8833, lng: -148.0500,
    region: 'Prince William Sound',
    locationCode: '22203-ESH',
  },
  // ── Cook Inlet ────────────────────────────────────────────────────────────
  {
    name: 'TUTKA BAY LAGOON H',
    displayName: 'Tutka Bay Lagoon Hatchery',
    lat: 59.5500, lng: -151.4500,
    region: 'Cook Inlet',
    locationCode: '24704-TBL',
  },
  // ── Bristol Bay ───────────────────────────────────────────────────────────
  {
    name: 'UGASHIK H',
    displayName: 'Ugashik Hatchery',
    lat: 57.5253, lng: -157.4022,
    region: 'Bristol Bay',
    locationCode: '35003-UGH',
  },
  {
    name: 'EGEGIK H',
    displayName: 'Egegik Hatchery',
    lat: 58.2167, lng: -157.3833,
    region: 'Bristol Bay',
    locationCode: '35002-EGH',
  },
  {
    name: 'NAKNEK-KVICHAK H',
    displayName: 'Naknek-Kvichak Hatchery',
    lat: 58.7300, lng: -156.9900,
    region: 'Bristol Bay',
    locationCode: '35001-NKH',
  },
  {
    name: 'TOGIAK H',
    displayName: 'Togiak Hatchery',
    lat: 59.0600, lng: -160.3800,
    region: 'Bristol Bay',
    locationCode: '35004-TOG',
  },
  {
    name: 'NUSHAGAK H',
    displayName: 'Nushagak Hatchery',
    lat: 58.9700, lng: -158.5300,
    region: 'Bristol Bay',
    locationCode: '35001-NUS',
  },
  // ── Southeast Alaska ──────────────────────────────────────────────────────
  {
    name: 'DOUGLAS ISLAND PINK AND CHUM H',
    displayName: 'Douglas Island Pink & Chum',
    lat: 58.3019, lng: -134.4197,
    region: 'Southeast Alaska',
    locationCode: '10106-DIP',
  },
  {
    name: 'MACAULAY SALMON H',
    displayName: 'Macaulay Salmon Hatchery',
    lat: 58.4540, lng: -134.1740,
    region: 'Southeast Alaska',
    locationCode: '10106-MAC',
  },
  {
    name: 'SITKA SOUND SCIENCE CENTER H',
    displayName: 'Sitka Sound Science Center',
    lat: 57.0531, lng: -135.3300,
    region: 'Southeast Alaska',
    locationCode: '10101-SSC',
  },
  {
    name: 'NEETS BAY H',
    displayName: 'Neets Bay Hatchery',
    lat: 56.4708, lng: -132.3750,
    region: 'Southeast Alaska',
    locationCode: '10107-NBH',
  },
  {
    name: 'HIDDEN FALLS H',
    displayName: 'Hidden Falls Hatchery',
    lat: 57.7900, lng: -135.3100,
    region: 'Southeast Alaska',
    locationCode: '10102-HFH',
  },
  {
    name: 'KENDRICK BAY H',
    displayName: 'Kendrick Bay Hatchery',
    lat: 55.3422, lng: -131.6461,
    region: 'Southeast Alaska',
    locationCode: '10108-KBH',
  },
  {
    name: 'BURNETT INLET H',
    displayName: 'Burnett Inlet Hatchery',
    lat: 57.4500, lng: -133.5300,
    region: 'Southeast Alaska',
    locationCode: '10105-BIH',
  },
  // ── Southeast Alaska (additional) ────────────────────────────────────────
  {
    name: 'BEAVER FALLS H',
    displayName: 'Beaver Falls Hatchery',
    lat: 55.3600, lng: -131.5800,
    region: 'Southeast Alaska',
    locationCode: '10108-BFH',
  },
  {
    name: 'DEER MOUNTAIN H',
    displayName: 'Deer Mountain Hatchery',
    lat: 55.3500, lng: -131.6700,
    region: 'Southeast Alaska',
    locationCode: '10108-DMH',
  },
  {
    name: 'FISH CREEK H',
    displayName: 'Fish Creek Hatchery',
    lat: 55.9500, lng: -133.0000,
    region: 'Southeast Alaska',
    locationCode: '10107-FCH',
  },
  {
    name: 'GUNNUK CREEK H',
    displayName: 'Gunnuk Creek Hatchery',
    lat: 56.8000, lng: -133.9000,
    region: 'Southeast Alaska',
    locationCode: '10105-GCH',
  },
  {
    name: 'KOWEE CREEK H',
    displayName: 'Kowee Creek Hatchery',
    lat: 58.2980, lng: -134.4100,
    region: 'Southeast Alaska',
    locationCode: '10106-KCH',
  },
  {
    name: 'LITTLE PORT WALTER H',
    displayName: 'Little Port Walter Hatchery',
    lat: 56.3833, lng: -134.6500,
    region: 'Southeast Alaska',
    locationCode: '10105-LPW',
  },
  {
    name: 'PORT SAINT NICHOLAS H',
    displayName: 'Port Saint Nicholas Hatchery',
    lat: 57.9800, lng: -136.5000,
    region: 'Southeast Alaska',
    locationCode: '10102-PSN',
  },
  // ── Cook Inlet / Southcentral ─────────────────────────────────────────────
  {
    name: 'CLEAR H',
    displayName: 'Clear Hatchery',
    lat: 64.3000, lng: -149.7000,
    region: 'Cook Inlet',
    locationCode: '24701-CLR',
  },
  {
    name: 'EKLUTNA H',
    displayName: 'Eklutna Hatchery',
    lat: 61.4500, lng: -149.3600,
    region: 'Cook Inlet',
    locationCode: '24701-EKL',
  },
  {
    name: 'ELMENDORF H',
    displayName: 'Elmendorf Hatchery',
    lat: 61.2500, lng: -149.8000,
    region: 'Cook Inlet',
    locationCode: '1F2UC247^5010060',
  },
  {
    name: 'FORT RICHARDSON H',
    displayName: 'Fort Richardson Hatchery',
    lat: 61.2700, lng: -149.6800,
    region: 'Cook Inlet',
    locationCode: '24701-FRH',
  },
  {
    name: 'HALIBUT COVE H',
    displayName: 'Halibut Cove Hatchery',
    lat: 59.5975, lng: -151.2347,
    region: 'Cook Inlet',
    locationCode: '24704-HCH',
  },
  {
    name: 'PORT GRAHAM H',
    displayName: 'Port Graham Hatchery',
    lat: 59.3500, lng: -151.8300,
    region: 'Cook Inlet',
    locationCode: '24704-PGH',
  },
  {
    name: 'NOME INSTREAM INCUB H',
    displayName: 'Nome Instream Incubator Hatchery',
    lat: 64.5011, lng: -165.4064,
    region: 'Northern Alaska',
    locationCode: 'NOME-INS',
  },
  {
    name: 'RUTH BURNETT H',
    displayName: 'Ruth Burnett Sport Fish Hatchery',
    lat: 64.8378, lng: -147.7164,
    region: 'Northern Alaska',
    locationCode: 'FAIR-RBH',
  },
  // ── Kodiak ────────────────────────────────────────────────────────────────
  {
    name: 'KITOI BAY H',
    displayName: 'Kitoi Bay Hatchery',
    lat: 58.1500, lng: -152.5000,
    region: 'Kodiak',
    locationCode: '26001-KBH',
  },
];

// ─── Location map cache ───────────────────────────────────────────────────────
// Fetch ALL location types (not just ADFG) so ocean recovery stat areas are
// included. PWS recoveries are often reported by ADFG, PWSAC, or other agencies
// and the location records may come from any reporting agency.

const VERIFIED_HATCHERY_LOCATION_CODES: Record<string, string> = {
  'ARMIN F KOERNIG': '1F2PW226^4016690',
  'A F KOERNIG': '1F2PW226^4016690',
  'WALLY NOERENBERG': '1F2PW223^40',
  'ESTHER ISLAND': '1F2PW223^40',
  'CANNERY CREEK': '1F2PW222^5012410',
  'MAIN BAY': '1F2PW225^2015030',
  'SOLOMON GULCH': '1F2PW221^6011360',
  'TUTKA BAY': '1F2LC241^16',
  'TUTKA BAY LAGOON': '1F2LC241^16',
  'MACAULAY': '1F1NE111^4010150998',
  'NEETS BAY': '1F1SE101^9010100',
  'HIDDEN FALLS': '1F1NE112^1110110',
  'BURNETT INLET': '1F1SE106^22',
  'BEAVER FALLS': '1F1SE101^4510120',
  'DEER MOUNTAIN': '1F1SE101^4710250',
  'FISH CREEK': '1M1NE111^5010690',
  'GUNNUK CREEK': '1F1NE109^4210040',
  'KOWEE CREEK': '1F1NE111^4010900',
  'LITTLE PORT WALTER': '1F1NE109^1099999',
  'PORT SAINT NICHOLAS': '1F1SW103^60',
  'CLEAR': '1F3YU334^4011000490',
  'EKLUTNA': '1F2UC247^5010175',
  'ELMENDORF': '1F2UC247^5010060',
  'FORT RICHARDSON': '1F2UC247^5010060999',
  'HALIBUT COVE': '1M2LC241^15',
  'PORT GRAHAM': '1F2LC241^2099999',
  'NOME INSTREAM INCUB': '1F3NS333^10',
  'NOME INSTREAM INCUBATOR': '1F3NS333^10',
  'RUTH BURNETT': '1F3YU334^40',
  'KITOI BAY': '1F4KD252^31',
};

function hatcheryLookupKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' AND ')
    .replace(/\bHATCHERY\b/g, ' ')
    .replace(/\bSALMON\b/g, ' ')
    .replace(/\bFISH\b/g, ' ')
    .replace(/\bSPORT\b/g, ' ')
    .replace(/\bFACILITY\b/g, ' ')
    .replace(/\bSCIENCE\b/g, ' ')
    .replace(/\bCENTER\b/g, ' ')
    .replace(/\bH\b/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function verifiedHatcheryLocationCode(name: string): string | null {
  const key = hatcheryLookupKey(name);
  if (VERIFIED_HATCHERY_LOCATION_CODES[key]) return VERIFIED_HATCHERY_LOCATION_CODES[key];

  for (const [known, code] of Object.entries(VERIFIED_HATCHERY_LOCATION_CODES)) {
    if (key === known || key.includes(known) || known.includes(key)) return code;
  }
  return null;
}

function movementHatcheryAliases(name: string): string[] {
  const key = hatcheryLookupKey(name);
  if (key.includes('WALLY NOERENBERG') || key.includes('ESTHER ISLAND')) {
    return ['Wally Noerenberg Hatchery', 'Esther Island Hatchery'];
  }
  if (key.includes('SOLOMON GULCH') || key.includes('VALDEZ FISHERIES')) {
    return ['Solomon Gulch Hatchery (Valdez)', 'Valdez Fisheries Development (Valdez)'];
  }
  return [name];
}

function hatcheryEntryForAlias(base: HatcheryEntry, alias: string): HatcheryEntry {
  const aliasKey = hatcheryLookupKey(alias);
  const seed = KNOWN_ALASKA_HATCHERIES.find(candidate => {
    const rawKey = hatcheryLookupKey(candidate.name);
    const displayKey = hatcheryLookupKey(candidate.displayName);
    return rawKey === aliasKey || displayKey === aliasKey || aliasKey.includes(rawKey);
  });

  if (!seed) return { ...base, name: alias, location: alias };

  return {
    name: alias,
    lat: base.lat,
    lng: base.lng,
    location: alias,
    region: base.region,
    locationCode: seed.locationCode,
    species: [],
  };
}

async function resolveMovementHatcheryLocationCodes(
  hatchery: HatcheryEntry,
  locationMap: Map<string, RmisLocation>
): Promise<string[]> {
  const codes = new Set<string>();
  for (const alias of movementHatcheryAliases(hatchery.name)) {
    const aliasEntry = hatcheryEntryForAlias(hatchery, alias);
    const aliasCodes = await resolveHatcheryLocationCode(aliasEntry, locationMap);
    for (const code of aliasCodes) codes.add(code);
  }
  return Array.from(codes);
}

export function getSeedAlaskaHatcheries(): HatcheryEntry[] {
  const seen = new Set<string>();
  return KNOWN_ALASKA_HATCHERIES
    .map(seed => ({
      seed,
      verifiedCode: verifiedHatcheryLocationCode(seed.displayName) ?? verifiedHatcheryLocationCode(seed.name),
    }))
    .filter(({ seed, verifiedCode }) => {
      if (!verifiedCode) return false;
      if (seen.has(seed.displayName)) return false;
      seen.add(seed.displayName);
      return true;
    })
    .map(({ seed, verifiedCode }) => ({
      name: seed.displayName,
      lat: seed.lat,
      lng: seed.lng,
      location: seed.displayName,
      region: seed.region,
      locationCode: verifiedCode!,
      species: [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getSeedAlaskaRegions(): string[] {
  return Array.from(new Set(getSeedAlaskaHatcheries().map(hatchery => hatchery.region))).sort();
}

let _locationMapCache: Map<string, RmisLocation> | null = null;

async function getLocationMap(): Promise<Map<string, RmisLocation>> {
  if (_locationMapCache) return _locationMapCache;
  _coordResolveCache.clear();
  const map = new Map<string, RmisLocation>();

  // Fetch without agency filter — covers all location types (recovery stat areas,
  // type-3 hatchery/facility records, type-4 release sites, etc.)
  // Gracefully handle upstream 500 errors from RMIS /location — fall back to
  // the static stat-area table and known hatchery seeds which cover Alaska well.
  try {
    for (let page = 1; page <= 60; page++) {
      let res;
      try {
        res = await fetchLocations({ perpage: '500', page: String(page) });
      } catch (pageErr) {
        // A single page failure (e.g. upstream 500) — stop pagination but keep
        // whatever we already collected.
        console.warn('[movementDataService] /location page', page, 'failed:', pageErr);
        break;
      }
      const records = res.records ?? [];
      for (const loc of records) {
        // Prefer records that have coordinates
        if (!map.has(loc.location_code) || (loc.latitude != null && loc.longitude != null)) {
          map.set(loc.location_code, loc);
        }
      }
      if (records.length < 500) break;
    }
  } catch (err) {
    console.warn('[movementDataService] /location fetch failed entirely, using static fallback:', err);
  }

  try {
    const officialLocations = await fetchOfficialLocationMap();
    for (const loc of officialLocations.values()) preferLocationRecord(map, loc);
  } catch (err) {
    console.warn('[movementDataService] official location file unavailable, using API/static location fallback:', err);
  }

  _locationMapCache = map;
  return map;
}

// ─── Hatchery registry ────────────────────────────────────────────────────────

let _hatcheryCache: HatcheryEntry[] | null = null;

export async function fetchAlaskaHatcheries(): Promise<HatcheryEntry[]> {
  if (_hatcheryCache) return _hatcheryCache;
  const locationMap = await getLocationMap();

  // Build from RMIS API first
  const hatcheries: HatcheryEntry[] = [];
  const seenNames = new Set<string>();

  for (const loc of locationMap.values()) {
    // location_type=3 is Hatchery/Facility in RMIS. type=4 is Release Site — do NOT use.
    if (String(loc.location_type) !== '3') continue;
    if (loc.latitude == null || loc.longitude == null) continue;
    if (loc.latitude < 50 || loc.latitude > 72) continue;
    if (loc.longitude < -180 || loc.longitude > -120) continue;

    const rawName = String(loc.name ?? loc.location_name ?? '');
    if (!rawName.endsWith(' H') && !rawName.includes('HATCHERY') && !rawName.includes(' HATCH')) continue;
    if (seenNames.has(rawName)) continue;
    seenNames.add(rawName);

    hatcheries.push({
      name: rawName,
      lat: loc.latitude,
      lng: loc.longitude,
      location: rawName,
      region: basinToRegion(loc.psc_basin),
      locationCode: loc.location_code,
      species: [],
    });
  }

  // Merge static seed — add any known hatcheries missing from RMIS results.
  // Use displayName as the user-facing name; match against RMIS by raw name.
  for (const seed of KNOWN_ALASKA_HATCHERIES) {
    const seedNameUpper = seed.name.toUpperCase();
    const seedDisplayUpper = seed.displayName.toUpperCase();
    const seedKeyword = seed.name.replace(/ H$/, '').toUpperCase();

    // Find existing RMIS entry by exact raw name, keyword match, or display name
    const existing = hatcheries.find(h => {
      const n = h.name.toUpperCase();
      return n === seedNameUpper || n === seedDisplayUpper || n.includes(seedKeyword);
    });

    if (!existing) {
      // Not in RMIS — add from static seed with display name
      hatcheries.push({
        name: seed.displayName,
        lat: seed.lat,
        lng: seed.lng,
        location: seed.displayName,
        region: seed.region,
        locationCode: verifiedHatcheryLocationCode(seed.displayName) ?? verifiedHatcheryLocationCode(seed.name) ?? seed.locationCode,
        species: [],
      });
    } else {
      // Already in RMIS — replace raw name with friendly display name
      existing.name = seed.displayName;
      existing.location = seed.displayName;
    }
  }

  hatcheries.sort((a, b) => a.name.localeCompare(b.name));
  _hatcheryCache = hatcheries;
  return hatcheries;
}

export async function fetchAlaskaRegions(): Promise<string[]> {
  const hatcheries = await fetchAlaskaHatcheries();
  return Array.from(new Set(hatcheries.map(h => h.region))).sort();
}

// ─── Core: build weekly movement data ────────────────────────────────────────
//
// For each brood/run year that has recoveries:
//   - Fetch all CWT recoveries for this hatchery + run_year directly
//   - Group by (calendarYear, isoWeek) → compute avg lat/lng centroid
//   - Sort chronologically
//   - Prepend hatchery origin, append hatchery return
//   - Mark second half as isReturn=true (fish heading back)

/**
 * Resolve the real RMIS location code(s) for a hatchery.
 *
 * RMIS /release?hatchery_location_code= requires a type-3 (Hatchery/Facility)
 * location code. Bare stat-area prefixes (35002, 24701, etc.) and composite
 * placeholder codes ("35002-EGH", "NOME-INS") return 0 records.
 *
 * Strategy (in order):
 *  1. If the stored locationCode is already a real RMIS type-3 code, use it
 *     directly plus any name-matched extras.
 *  2. Search the location map (type=3 records) by name similarity.
 *  3. Query /location directly for type-3 records matching the hatchery name.
 *  4. Scan release records from known Alaska agencies to discover the real code.
 *  5. Return [] — never fall back to bare numeric area codes.
 */
async function resolveHatcheryLocationCode(
  hatchery: HatcheryEntry,
  locationMap: Map<string, RmisLocation>
): Promise<string[]> {
  // Static seed codes are placeholders — not real RMIS hatchery/facility codes.
  // Patterns: "35002-EGH" (numeric-dash-alpha) or "NOME-INS" (4alpha-dash-alpha)
  const verifiedCode = verifiedHatcheryLocationCode(hatchery.name) ?? verifiedHatcheryLocationCode(hatchery.location);
  if (verifiedCode) {
    const extras = findLocationCodesByName(hatchery.name, locationMap, verifiedCode);
    return [verifiedCode, ...extras];
  }

  const isStaticSeed =
    /^\d+-[A-Z]+$/.test(hatchery.locationCode) ||
    /^[A-Z]{4}-[A-Z]+$/.test(hatchery.locationCode);

  if (!isStaticSeed) {
    // Real RMIS code (e.g. "1F2PW223^40") — use directly, plus any name-matched type-3 extras.
    const extras = findLocationCodesByName(hatchery.name, locationMap, hatchery.locationCode);
    return [hatchery.locationCode, ...extras];
  }

  // Static seed: the stored code is a placeholder — never pass it to RMIS.
  // Search for the real type-3 code by name only.

  // 1) Search the cached location map for type-3 records matching by name.
  const byName = findLocationCodesByName(hatchery.name, locationMap, null);
  if (byName.length > 0) return byName;

  // 2) Direct RMIS /location query for type-3 by name keyword (catches hatcheries
  //    whose type-3 record wasn't in the paginated location map cache).
  const directByName = await queryLocationType3ByName(hatchery.name);
  if (directByName.length > 0) return directByName;

  // 3) Scan release records from known Alaska agencies to discover the real
  //    hatchery_location_code by matching the hatchery name in release metadata.
  const discovered = await discoverHatcheryCodesFromReleases('', hatchery, locationMap);
  if (discovered.length > 0) return discovered;

  // No real RMIS hatchery/facility (type-3) code found — return empty so the
  // caller shows the correct "not in RMIS" message rather than querying with
  // a bogus area code like 35002 or 24701.
  return [];
}

/**
 * Query RMIS /location directly for type-3 (Hatchery/Facility) records matching
 * a name keyword. Paginates through ALL pages to find the hatchery.
 * Returns location_code values only.
 */
async function queryLocationType3ByName(hatcheryName: string): Promise<string[]> {
  // Extract the most distinctive keywords (longest words after stripping suffixes)
  const cleaned = hatcheryName
    .toUpperCase()
    .replace(/\bHATCHERY\b/g, '')
    .replace(/\bSALMON\b/g, '')
    .replace(/\bFISH\b/g, '')
    .replace(/\bSCIENCE CENTER\b/g, '')
    .trim();
  const keywords = cleaned.split(/\s+/).filter(p => p.length > 3).sort((a, b) => b.length - a.length);
  if (keywords.length === 0) return [];

  const codes: string[] = [];
  try {
    // Paginate through all type-3 location records
    for (let page = 1; page <= 20; page++) {
      const res = await fetchLocations({ location_type: '3', perpage: '500', page: String(page) });
      const records = res.records ?? [];
      for (const loc of records) {
        const locName = String(loc.name ?? loc.location_name ?? '').toUpperCase();
        // Match if any keyword is found in the location name
        if (keywords.some(kw => locName.includes(kw))) {
          codes.push(loc.location_code);
        }
      }
      if (records.length < 500) break;
    }
  } catch {
    // ignore
  }
  return codes;
}

/**
 * Search the location map for hatchery/facility records (location_type=3) whose
 * name matches the given hatchery name. Returns location codes, excluding `exclude`.
 *
 * IMPORTANT: Only location_type=3 (Hatchery/Facility) codes are valid as
 * hatchery_location_code in /release queries. type=4 is Release Site — using
 * those codes returns 0 results from /release?hatchery_location_code=.
 */
function findLocationCodesByName(
  hatcheryName: string,
  locationMap: Map<string, RmisLocation>,
  exclude: string | null
): string[] {
  // Build keyword list from the display name, stripping common suffixes
  const cleaned = hatcheryName
    .toUpperCase()
    .replace(/\bHATCHERY\b/g, '')
    .replace(/\bSALMON\b/g, '')
    .replace(/\bFISH\b/g, '')
    .replace(/\bSCIENCE CENTER\b/g, '')
    .trim();
  const nameParts = cleaned.split(/\s+/).filter(p => p.length > 2);

  const candidates: string[] = [];
  for (const loc of locationMap.values()) {
    // MUST be location_type=3 (Hatchery/Facility). type=4 is Release Site —
    // those codes do NOT work as hatchery_location_code in /release queries.
    if (String(loc.location_type) !== '3') continue;
    const code = loc.location_code;
    if (code === exclude) continue;
    const locName = String(loc.name ?? loc.location_name ?? '').toUpperCase();
    const matchCount = nameParts.filter(p => locName.includes(p)).length;
    // Require at least 2 keyword matches, or 1 if the name is short
    if (matchCount >= Math.min(2, nameParts.length)) {
      candidates.push(code);
    }
  }
  return candidates;
}

/**
 * Discover real RMIS hatchery_location_code values for a hatchery by scanning
 * release records from known Alaska agencies and matching by hatchery name.
 *
 * Only accepts codes that are location_type=3 (Hatchery/Facility) in the
 * location map, or are unknown (not in map — accepted cautiously).
 * Never accepts area/stat-area codes like 35002, 24701, etc.
 */
async function discoverHatcheryCodesFromReleases(
  _statAreaPrefix: string,  // unused — kept for signature compat, never passed to RMIS
  hatchery: HatcheryEntry,
  locationMap: Map<string, RmisLocation>
): Promise<string[]> {
  const found = new Set<string>();

  const acceptCode = (hlc: string) => {
    if (!hlc) return;
    // Reject pure numeric area codes — these are stat areas, not hatchery codes.
    if (/^\d+$/.test(hlc.trim())) return;
    // Only accept type-3 (Hatchery/Facility) codes — type-4 Release Site
    // codes return 0 results when queried as hatchery_location_code.
    const loc = locationMap.get(hlc);
    if (loc && String(loc.location_type) !== '3') return;
    found.add(hlc);
  };

  const nameKeywords = hatchery.name
    .toUpperCase()
    .replace(/\bHATCHERY\b/g, '')
    .replace(/\bSALMON\b/g, '')
    .trim()
    .split(/\s+/)
    .filter(p => p.length > 2);
  const primaryKeyword = nameKeywords[0] ?? '';
  if (!primaryKeyword) return [];

  try {
    for (const agency of ['ADFG', 'PWSAC', 'DIPAC', 'SSRAA', 'USFWS', 'CRITFC']) {
      for (let page = 1; page <= 15; page++) {
        const res = await fetchReleases({ reporting_agency: agency, perpage: '500', page: String(page) });
        const records = res.records ?? [];
        for (const r of records) {
          const hlc = r.hatchery_location_code ?? '';
          if (!hlc) continue;
          const loc = locationMap.get(hlc);
          const locName = String(loc?.name ?? loc?.location_name ?? '').toUpperCase();
          if (locName.includes(primaryKeyword)) acceptCode(hlc);
          const releaseAgency = String(r.release_agency ?? '').toUpperCase();
          if (releaseAgency.includes(primaryKeyword)) acceptCode(hlc);
        }
        if (records.length < 500) break;
      }
      if (found.size > 0) break;
    }
  } catch { /* ignore */ }

  return Array.from(found);
}

/**
 * Scan releases from known Alaska agencies to discover the real RMIS
 * hatchery_location_code for a hatchery. This handles cases where the
 * location map doesn't contain the hatchery's type-3 record (e.g. short
 * alphanumeric codes like "AFKH", "WNOER", "SSGCH").
 *
 * Strategy: fetch releases from ADFG/PWSAC/DIPAC/SSRAA, collect all unique
 * hatchery_location_code values, then resolve each via the location map or a
 * direct /location query to find ones whose name matches this hatchery.
 */
async function discoverHatcheryCodesFromAgencyScan(
  hatchery: HatcheryEntry,
  locationMap: Map<string, RmisLocation>
): Promise<string[]> {
  // Build keyword list from hatchery name
  const cleaned = hatchery.name
    .toUpperCase()
    .replace(/\bHATCHERY\b/g, '')
    .replace(/\bSALMON\b/g, '')
    .replace(/\bFISH\b/g, '')
    .replace(/\bSCIENCE CENTER\b/g, '')
    .trim();
  const keywords = cleaned.split(/\s+/).filter(p => p.length > 2);
  if (keywords.length === 0) return [];

  const found = new Set<string>();

  // Collect all unique hatchery_location_code values from agency releases
  // Use more pages and also try species/region-scoped queries for better coverage
  const allHlcCodes = new Set<string>();
  for (const agency of ['ADFG', 'PWSAC', 'DIPAC', 'SSRAA', 'WDFW', 'ODFW', 'USFWS', 'CRITFC']) {
    try {
      for (let page = 1; page <= 10; page++) {
        const res = await fetchReleases({ reporting_agency: agency, perpage: '500', page: String(page) });
        for (const r of res.records ?? []) {
          const hlc = r.hatchery_location_code?.trim();
          if (hlc) allHlcCodes.add(hlc);
        }
        if ((res.records ?? []).length < 500) break;
      }
    } catch { /* ignore */ }
  }

  // Also try querying by release_agency directly (some hatcheries submit under their own agency code)
  const releaseAgencyKeyword = keywords[0];
  if (releaseAgencyKeyword && releaseAgencyKeyword.length > 3) {
    try {
      for (let page = 1; page <= 5; page++) {
        const res = await fetchReleases({ release_agency: releaseAgencyKeyword, perpage: '500', page: String(page) });
        for (const r of res.records ?? []) {
          const hlc = r.hatchery_location_code?.trim();
          if (hlc) allHlcCodes.add(hlc);
        }
        if ((res.records ?? []).length < 500) break;
      }
    } catch { /* ignore */ }
  }

  // For each unique hatchery_location_code, check if its name matches our hatchery
  for (const hlc of allHlcCodes) {
    // Check location map first
    const loc = locationMap.get(hlc);
    if (loc) {
      const locName = String(loc.name ?? loc.location_name ?? '').toUpperCase();
      const matchCount = keywords.filter(k => locName.includes(k)).length;
      if (matchCount >= Math.min(2, keywords.length)) {
        found.add(hlc);
        continue;
      }
    }
    // Not in map — query /location directly for this code
    try {
      const res = await fetchLocations({ location_code: hlc, perpage: '10', page: '1' });
      for (const l of res.records ?? []) {
        const locName = String(l.name ?? l.location_name ?? '').toUpperCase();
        const matchCount = keywords.filter(k => locName.includes(k)).length;
        if (matchCount >= Math.min(2, keywords.length)) {
          found.add(hlc);
          // Cache it in the location map for future use
          locationMap.set(hlc, l);
        }
      }
    } catch { /* ignore */ }
  }

  return Array.from(found);
}

export interface MovementDataResult {
  movements: HatcheryWeeklyMovement[];
  /** Diagnostic info for empty results — helps distinguish failure modes */
  diagnostic?: {
    resolvedCodes: string[];
    releaseCount: number;
    tagCodeCount: number;
    recoveryCount: number;
    message: string;
  };
}

export interface MovementDataOptions {
  recoveryYears?: number[];
  speciesCodes?: string[];
  aggregateSelectedYears?: boolean;
  includeOutliers?: boolean;
}

interface OceanWeekBucket {
  weightedLat: number;
  weightedLng: number;
  coordWeight: number;
  catchTotal: number;
  calYear: number;
  isoWeek: number;
  numRecords: number;
  locations: Map<string, number>;
}

function oceanBucketLabel(bucket: OceanWeekBucket): string {
  const locations = Array.from(bucket.locations.entries()).sort((a, b) => b[1] - a[1]);
  const primary = locations[0]?.[0] ?? 'Ocean recovery area';
  return locations.length > 1 ? `${primary} + ${locations.length - 1} more` : primary;
}

export async function buildWeeklyOceanRecoveryData(
  years: number[] = [YEAR_RANGE_END]
): Promise<MovementDataResult> {
  const selectedYears = Array.from(new Set(years))
    .filter(year => year >= YEAR_RANGE_START && year <= YEAR_RANGE_END)
    .sort((a, b) => a - b);

  if (selectedYears.length === 0) {
    return {
      movements: [],
      diagnostic: {
        resolvedCodes: OCEAN_RECOVERY_FISHERY_CODES,
        releaseCount: 0,
        tagCodeCount: 0,
        recoveryCount: 0,
        message: 'Select at least one recovery year to load recovery records.',
      },
    };
  }

  const locationMap = await getLocationMap();
  const recordsByYear = await Promise.all(
    selectedYears.map(async year => ({ year, records: await fetchOceanRecoveryRecordsForYear(year) }))
  );

  const results: HatcheryWeeklyMovement[] = [];
  let rawRecoveryCount = 0;
  let mappedRecoveryCount = 0;

  for (const { year, records } of recordsByYear) {
    rawRecoveryCount += records.length;
    const weekMap = new Map<string, OceanWeekBucket>();

    for (const rec of records) {
      const parts = recoveryDateParts(rec);
      if (!parts) continue;

      const coords = resolveCoords(rec.recovery_location_code, locationMap);
      if (!coords) continue;
      const [lat, lng] = coords;
      if (!validRecoveryCoords(lat, lng)) continue;

      const isoWeek = isoWeekNumber(parts.date);
      const catchCount = recoveryCatchCount(rec);
      const weight = Math.max(catchCount, 1);
      const key = `${parts.calYear}-W${String(isoWeek).padStart(2, '0')}`;
      const locName = recoveryLocationName(rec, locationMap);

      if (!weekMap.has(key)) {
        weekMap.set(key, {
          weightedLat: 0,
          weightedLng: 0,
          coordWeight: 0,
          catchTotal: 0,
          calYear: parts.calYear,
          isoWeek,
          numRecords: 0,
          locations: new Map(),
        });
      }

      const bucket = weekMap.get(key)!;
      bucket.weightedLat += lat * weight;
      bucket.weightedLng += lng * weight;
      bucket.coordWeight += weight;
      bucket.catchTotal += catchCount;
      bucket.numRecords++;
      bucket.locations.set(locName, (bucket.locations.get(locName) ?? 0) + catchCount);
      mappedRecoveryCount++;
    }

    const sortedBuckets = Array.from(weekMap.values()).sort((a, b) => {
      if (a.calYear !== b.calYear) return a.calYear - b.calYear;
      return a.isoWeek - b.isoWeek;
    });

    if (sortedBuckets.length === 0) continue;

    let totalCatch = 0;
    const positions = sortedBuckets.map<WeeklyPosition>((bucket, idx) => {
      totalCatch += bucket.catchTotal;
      return {
        weekIndex: idx,
        weekLabel: buildWeekLabel(bucket.isoWeek, bucket.calYear),
        isoWeek: bucket.isoWeek,
        recoveryYear: bucket.calYear,
        lat: bucket.weightedLat / bucket.coordWeight,
        lng: bucket.weightedLng / bucket.coordWeight,
        catchCount: bucket.catchTotal,
        locationName: oceanBucketLabel(bucket),
        isHatchery: false,
        isReturn: false,
        numRecords: bucket.numRecords,
      };
    });

    results.push({
      year,
      hatcheryName: 'Ocean recoveries',
      hatcheryLat: positions[0]?.lat ?? 60,
      hatcheryLng: positions[0]?.lng ?? -153,
      weeklyPositions: positions,
      totalCatch,
      weekCount: positions.length,
    });
  }

  if (results.length === 0) {
    return {
      movements: [],
      diagnostic: {
        resolvedCodes: OCEAN_RECOVERY_FISHERY_CODES,
        releaseCount: 0,
        tagCodeCount: 0,
        recoveryCount: rawRecoveryCount,
        message: rawRecoveryCount > 0
          ? `Found ${rawRecoveryCount.toLocaleString()} ocean recovery record(s), but none had resolvable marine coordinates.`
          : `No ocean recovery records found for ${selectedYears.join(', ')}.`,
      },
    };
  }

  return {
    movements: results,
    diagnostic: {
      resolvedCodes: OCEAN_RECOVERY_FISHERY_CODES,
      releaseCount: 0,
      tagCodeCount: 0,
      recoveryCount: mappedRecoveryCount,
      message: `Loaded ${mappedRecoveryCount.toLocaleString()} ocean recovery record(s).`,
    },
  };
}

export async function buildWeeklyMovementData(
  hatcheryName: string,
  options: MovementDataOptions = {}
): Promise<MovementDataResult> {
  let hatchery = getSeedAlaskaHatcheries().find(h => h.name === hatcheryName);
  if (!hatchery) {
    const hatcheries = await fetchAlaskaHatcheries();
    hatchery = hatcheries.find(h => h.name === hatcheryName);
  }
  if (!hatchery) return { movements: [], diagnostic: { resolvedCodes: [], releaseCount: 0, tagCodeCount: 0, recoveryCount: 0, message: 'Hatchery not found in registry.' } };

  const locationMap = await getLocationMap();
  const selectedRecoveryYears = new Set(
    (options.recoveryYears ?? [])
      .filter(year => year >= YEAR_RANGE_START && year <= YEAR_RANGE_END)
  );
  const selectedSpeciesCodes = new Set(
    (options.speciesCodes ?? SALMON_SPECIES_CODES).filter(Boolean)
  );

  type WeekKey = string; // `${calYear}-W${isoWeek}`
  interface WeekBucket {
    lats: number[];
    lngs: number[];
    catchTotal: number;
    locationName: string;
    calYear: number;
    isoWeek: number;
    numRecords: number;
  }

  // runYear → weekKey → bucket
  const runYearMap = new Map<number, Map<WeekKey, WeekBucket>>();

  // ── Step 1: Resolve hatchery RMIS `hatchery_location_code` value(s) ───────
  const locationCodes = await resolveMovementHatcheryLocationCodes(hatchery, locationMap);
  const hatcheryCodesToQuery = Array.from(new Set(locationCodes));

  // ── Step 2: `/release?hatchery_location_code=` → tag_code_or_release_id ──
  // `/recovery` requires a bounded query — use tag_code. No release_location_code shortcut.
  const tagCodes = new Set<string>();
  const tagSpecies = new Map<string, string>();
  let totalReleaseRecords = 0;

  async function collectTagCodesForParam(paramKey: string, paramVal: string) {
    for (let page = 1; page <= 100; page++) {
      let res;
      try {
        res = await fetchReleases({ [paramKey]: paramVal, perpage: '500', page: String(page) });
      } catch { break; }
      const records = res.records ?? [];
      totalReleaseRecords += records.length;
      for (const r of records) {
        if (selectedSpeciesCodes.size > 0 && !selectedSpeciesCodes.has(String(r.species))) continue;
        const tc = r.tag_code_or_release_id;
        if (!tc || !tc.trim()) continue;
        const t = tc.trim();
        // Non-CWT aggregate rows — no per-tag recovery in RMIS
        if (t.startsWith('!')) continue;
        tagCodes.add(t);
        tagSpecies.set(t, String(r.species));
      }
      if (records.length < 500) break;
    }
  }

  await Promise.all(
    hatcheryCodesToQuery.map(code => collectTagCodesForParam('hatchery_location_code', code))
  );

  // ── Fallback: if no releases found, try broader agency-based discovery ────
  // Many Alaska hatcheries have RMIS codes that don't match the location map
  // (e.g. short alphanumeric codes like "AFKH", "WNOER"). Scan releases from
  // known Alaska agencies and match hatchery_location_code by name similarity.
  if (totalReleaseRecords === 0) {
    const discoveredCodes = await discoverHatcheryCodesFromAgencyScan(hatchery, locationMap);
    if (discoveredCodes.length > 0) {
      for (const code of discoveredCodes) {
        if (!hatcheryCodesToQuery.includes(code)) {
          hatcheryCodesToQuery.push(code);
          await collectTagCodesForParam('hatchery_location_code', code);
        }
      }
    }
  }

  // ── Second fallback: release_location_code with stat-area prefix ──────────
  // REMOVED: passing numeric area codes like 35002 or 24701 as
  // hatchery_location_code returns 0 results — those are stat areas, not
  // hatchery codes. Never fall back to the numeric prefix.

  if (totalReleaseRecords === 0) {
    // Detect static seed entries: composite codes like "35002-EGH" or "NOME-INS"
    // that are placeholders, not real RMIS hatchery/facility codes.
    const isStaticSeed =
      /^\d+-[A-Z]+$/.test(hatchery.locationCode) ||
      /^[A-Z]{4}-[A-Z]+$/.test(hatchery.locationCode);
    const noRmisCode = hatcheryCodesToQuery.length === 0;

    let noDataMessage: string;
    if (isStaticSeed && noRmisCode) {
      noDataMessage = `${hatchery.name} is in SeaScope's hatchery list, but no verified movement-data facility record was found. Try a different hatchery.`;
    } else {
      const isBristolBay = /^1[A-Z]2BB/.test(hatchery.locationCode);
      const isNorthernAK = /^(NOME|FAIR)/.test(hatchery.locationCode);
      if (isBristolBay) {
        noDataMessage = `${hatchery.name} is a Bristol Bay enhancement facility. Official Sources do not report mappable salmon movement data for this selection.`;
      } else if (isNorthernAK) {
        noDataMessage = `${hatchery.name} does not appear to have Official Sources release records with mappable movement data. This hatchery may focus on sport fish or use non-mappable marking programs.`;
      } else {
        noDataMessage = `No Official Sources release records found for ${hatchery.name}. This hatchery may not report mappable movement data under the selected source records.`;
      }
    }
    return {
      movements: [],
      diagnostic: {
        resolvedCodes: hatcheryCodesToQuery,
        releaseCount: 0,
        tagCodeCount: 0,
        recoveryCount: 0,
        message: noDataMessage,
      },
    };
  }

  if (tagCodes.size === 0) {
    return {
      movements: [],
      diagnostic: {
        resolvedCodes: hatcheryCodesToQuery,
        releaseCount: totalReleaseRecords,
        tagCodeCount: 0,
        recoveryCount: 0,
        message: `Found ${totalReleaseRecords} Official Sources release record(s), but none had mappable movement identifiers. Releases may be untagged or use non-mappable marks.`,
      },
    };
  }

  // Step 3: selected-year recovery rows for the release identifiers.
  const tagCodeArray = Array.from(tagCodes);
  const rawRecoveries: RmisRecovery[] = [];
  const selectedRecoveryYearsArray = Array.from(selectedRecoveryYears).sort((a, b) => a - b);

  if (options.aggregateSelectedYears && selectedRecoveryYearsArray.length > 0) {
    rawRecoveries.push(...await fetchOfficialRecoveryRecordsForTagsByYears(tagCodes, selectedRecoveryYearsArray));
  }

  if (rawRecoveries.length === 0) {
    // Fallback for deployments where the recovery endpoint has data available.
    const BATCH_SIZE = 20;
    for (let i = 0; i < tagCodeArray.length; i += BATCH_SIZE) {
      const batch = tagCodeArray.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (tagCode) => {
        for (let page = 1; page <= 50; page++) {
          let res;
          try {
            res = await fetchRecoveries({ tag_code: tagCode, perpage: '500', page: String(page) });
          } catch { break; }
          const records = res.records ?? [];
          rawRecoveries.push(...records);
          if (records.length < 500) break;
        }
      }));
    }
  }

  if (rawRecoveries.length === 0) {
    return {
      movements: [],
      diagnostic: {
        resolvedCodes: hatcheryCodesToQuery,
        releaseCount: totalReleaseRecords,
        tagCodeCount: tagCodes.size,
        recoveryCount: 0,
        message: `Found ${tagCodes.size} Official Sources movement identifier(s) from ${totalReleaseRecords} release record(s), but no recovery records matched. The selected fish may not have non-hatchery recoveries yet.`,
      },
    };
  }

  await enrichLocationMapForRecoveryCodes(rawRecoveries, locationMap);

  if (options.aggregateSelectedYears) {
    const includeOutliers = options.includeOutliers === true;

    interface AggregateMovementBucket {
      bucketKey: number;
      weightedLat: number;
      weightedLng: number;
      weightedMovementDay: number;
      coordWeight: number;
      catchTotal: number;
      isoWeek: number;
      numRecords: number;
      locations: Map<string, number>;
      years: Set<number>;
      points: ConfidenceRecoveryPoint[];
    }

    function filteredSpotBucket(bucket: AggregateMovementBucket, minTrackedFish: number): AggregateMovementBucket | null {
      const spotGroups = new Map<string, ConfidenceRecoveryPoint[]>();
      for (const point of bucket.points) {
        const spotKey = `${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`;
        const group = spotGroups.get(spotKey) ?? [];
        group.push(point);
        spotGroups.set(spotKey, group);
      }

      const filtered: AggregateMovementBucket = {
        bucketKey: bucket.bucketKey,
        weightedLat: 0,
        weightedLng: 0,
        weightedMovementDay: 0,
        coordWeight: 0,
        catchTotal: 0,
        isoWeek: bucket.isoWeek,
        numRecords: 0,
        locations: new Map(),
        years: new Set(),
        points: [],
      };

      for (const points of spotGroups.values()) {
        const spotCatchTotal = points.reduce((sum, point) => sum + point.count, 0);
        const spotYears = new Set(points.map(point => point.year));
        if (spotCatchTotal < minTrackedFish) continue;
        if (spotYears.size < 2) continue;

        for (const point of points) {
          const weight = Math.max(point.count, 1);
          const locationName = point.locationName ?? 'Recovery area';
          filtered.weightedLat += point.lat * weight;
          filtered.weightedLng += point.lng * weight;
          filtered.weightedMovementDay += point.movementDay * weight;
          filtered.coordWeight += weight;
          filtered.catchTotal += point.count;
          filtered.numRecords++;
          filtered.locations.set(locationName, (filtered.locations.get(locationName) ?? 0) + point.count);
          filtered.years.add(point.year);
          filtered.points.push(point);
        }
      }

      return filtered.points.length > 0 ? filtered : null;
    }

    function aggregateBucketToMovementPosition(bucket: AggregateMovementBucket, idx: number, isOutlier = false): WeeklyPosition {
      const locations = Array.from(bucket.locations.entries()).sort((a, b) => b[1] - a[1]);
      const primaryLocation = locations[0]?.[0] ?? 'Recovery area';
      const avgLat = bucket.weightedLat / bucket.coordWeight;
      const avgLng = bucket.weightedLng / bucket.coordWeight;
      const averageMovementDay = Math.round(bucket.weightedMovementDay / bucket.coordWeight);
      const vicinity = weeklyVicinityEllipse(bucket.points, avgLat, avgLng);
      const weekLabel = movementWeekLabel(bucket.isoWeek);
      return {
        weekIndex: idx,
        weekLabel,
        isoWeek: bucket.isoWeek,
        recoveryYear: selectedRecoveryYears.size > 0 ? Math.min(...selectedRecoveryYears) : YEAR_RANGE_START,
        movementDay: averageMovementDay,
        lat: avgLat,
        lng: avgLng,
        catchCount: bucket.catchTotal,
        locationName: locations.length > 1 ? `${primaryLocation} + ${locations.length - 1} more` : primaryLocation,
        isHatchery: false,
        isReturn: false,
        numRecords: bucket.numRecords,
        recoveryYears: Array.from(bucket.years).sort((a, b) => a - b),
        sourceWeekLabels: [weekLabel],
        sourceWeekSummaries: [{
          weekLabel,
          catchCount: bucket.catchTotal,
        }],
        isOutlier,
        vicinityRadiusKm: vicinity.radiusKm,
        vicinityMajorKm: vicinity.majorKm,
        vicinityMinorKm: vicinity.minorKm,
        vicinityBearingDeg: vicinity.bearingDeg,
        catchEvents: compactWeeklyCatchEvents(bucket.points.map(point => ({
          movementDay: point.movementDay,
          dateLabel: point.dateLabel ?? movementDayLabel(point.movementDay),
          lat: point.lat,
          lng: point.lng,
          catchCount: point.count,
          locationName: point.locationName ?? primaryLocation,
          locationCode: point.locationCode,
          recoveryYear: point.year,
        }))),
      };
    }

    const speciesMovementMap = new Map<string, Map<number, AggregateMovementBucket>>();
    const hatcheryReturnDateBySpecies = buildHatcheryReturnDateMap(
      rawRecoveries,
      selectedRecoveryYears,
      selectedSpeciesCodes,
      tagSpecies,
      hatchery,
      locationMap,
      hatcheryCodesToQuery
    );
    let selectedYearRecoveryCount = 0;
    let earliestRecoveryYear = Number.POSITIVE_INFINITY;
    let latestRecoveryYear = Number.NEGATIVE_INFINITY;
    let filteredRecoveryCount = 0;

    let rawRecoveryIndex = 0;
    for (const rec of rawRecoveries) {
      rawRecoveryIndex++;
      if (rawRecoveryIndex % 5000 === 0) await yieldToMainThread();

      const parts = recoveryDateParts(rec);
      if (!parts) continue;

      const recoveryTag = String(rec.tag_code ?? '').trim();
      const speciesCode = String(rec.species ?? tagSpecies.get(recoveryTag) ?? '');
      if (selectedSpeciesCodes.size > 0 && !selectedSpeciesCodes.has(speciesCode)) continue;
      earliestRecoveryYear = Math.min(earliestRecoveryYear, parts.calYear);
      latestRecoveryYear = Math.max(latestRecoveryYear, parts.calYear);
      if (selectedRecoveryYears.size > 0 && !selectedRecoveryYears.has(parts.calYear)) continue;
      selectedYearRecoveryCount++;
      if (!isMovementRecoveryFishery(String(rec.fishery ?? ''))) continue;

      const coords = resolveCoords(rec.recovery_location_code, locationMap);
      if (!coords) continue;
      const [recLat, recLng] = coords;
      if (!validRecoveryCoords(recLat, recLng)) continue;

      const count = recoveryCatchCount(rec);
      if (isHatcheryLocationRecovery(rec, recLat, recLng, hatchery, locationMap)) continue;
      if (isTownFalseFlag(recLat, recLng, count, hatchery)) continue;

      const movementDay = dayOfYear(parts.date);
      const isoWeek = Math.ceil(movementDay / 7);
      const bucketKey = isoWeek;
      const locName = recoveryLocationName(rec, locationMap);
      const dateLabel = `${MONTH_ABBR[parts.month - 1] ?? parts.month} ${parts.day}, ${parts.calYear}`;

      if (!speciesMovementMap.has(speciesCode)) speciesMovementMap.set(speciesCode, new Map());
      const movementMap = speciesMovementMap.get(speciesCode)!;
      if (!movementMap.has(bucketKey)) {
        movementMap.set(bucketKey, {
          bucketKey,
          weightedLat: 0,
          weightedLng: 0,
          weightedMovementDay: 0,
          coordWeight: 0,
          catchTotal: 0,
          isoWeek,
          numRecords: 0,
          locations: new Map(),
          years: new Set(),
          points: [],
        });
      }

      const bucket = movementMap.get(bucketKey)!;
      const weight = Math.max(count, 1);
      bucket.weightedLat += recLat * weight;
      bucket.weightedLng += recLng * weight;
      bucket.weightedMovementDay += movementDay * weight;
      bucket.coordWeight += weight;
      bucket.catchTotal += count;
      bucket.numRecords++;
      bucket.locations.set(locName, (bucket.locations.get(locName) ?? 0) + count);
      bucket.years.add(parts.calYear);
      bucket.points.push({
        movementDay,
        lat: recLat,
        lng: recLng,
        count,
        year: parts.calYear,
        dateLabel,
        locationName: locName,
        locationCode: rec.recovery_location_code,
      });
      filteredRecoveryCount++;
    }

    const movements: HatcheryWeeklyMovement[] = [];
    const speciesOrder = Array.from(selectedSpeciesCodes.size > 0 ? selectedSpeciesCodes : speciesMovementMap.keys());

    for (const speciesCode of speciesOrder) {
      const movementMap = speciesMovementMap.get(speciesCode);
      if (!movementMap || movementMap.size === 0) continue;

      const speciesName = MOVEMENT_SPECIES_DISPLAY_NAMES[speciesCode] ?? SPECIES_CODES[speciesCode] ?? `Species ${speciesCode}`;
      const sourceBuckets = Array.from(movementMap.values()).sort((a, b) => a.bucketKey - b.bucketKey);
      const strictBuckets = sourceBuckets
        .map(bucket => filteredSpotBucket(bucket, MOVEMENT_OUTLIER_MIN_TRACKED_FISH))
        .filter((bucket): bucket is AggregateMovementBucket => bucket !== null)
        .sort((a, b) => a.bucketKey - b.bucketKey);
      const strictBucketKeys = new Set(strictBuckets.map(bucket => bucket.bucketKey));
      const displayBuckets = sourceBuckets
        .map(bucket => filteredSpotBucket(bucket, includeOutliers ? 0 : MOVEMENT_OUTLIER_MIN_TRACKED_FISH))
        .filter((bucket): bucket is AggregateMovementBucket => bucket !== null);
      const sortedBuckets = displayBuckets.slice().sort((a, b) => a.bucketKey - b.bucketKey);
      if (sortedBuckets.length === 0) continue;
      const strictOfficialPointCount = strictBuckets.length;
      const lowOfficialData = strictOfficialPointCount < MIN_OFFICIAL_WEEKLY_POINTS;
      const returnInfo = hatcheryReturnDateBySpecies.get(speciesCode);
      const confidencePointsForRoute = sortedBuckets.flatMap(bucket => bucket.points);
      const pathConfidence = buildPathConfidence(
        confidencePointsForRoute,
        returnInfo,
        hatchery,
        selectedRecoveryYears.size,
        lowOfficialData,
        strictOfficialPointCount
      );
      let totalCatch = 0;

      const positions: WeeklyPosition[] = sortedBuckets.map((bucket, idx) => {
        totalCatch += bucket.catchTotal;
        return aggregateBucketToMovementPosition(bucket, idx, includeOutliers && !strictBucketKeys.has(bucket.bucketKey));
      });

      if (returnInfo) {
        const lastMovementDay = positions[positions.length - 1]?.movementDay ?? 1;
        const rawReturnDay = returnInfo.movementDay;
        const returnMovementDay = rawReturnDay <= lastMovementDay ? rawReturnDay + 365 : rawReturnDay;
        const returnGapDays = Math.max(1, returnMovementDay - lastMovementDay);
        const returnPlaybackDay = lastMovementDay + returnGapDays / HATCHERY_RETURN_PLAYBACK_SPEEDUP;

        positions.push({
          weekIndex: positions.length,
          weekLabel: `${speciesName} Avg Return to Hatchery (${movementDayLabel(rawReturnDay)})`,
          isoWeek: Math.ceil(normalizedMovementDay(rawReturnDay) / 7),
          recoveryYear: returnInfo.years.length > 0
            ? Math.max(...returnInfo.years)
            : selectedRecoveryYears.size > 0 ? Math.max(...selectedRecoveryYears) : YEAR_RANGE_END,
          movementDay: returnMovementDay,
          playbackDay: returnPlaybackDay,
          lat: hatchery.lat,
          lng: hatchery.lng,
          catchCount: returnInfo.catchTotal,
          locationName: hatchery.name,
          isHatchery: true,
          isReturn: true,
          numRecords: returnInfo.numRecords,
          recoveryYears: returnInfo.years,
        });
      }

      movements.push({
        year: 3000 + Number(speciesCode),
        label: speciesName,
        species: speciesName,
        hatcheryName: hatchery.name,
        hatcheryLat: hatchery.lat,
        hatcheryLng: hatchery.lng,
        weeklyPositions: positions,
        totalCatch,
        weekCount: positions.filter(pos => !pos.isHatchery && !pos.isReturn).length,
        pathConfidence,
        lowOfficialData,
      });
    }

    if (movements.length === 0) {
      const selectedYearsSorted = Array.from(selectedRecoveryYears).sort((a, b) => a - b);
      const selectedYearLabel = selectedYearsSorted.length > 0
        ? selectedYearsSorted.length === 1
          ? String(selectedYearsSorted[0])
          : `${selectedYearsSorted[0]}-${selectedYearsSorted[selectedYearsSorted.length - 1]}`
        : 'the selected years';
      const hasRecoveryYearRange = Number.isFinite(earliestRecoveryYear) && Number.isFinite(latestRecoveryYear);
      const noSelectedYearRecordsMessage = hasRecoveryYearRange && selectedYearRecoveryCount === 0
        ? `Found ${rawRecoveries.length.toLocaleString()} Official Sources recovery record(s), but none fall within ${selectedYearLabel}. Available Official Sources recovery years for this selection are ${earliestRecoveryYear}-${latestRecoveryYear}. Recent releases may use mark types that cannot be mapped as hatchery-linked movement paths.`
        : null;
      const strictOutlierHint = includeOutliers
        ? ''
        : ` Try enabling Include outliers to show spot/week points backed by fewer than ${MOVEMENT_OUTLIER_MIN_TRACKED_FISH} tracked fish across at least two recovery years.`;
      return {
        movements: [],
        diagnostic: {
          resolvedCodes: hatcheryCodesToQuery,
          releaseCount: totalReleaseRecords,
          tagCodeCount: tagCodes.size,
          recoveryCount: rawRecoveries.length,
          message: noSelectedYearRecordsMessage
            ?? `Found ${rawRecoveries.length.toLocaleString()} Official Sources recovery record(s), but none matched the selected recovery years, species, non-hatchery recovery filter, and mappable recovery locations.${strictOutlierHint} Try widening the recovery-year range if this hatchery only has historical recoveries.`,
        },
      };
    }

    return {
      movements,
      diagnostic: {
        resolvedCodes: hatcheryCodesToQuery,
        releaseCount: totalReleaseRecords,
        tagCodeCount: tagCodes.size,
        recoveryCount: filteredRecoveryCount,
        message: `Loaded ${filteredRecoveryCount.toLocaleString()} Official Sources non-hatchery recovery record(s).`,
      },
    };
  }

  for (const rec of rawRecoveries) {
    const runYear = Number(rec.run_year ?? rec.recovery_date_year ?? 0);
    const calYear = rec.recovery_date_year;
    const month = rec.recovery_date_month;
    const day = rec.recovery_date_day ?? 15;
    if (!calYear || !month) continue;
    if (selectedRecoveryYears.size > 0 && !selectedRecoveryYears.has(calYear)) continue;
    if (!runYear || runYear < YEAR_RANGE_START || runYear > YEAR_RANGE_END) continue;
    if (!isMovementRecoveryFishery(String(rec.fishery ?? ''))) continue;
    if (selectedSpeciesCodes.size > 0 && !selectedSpeciesCodes.has(String(rec.species ?? ''))) continue;

    const coords = resolveCoords(rec.recovery_location_code, locationMap);
    if (!coords) continue;
    const [recLat, recLng] = coords;

    if (recLat < 40 || recLat > 72) continue;
    if (recLng < -180 || recLng > -110) continue;

    const isoWeek = isoWeekNumber(new Date(calYear, month - 1, day));
    const count = recoveryCatchCount(rec);
    if (isHatcheryLocationRecovery(rec, recLat, recLng, hatchery, locationMap)) continue;
    if (isTownFalseFlag(recLat, recLng, count, hatchery)) continue;
    const key: WeekKey = `${calYear}-W${String(isoWeek).padStart(2, '0')}`;

    const loc = locationMap.get(rec.recovery_location_code);
    const locName = String(loc?.name ?? loc?.location_name ?? rec.recovery_location_code);

    if (!runYearMap.has(runYear)) runYearMap.set(runYear, new Map());
    const weekMap = runYearMap.get(runYear)!;

    if (!weekMap.has(key)) {
      weekMap.set(key, {
        lats: [], lngs: [], catchTotal: 0,
        locationName: locName,
        calYear, isoWeek, numRecords: 0,
      });
    }
    const bucket = weekMap.get(key)!;
    bucket.lats.push(recLat);
    bucket.lngs.push(recLng);
    bucket.catchTotal += count;
    bucket.locationName = locName;
    bucket.numRecords++;
  }

  if (runYearMap.size === 0) {
    return {
      movements: [],
      diagnostic: {
        resolvedCodes: hatcheryCodesToQuery,
        releaseCount: totalReleaseRecords,
        tagCodeCount: tagCodes.size,
        recoveryCount: rawRecoveries.length,
        message: `Found ${rawRecoveries.length} Official Sources recovery record(s) for ${tagCodes.size} movement identifier(s), but none passed the non-hatchery recovery filter or had resolvable coordinates. Recoveries may be hatchery-return events or locations without mapped coordinates.`,
      },
    };
  }

  // ── Build weekly movement tracks per run year ─────────────────────────────
  const results: HatcheryWeeklyMovement[] = [];

  for (const [runYear, weekMap] of Array.from(runYearMap.entries()).sort(([a], [b]) => a - b)) {
    if (weekMap.size < 1) continue;

    const sortedBuckets = Array.from(weekMap.values()).sort((a, b) => {
      if (a.calYear !== b.calYear) return a.calYear - b.calYear;
      return a.isoWeek - b.isoWeek;
    });

    const midIdx = Math.floor(sortedBuckets.length / 2);
    let totalCatch = 0;

    const positions: WeeklyPosition[] = [{
      weekIndex: 0,
      weekLabel: `${runYear} · Hatchery Release`,
      isoWeek: 0,
      recoveryYear: runYear,
      lat: hatchery.lat,
      lng: hatchery.lng,
      catchCount: 0,
      locationName: hatchery.name,
      isHatchery: true,
      isReturn: false,
      numRecords: 0,
    }];

    sortedBuckets.forEach((bucket, idx) => {
      const avgLat = bucket.lats.reduce((a, b) => a + b, 0) / bucket.lats.length;
      const avgLng = bucket.lngs.reduce((a, b) => a + b, 0) / bucket.lngs.length;
      totalCatch += bucket.catchTotal;

      positions.push({
        weekIndex: idx + 1,
        weekLabel: buildWeekLabel(bucket.isoWeek, bucket.calYear),
        isoWeek: bucket.isoWeek,
        recoveryYear: bucket.calYear,
        lat: avgLat,
        lng: avgLng,
        catchCount: bucket.catchTotal,
        locationName: bucket.locationName,
        isHatchery: false,
        isReturn: idx >= midIdx,
        numRecords: bucket.numRecords,
      });
    });

    const lastBucket = sortedBuckets[sortedBuckets.length - 1];
    positions.push({
      weekIndex: positions.length,
      weekLabel: `${runYear} · Return to Hatchery`,
      isoWeek: 53,
      recoveryYear: lastBucket.calYear,
      lat: hatchery.lat,
      lng: hatchery.lng,
      catchCount: 0,
      locationName: hatchery.name,
      isHatchery: true,
      isReturn: true,
      numRecords: 0,
    });

    results.push({
      year: runYear,
      hatcheryName: hatchery.name,
      hatcheryLat: hatchery.lat,
      hatcheryLng: hatchery.lng,
      weeklyPositions: positions,
      totalCatch,
      weekCount: sortedBuckets.length,
    });
  }

  return { movements: results };
}

// ─── Date view: fetch all catch positions for a specific date ─────────────────

export interface DateViewPosition {
  lat: number;
  lng: number;
  catchCount: number;
  locationName: string;
  locationCode: string;
  runYear: number;
  isoWeek: number;
  calYear: number;
}

export async function fetchPositionsForDate(
  hatcheryName: string,
  date: Date
): Promise<DateViewPosition[]> {
  try {
    const hatcheries = await fetchAlaskaHatcheries();
    const hatchery = hatcheries.find(h => h.name === hatcheryName);
    if (!hatchery) return [];

    const locationMap = await getLocationMap();
    const targetYear = date.getFullYear();
    const targetWeek = isoWeekNumber(date);

    const locationCodes = await resolveMovementHatcheryLocationCodes(hatchery, locationMap);
    const hatcheryCodes = Array.from(new Set(locationCodes));

    // Step 2: `/release?hatchery_location_code=` (type-3 codes only) → tag codes
    const tagCodes = new Set<string>();
    await Promise.all(hatcheryCodes.map(async (code) => {
      for (let page = 1; page <= 100; page++) {
        let res;
        try {
          res = await fetchReleases({ hatchery_location_code: code, perpage: '500', page: String(page) });
        } catch { break; }
        const records = res.records ?? [];
        for (const r of records) {
          const tc = r.tag_code_or_release_id;
          if (!tc || !tc.trim()) continue;
          const t = tc.trim();
          if (t.startsWith('!')) continue;
          tagCodes.add(t);
        }
        if (records.length < 500) break;
      }
    }));

    const positions: DateViewPosition[] = [];
    const seen = new Map<string, DateViewPosition>();

    function addRecovery(rec: import('./rmisApiService').RmisRecovery) {
      const calYear = rec.recovery_date_year;
      const month = rec.recovery_date_month;
      const day = rec.recovery_date_day ?? 15;
      if (!calYear || !month) return;
      if (!isOceanNonHatcheryFishery(String(rec.fishery ?? ''))) return;

      const recWeek = isoWeekNumber(new Date(calYear, month - 1, day));
      if (calYear !== targetYear || recWeek !== targetWeek) return;

      const coords = resolveCoords(rec.recovery_location_code, locationMap);
      if (!coords) return;
      const [recLat, recLng] = coords;

      if (recLat < 40 || recLat > 72) return;
      if (recLng < -180 || recLng > -110) return;

      const count = Number(rec.number_cwt_estimated ?? rec.estimated_number ?? 1);
      const loc = locationMap.get(rec.recovery_location_code);
      const locName = String(loc?.name ?? loc?.location_name ?? rec.recovery_location_code);
      const runYear = Number(rec.run_year ?? calYear);
      const key = `${rec.recovery_location_code}-${runYear}`;

      if (seen.has(key)) {
        seen.get(key)!.catchCount += count;
      } else {
        const pos: DateViewPosition = {
          lat: recLat, lng: recLng, catchCount: count,
          locationName: locName, locationCode: rec.recovery_location_code,
          runYear, isoWeek: recWeek, calYear,
        };
        seen.set(key, pos);
        positions.push(pos);
      }
    }

    if (tagCodes.size > 0) {
      // Step 3a: fetch recoveries by tag_code, filter to target week
      const tagCodeArray = Array.from(tagCodes);
      const BATCH_SIZE = 20;
      for (let i = 0; i < tagCodeArray.length; i += BATCH_SIZE) {
        const batch = tagCodeArray.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (tagCode) => {
          for (let page = 1; page <= 50; page++) {
            let res;
            try {
              res = await fetchRecoveries({ tag_code: tagCode, perpage: '500', page: String(page) });
            } catch { break; }
            const records = res.records ?? [];
            records.forEach(addRecovery);
            if (records.length < 500) break;
          }
        }));
      }
    } else {
      // Step 3b: no tag codes found — query /recovery directly by date.
      // This surfaces any ocean recoveries for the target week regardless of hatchery.
      // Useful when a hatchery has no RMIS release records with CWT tags.
      const month = date.getMonth() + 1;
      const day = date.getDate();
      try {
        for (let page = 1; page <= 10; page++) {
          const res = await fetchRecoveries({
            recovery_date_year: String(targetYear),
            recovery_date_month: String(month),
            recovery_date_day: String(day),
            perpage: '500',
            page: String(page),
          });
          const records = res.records ?? [];
          records.forEach(addRecovery);
          if (records.length < 500) break;
        }
      } catch { /* ignore */ }
    }

    return positions;
  } catch {
    return [];
  }
}

export async function fetchOceanRecoveryDatesForYear(year: number): Promise<Set<string>> {
  const records = await fetchOceanRecoveryRecordsForYear(year);
  const dates = new Set<string>();

  for (const rec of records) {
    const parts = recoveryDateParts(rec);
    if (!parts) continue;
    dates.add(`${parts.calYear}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`);
  }

  return dates;
}

/**
 * Fetch ocean CWT recovery positions for the ISO week containing `date`.
 * This goes directly to /recovery and never requires a hatchery release lookup.
 */
export async function fetchOceanRecoveriesForWeek(date: Date): Promise<DateViewPosition[]> {
  const locationMap = await getLocationMap();
  const targetYear = date.getFullYear();
  const targetWeek = isoWeekNumber(date);
  const records = await fetchOceanRecoveryRecordsForYear(targetYear);

  const positions: DateViewPosition[] = [];
  const seen = new Map<string, DateViewPosition>();

  for (const rec of records) {
    const parts = recoveryDateParts(rec);
    if (!parts || parts.calYear !== targetYear) continue;

    const recWeek = isoWeekNumber(parts.date);
    if (recWeek !== targetWeek) continue;

    const coords = resolveCoords(rec.recovery_location_code, locationMap);
    if (!coords) continue;
    const [recLat, recLng] = coords;
    if (!validRecoveryCoords(recLat, recLng)) continue;

    const count = recoveryCatchCount(rec);
    const locName = recoveryLocationName(rec, locationMap);
    const runYear = Number(rec.run_year ?? parts.calYear);
    const key = `${rec.recovery_location_code}-${runYear}`;

    if (seen.has(key)) {
      seen.get(key)!.catchCount += count;
    } else {
      const pos: DateViewPosition = {
        lat: recLat,
        lng: recLng,
        catchCount: count,
        locationName: locName,
        locationCode: rec.recovery_location_code,
        runYear,
        isoWeek: recWeek,
        calYear: parts.calYear,
      };
      seen.set(key, pos);
      positions.push(pos);
    }
  }

  return positions;
}

export async function fetchOceanRecoveriesForDate(date: Date): Promise<DateViewPosition[]> {
  return fetchOceanRecoveriesForWeek(date);
}
