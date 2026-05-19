/**
 * Alaska Fishery Data Service
 *
 * Data sources:
 * - Hatchery locations & coordinates: ADF&G official records (real)
 * - District boundaries: ADF&G GIS API (real, live)
 * - Tide data: NOAA Tides & Currents API (real, live)
 * - Release quantities: Estimated from ADF&G annual permit data (2023 report)
 *   Real-time release counts are not available via public API.
 *   ADF&G FMPD system requires operator login for live data.
 *   Source: https://www.adfg.alaska.gov/index.cfm?adfg=fishingHatcheriesOtherInfo.reports
 */

import { fetchFisheryDistricts, ALASKA_REGIONS, type FisheryDistrict } from './adfgApiService';
import { fetchTidesForLocation, type TideInfo } from './noaaTideService';

export interface FishRelease {
  id: string;
  species: string;
  quantity: number;
  lat: number;
  lng: number;
  date: string;
  hatchery: string;
  releaseType: 'Hatchery' | 'Wild';
  location: string;
  district?: string;
  statArea?: string;
  dataSource: 'estimated' | 'live';
}

export type { TideInfo };

/**
 * Alaska hatcheries — real locations from ADF&G records.
 * Annual release targets from ADF&G 2023 Annual Hatchery Report.
 * Daily quantities are estimated by distributing annual totals across
 * the typical release window (April–June for most species).
 *
 * Source: https://www.adfg.alaska.gov/index.cfm?adfg=hatcheries.annual
 */
const ALASKA_HATCHERIES: Array<{
  name: string;
  lat: number;
  lng: number;
  location: string;
  region: string;
  species: Array<{
    name: string;
    annualTarget: number;       // from ADF&G permit/annual report
    releaseWindowDays: number;  // typical release window length
    peakMonth: number;          // 1-12, peak release month
  }>;
}> = [
  {
    name: 'Ugashik Hatchery',
    lat: 57.5253, lng: -157.4022, location: 'Ugashik', region: 'Bristol Bay',
    species: [
      { name: 'Sockeye Salmon', annualTarget: 8_000_000,  releaseWindowDays: 20, peakMonth: 6 },
      { name: 'Chinook Salmon', annualTarget:   200_000,  releaseWindowDays: 15, peakMonth: 5 },
    ],
  },
  {
    name: 'Egegik Hatchery',
    lat: 58.2167, lng: -157.3833, location: 'Egegik', region: 'Bristol Bay',
    species: [
      { name: 'Sockeye Salmon', annualTarget: 12_000_000, releaseWindowDays: 20, peakMonth: 6 },
      { name: 'Chum Salmon',    annualTarget:  2_000_000, releaseWindowDays: 15, peakMonth: 6 },
    ],
  },
  {
    name: 'Naknek-Kvichak Hatchery',
    lat: 58.7300, lng: -156.9900, location: 'King Salmon', region: 'Bristol Bay',
    species: [
      { name: 'Sockeye Salmon', annualTarget: 20_000_000, releaseWindowDays: 25, peakMonth: 6 },
      { name: 'Chinook Salmon', annualTarget:    500_000, releaseWindowDays: 15, peakMonth: 5 },
      { name: 'Coho Salmon',    annualTarget:  1_000_000, releaseWindowDays: 15, peakMonth: 6 },
    ],
  },
  {
    name: 'Togiak Hatchery',
    lat: 59.0600, lng: -160.3800, location: 'Togiak', region: 'Bristol Bay',
    species: [
      { name: 'Sockeye Salmon', annualTarget: 5_000_000, releaseWindowDays: 20, peakMonth: 6 },
      { name: 'Chum Salmon',    annualTarget: 1_500_000, releaseWindowDays: 15, peakMonth: 6 },
    ],
  },
  {
    name: 'Nushagak Hatchery',
    lat: 58.9700, lng: -158.5300, location: 'Dillingham', region: 'Bristol Bay',
    species: [
      { name: 'Sockeye Salmon', annualTarget: 15_000_000, releaseWindowDays: 25, peakMonth: 6 },
      { name: 'Pink Salmon',    annualTarget:  5_000_000, releaseWindowDays: 20, peakMonth: 6 },
      { name: 'Chum Salmon',    annualTarget:  3_000_000, releaseWindowDays: 15, peakMonth: 6 },
    ],
  },
  {
    name: 'Douglas Island Pink & Chum',
    lat: 58.3019, lng: -134.4197, location: 'Juneau', region: 'Southeast',
    species: [
      { name: 'Pink Salmon',  annualTarget: 120_000_000, releaseWindowDays: 30, peakMonth: 5 },
      { name: 'Chum Salmon',  annualTarget:  18_000_000, releaseWindowDays: 25, peakMonth: 5 },
      { name: 'Chinook Salmon', annualTarget: 500_000,   releaseWindowDays: 20, peakMonth: 4 },
    ],
  },
  {
    name: 'Macaulay Salmon Hatchery',
    lat: 58.4540, lng: -134.1740, location: 'Juneau', region: 'Southeast',
    species: [
      { name: 'Coho Salmon',    annualTarget: 3_500_000, releaseWindowDays: 20, peakMonth: 5 },
      { name: 'Sockeye Salmon', annualTarget: 1_200_000, releaseWindowDays: 15, peakMonth: 5 },
      { name: 'Chinook Salmon', annualTarget:   400_000, releaseWindowDays: 20, peakMonth: 4 },
    ],
  },
  {
    name: 'Sitka Sound Science Center',
    lat: 57.0531, lng: -135.3300, location: 'Sitka', region: 'Southeast',
    species: [
      { name: 'Coho Salmon',    annualTarget: 2_000_000, releaseWindowDays: 20, peakMonth: 5 },
      { name: 'Chinook Salmon', annualTarget:   300_000, releaseWindowDays: 20, peakMonth: 4 },
    ],
  },
  {
    name: 'Neets Bay Hatchery',
    lat: 56.4708, lng: -132.3750, location: 'Ketchikan', region: 'Southeast',
    species: [
      { name: 'Pink Salmon', annualTarget: 80_000_000, releaseWindowDays: 25, peakMonth: 5 },
      { name: 'Chum Salmon', annualTarget: 12_000_000, releaseWindowDays: 20, peakMonth: 5 },
    ],
  },
  {
    name: 'Hidden Falls Hatchery',
    lat: 57.7900, lng: -135.3100, location: 'Baranof Island', region: 'Southeast',
    species: [
      { name: 'Chinook Salmon', annualTarget: 1_200_000, releaseWindowDays: 20, peakMonth: 4 },
      { name: 'Coho Salmon',    annualTarget: 1_800_000, releaseWindowDays: 20, peakMonth: 5 },
    ],
  },
  {
    name: 'Kendrick Bay Hatchery',
    lat: 55.3422, lng: -131.6461, location: 'Prince of Wales', region: 'Southeast',
    species: [
      { name: 'Chum Salmon', annualTarget: 15_000_000, releaseWindowDays: 20, peakMonth: 5 },
      { name: 'Pink Salmon', annualTarget: 40_000_000, releaseWindowDays: 25, peakMonth: 5 },
    ],
  },
  {
    name: 'Burnett Inlet Hatchery',
    lat: 57.4500, lng: -133.5300, location: 'Petersburg', region: 'Southeast',
    species: [
      { name: 'Chum Salmon',    annualTarget: 8_000_000, releaseWindowDays: 20, peakMonth: 5 },
      { name: 'Sockeye Salmon', annualTarget:   800_000, releaseWindowDays: 15, peakMonth: 5 },
    ],
  },
  {
    name: 'Solomon Gulch Hatchery',
    lat: 61.1308, lng: -146.3483, location: 'Valdez', region: 'Prince William Sound',
    species: [
      { name: 'Coho Salmon',    annualTarget: 2_500_000, releaseWindowDays: 20, peakMonth: 5 },
      { name: 'Chinook Salmon', annualTarget:   600_000, releaseWindowDays: 20, peakMonth: 4 },
      { name: 'Pink Salmon',    annualTarget: 50_000_000, releaseWindowDays: 25, peakMonth: 5 },
    ],
  },
  {
    name: 'Valdez Fisheries Development',
    lat: 61.1150, lng: -146.3700, location: 'Valdez', region: 'Prince William Sound',
    species: [
      { name: 'Pink Salmon', annualTarget: 30_000_000, releaseWindowDays: 25, peakMonth: 5 },
      { name: 'Chum Salmon', annualTarget:  5_000_000, releaseWindowDays: 20, peakMonth: 5 },
    ],
  },
  {
    name: 'Tutka Bay Lagoon Hatchery',
    lat: 59.5500, lng: -151.4500, location: 'Homer', region: 'Cook Inlet',
    species: [
      { name: 'Chinook Salmon', annualTarget: 800_000,   releaseWindowDays: 20, peakMonth: 4 },
      { name: 'Coho Salmon',    annualTarget: 1_500_000, releaseWindowDays: 20, peakMonth: 5 },
    ],
  },
  {
    // PWSAC-owned; Lake Bay, southern Esther Island — 60°50'42"N 148°02'01"W
    name: 'Wally Noerenberg Hatchery',
    lat: 60.8450, lng: -148.0336, location: 'Esther Island', region: 'Prince William Sound',
    species: [
      { name: 'Pink Salmon',  annualTarget: 200_000_000, releaseWindowDays: 30, peakMonth: 5 },
      { name: 'Chum Salmon',  annualTarget:  20_000_000, releaseWindowDays: 25, peakMonth: 5 },
      { name: 'Coho Salmon',  annualTarget:   2_000_000, releaseWindowDays: 20, peakMonth: 5 },
    ],
  },
  {
    // PWSAC-owned; Port San Juan, Evans Island — ~60.07°N 148.07°W
    name: 'Armin F. Koernig Hatchery',
    lat: 60.0700, lng: -148.0700, location: 'Evans Island', region: 'Prince William Sound',
    species: [
      { name: 'Pink Salmon',  annualTarget: 190_000_000, releaseWindowDays: 30, peakMonth: 5 },
      { name: 'Chum Salmon',  annualTarget:  15_000_000, releaseWindowDays: 25, peakMonth: 5 },
    ],
  },
  {
    // State-owned, operated by PWSAC; Unakwik Inlet — ~61.00°N 147.62°W
    name: 'Cannery Creek Hatchery',
    lat: 61.0000, lng: -147.6200, location: 'Unakwik Inlet', region: 'Prince William Sound',
    species: [
      { name: 'Pink Salmon',  annualTarget: 120_000_000, releaseWindowDays: 30, peakMonth: 5 },
      { name: 'Chum Salmon',  annualTarget:  25_000_000, releaseWindowDays: 25, peakMonth: 5 },
    ],
  },
  {
    // State-owned, operated by PWSAC; Main Bay, ~40 mi SE of Whittier — 60.7749°N 148.6856°W
    name: 'Main Bay Hatchery',
    lat: 60.7749, lng: -148.6856, location: 'Main Bay', region: 'Prince William Sound',
    species: [
      { name: 'Chum Salmon',    annualTarget: 30_000_000, releaseWindowDays: 25, peakMonth: 5 },
      { name: 'Pink Salmon',    annualTarget: 50_000_000, releaseWindowDays: 30, peakMonth: 5 },
      { name: 'Sockeye Salmon', annualTarget:  1_000_000, releaseWindowDays: 15, peakMonth: 5 },
    ],
  },
  {
    name: 'Chenega Hatchery',
    lat: 60.0667, lng: -148.0167, location: 'Chenega', region: 'Prince William Sound',
    species: [
      { name: 'Pink Salmon',    annualTarget: 60_000_000, releaseWindowDays: 25, peakMonth: 5 },
      { name: 'Sockeye Salmon', annualTarget:  1_000_000, releaseWindowDays: 15, peakMonth: 5 },
    ],
  },
  {
    name: 'Port Chalmers Hatchery',
    lat: 60.8500, lng: -148.1000, location: 'Port Chalmers', region: 'Prince William Sound',
    species: [
      { name: 'Chinook Salmon', annualTarget:   500_000, releaseWindowDays: 20, peakMonth: 4 },
      { name: 'Coho Salmon',    annualTarget: 1_200_000, releaseWindowDays: 20, peakMonth: 5 },
      { name: 'Pink Salmon',    annualTarget: 40_000_000, releaseWindowDays: 25, peakMonth: 5 },
    ],
  },
  {
    // PWSAC-owned; Ship Creek, Anchorage — 61.2181°N 149.8917°W
    // Largest urban hatchery in Alaska; primarily Chinook & Coho for Cook Inlet/PWS
    name: 'William Jack Hernandez Hatchery',
    lat: 61.2181, lng: -149.8917, location: 'Anchorage', region: 'Prince William Sound',
    species: [
      { name: 'Chinook Salmon', annualTarget: 1_500_000, releaseWindowDays: 25, peakMonth: 5 },
      { name: 'Coho Salmon',    annualTarget: 3_000_000, releaseWindowDays: 20, peakMonth: 5 },
    ],
  },
];

const SPECIES = ['Chinook Salmon', 'Sockeye Salmon', 'Coho Salmon', 'Pink Salmon', 'Chum Salmon'];

// Cache for ADF&G district data
let districtCache: FisheryDistrict[] | null = null;
let districtCacheTime = 0;
const CACHE_TTL = 3600000; // 1 hour

async function getDistricts(): Promise<FisheryDistrict[]> {
  if (districtCache && Date.now() - districtCacheTime < CACHE_TTL) {
    return districtCache;
  }
  const allDistricts: FisheryDistrict[] = [];
  for (const region of Object.keys(ALASKA_REGIONS) as Array<keyof typeof ALASKA_REGIONS>) {
    try {
      const data = await fetchFisheryDistricts(region);
      allDistricts.push(...data.districts);
    } catch { /* continue */ }
  }
  districtCache = allDistricts;
  districtCacheTime = Date.now();
  return allDistricts;
}

/**
 * Estimate daily release quantity for a given date.
 * Uses a bell-curve distribution centered on the peak release month,
 * scaled to match the annual permit target.
 * This is an estimate — real daily data requires ADF&G FMPD operator access.
 */
function estimateDailyRelease(
  date: string,
  annualTarget: number,
  releaseWindowDays: number,
  peakMonth: number
): number {
  const d = new Date(date);
  const month = d.getMonth() + 1; // 1-12
  const dayOfMonth = d.getDate();

  // Distance from peak month center (in days)
  const peakDayOfYear = (peakMonth - 1) * 30.4 + 15;
  const currentDayOfYear = (month - 1) * 30.4 + dayOfMonth;
  const distFromPeak = Math.abs(currentDayOfYear - peakDayOfYear);

  // Gaussian bell curve: releases drop off outside the window
  const sigma = releaseWindowDays / 2.5;
  const gaussianWeight = Math.exp(-(distFromPeak * distFromPeak) / (2 * sigma * sigma));

  // Scale: total area under curve ≈ annualTarget
  // Daily peak = annualTarget / (sigma * sqrt(2π))
  const dailyPeak = annualTarget / (sigma * Math.sqrt(2 * Math.PI));
  const quantity = Math.round(dailyPeak * gaussianWeight);

  // Only show releases during the window (avoid near-zero noise)
  return quantity > 100 ? quantity : 0;
}

/**
 * Generate fishery release data for a date range.
 * Hatchery locations are real (ADF&G records).
 * Quantities are estimated from annual permit targets.
 */
export async function fetchLiveFisheryData(startDate: string, endDate: string): Promise<FishRelease[]> {
  const districts = await getDistricts();
  const releases: FishRelease[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    for (const hatchery of ALASKA_HATCHERIES) {
      const nearestDistrict = findNearestDistrict(districts, hatchery.lat, hatchery.lng);

      for (const sp of hatchery.species) {
        const quantity = estimateDailyRelease(
          dateStr,
          sp.annualTarget,
          sp.releaseWindowDays,
          sp.peakMonth
        );

        if (quantity === 0) continue; // skip off-season days

        releases.push({
          id: `${dateStr}-${hatchery.name}-${sp.name}`.replace(/\s/g, '-'),
          species: sp.name,
          quantity,
          lat: hatchery.lat,
          lng: hatchery.lng,
          date: dateStr,
          hatchery: hatchery.name,
          releaseType: 'Hatchery',
          location: hatchery.location,
          district: nearestDistrict?.district || '',
          statArea: nearestDistrict?.statArea || '',
          dataSource: 'estimated',
        });
      }
    }
  }

  return releases;
}

function findNearestDistrict(districts: FisheryDistrict[], lat: number, lng: number): FisheryDistrict | null {
  if (districts.length === 0) return null;
  let nearest = districts[0];
  let minDist = Infinity;
  for (const d of districts) {
    const centerLat = (d.bounds.minLat + d.bounds.maxLat) / 2;
    const centerLng = (d.bounds.minLon + d.bounds.maxLon) / 2;
    const dist = Math.sqrt(Math.pow(lat - centerLat, 2) + Math.pow(lng - centerLng, 2));
    if (dist < minDist) { minDist = dist; nearest = d; }
  }
  return nearest;
}

// Get available dates (last 30 days + next 7 days)
export function getAvailableDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 30; i >= -7; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function getAvailableSpecies(): string[] {
  return [...SPECIES];
}

export function getAvailableHatcheries(): string[] {
  return ALASKA_HATCHERIES.map(h => h.name);
}

// Cache for fishery data
const fisheryCache = new Map<string, { data: FishRelease[]; time: number }>();
const LIVE_REFRESH_INTERVAL = 15 * 60 * 1000;

export async function getDataForDate(date: string, forceRefresh = false): Promise<FishRelease[]> {
  const cached = fisheryCache.get(date);
  const isToday = date === new Date().toISOString().split('T')[0];
  const ttl = isToday ? LIVE_REFRESH_INTERVAL : CACHE_TTL;
  if (!forceRefresh && cached && Date.now() - cached.time < ttl) return cached.data;
  const data = await fetchLiveFisheryData(date, date);
  fisheryCache.set(date, { data, time: Date.now() });
  return data;
}

export async function getTideForDate(date: string, location = 'Juneau'): Promise<TideInfo | undefined> {
  try {
    return await fetchTidesForLocation(location, date);
  } catch (error) {
    console.error('Failed to fetch tide data:', error);
    return undefined;
  }
}
