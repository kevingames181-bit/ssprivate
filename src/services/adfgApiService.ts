/**
 * Alaska Department of Fish & Game (ADF&G) GIS API Service
 * 
 * Official API: https://gis.adfg.alaska.gov/mapping/rest/services
 * Documentation: Production-ready ArcGIS REST API
 * 
 * This service fetches real fishery data from ADF&G's public GIS services
 */

// ADF&G API Base URLs
const ADFG_BASE_URL = 'https://gis.adfg.alaska.gov/mapping/rest/services';

// Service endpoints
const SERVICES = {
  COOK_INLET_SALMON: `${ADFG_BASE_URL}/CF_public/CookInlet_5AAC_21_200/MapServer`,
  BRISTOL_BAY_SALMON: `${ADFG_BASE_URL}/CF_public/BristolBaySalmon5AAC_06_200/MapServer/8`, // layer 8 = Districts polygons
  SOUTHEAST_SALMON: `${ADFG_BASE_URL}/CF_public/SoutheastSalmon5AAC33_200/MapServer`,
  GROUNDFISH: `${ADFG_BASE_URL}/CF_public/Groundfish/MapServer`,
  AQUATIC_FARMING: `${ADFG_BASE_URL}/CF_public/Aquatic_Farming_Operations/MapServer`,
  SUBSISTENCE: `${ADFG_BASE_URL}/Hosted/Subsistence_Boundaries/FeatureServer`,
};

// Alaska regions with their corresponding services
export const ALASKA_REGIONS = {
  COOK_INLET: {
    name: 'Cook Inlet',
    service: SERVICES.COOK_INLET_SALMON,
    bounds: { minLat: 60.0, maxLat: 62.5, minLon: -154.0, maxLon: -148.0 }
  },
  BRISTOL_BAY: {
    name: 'Bristol Bay',
    service: SERVICES.BRISTOL_BAY_SALMON,
    bounds: { minLat: 57.0, maxLat: 60.0, minLon: -162.0, maxLon: -156.0 }
  },
  SOUTHEAST: {
    name: 'Southeast Alaska',
    service: SERVICES.SOUTHEAST_SALMON,
    bounds: { minLat: 54.0, maxLat: 60.0, minLon: -138.0, maxLon: -130.0 }
  },
  KODIAK: {
    name: 'Kodiak',
    service: SERVICES.GROUNDFISH,
    bounds: { minLat: 56.0, maxLat: 58.5, minLon: -155.0, maxLon: -151.0 }
  }
};

export interface FisheryDistrict {
  id: string;
  name: string;
  district: string;
  subdistrict?: string;
  section?: string;
  statArea: string;
  geometry: any;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export interface FisheryData {
  region: string;
  districts: FisheryDistrict[];
  lastUpdated: string;
  source: string;
}

/**
 * Fetch fishery districts from ADF&G API
 */
export async function fetchFisheryDistricts(region: keyof typeof ALASKA_REGIONS): Promise<FisheryData> {
  const regionData = ALASKA_REGIONS[region];
  
  try {
    // Query all features from the service
    const queryUrl = `${regionData.service}/query`;
    const params = new URLSearchParams({
      where: '1=1', // Get all features
      outFields: '*', // Get all fields
      returnGeometry: 'true',
      f: 'json',
      outSR: '4326' // WGS84 coordinate system
    });

    const response = await fetch(`${queryUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`ADF&G API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`ADF&G API error: ${data.error.message}`);
    }

    // Transform ADF&G data to our format
    const districts: FisheryDistrict[] = data.features?.map((feature: any) => {
      const attrs = feature.attributes;
      const geom = feature.geometry;
      
      // Calculate bounds from geometry
      let bounds = regionData.bounds;
      if (geom && geom.rings) {
        const allCoords = geom.rings.flat();
        const lons = allCoords.filter((_: any, i: number) => i % 2 === 0);
        const lats = allCoords.filter((_: any, i: number) => i % 2 === 1);
        bounds = {
          minLon: Math.min(...lons),
          maxLon: Math.max(...lons),
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats)
        };
      }

      return {
        id: attrs.OBJECTID || attrs.FID || `${region}-${Math.random()}`,
        name: attrs.NAME || attrs.DISTRICT_NAME || attrs.DISTRICT_NAME || attrs.STAT_AREA || 'Unknown',
        district: attrs.DISTRICT || attrs.DISTRICT_CODE || attrs.DIST_NAME || '',
        subdistrict: attrs.SUBDISTRICT || attrs.SUBDIST || '',
        section: attrs.SECTION || attrs.SECT_NAME || '',
        statArea: attrs.STAT_AREA || attrs.STATISTICAL_AREA || '',
        geometry: geom,
        bounds
      };
    }) || [];

    return {
      region: regionData.name,
      districts,
      lastUpdated: new Date().toISOString(),
      source: 'Alaska Department of Fish & Game GIS API'
    };
  } catch (error) {
    console.error(`Error fetching ${region} fishery data:`, error);
    throw error;
  }
}

/**
 * Fetch all Alaska fishery regions
 */
export async function fetchAllFisheryData(): Promise<Record<string, FisheryData>> {
  const results: Record<string, FisheryData> = {};
  
  for (const [key, _] of Object.entries(ALASKA_REGIONS)) {
    try {
      results[key] = await fetchFisheryDistricts(key as keyof typeof ALASKA_REGIONS);
    } catch (error) {
      console.error(`Failed to fetch ${key}:`, error);
      // Continue with other regions even if one fails
    }
  }
  
  return results;
}

/**
 * Get fishery statistics for a specific region
 */
export async function getFisheryStats(region: keyof typeof ALASKA_REGIONS) {
  const data = await fetchFisheryDistricts(region);
  
  return {
    region: data.region,
    totalDistricts: data.districts.length,
    districts: data.districts.map(d => d.district).filter(Boolean),
    subdistricts: data.districts.map(d => d.subdistrict).filter(Boolean),
    sections: data.districts.map(d => d.section).filter(Boolean),
    statAreas: data.districts.map(d => d.statArea).filter(Boolean),
    lastUpdated: data.lastUpdated,
    source: data.source
  };
}

/**
 * Search for a specific district by name
 */
export async function searchDistrict(districtName: string): Promise<FisheryDistrict | null> {
  const allData = await fetchAllFisheryData();
  
  for (const regionData of Object.values(allData)) {
    const found = regionData.districts.find(d => 
      d.name.toLowerCase().includes(districtName.toLowerCase()) ||
      d.district.toLowerCase().includes(districtName.toLowerCase())
    );
    
    if (found) {
      return found;
    }
  }
  
  return null;
}

/**
 * Get districts within a geographic bounding box
 */
export async function getDistrictsInBounds(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): Promise<FisheryDistrict[]> {
  const allData = await fetchAllFisheryData();
  const results: FisheryDistrict[] = [];
  
  for (const regionData of Object.values(allData)) {
    const inBounds = regionData.districts.filter(d => {
      const b = d.bounds;
      return (
        b.minLat <= maxLat &&
        b.maxLat >= minLat &&
        b.minLon <= maxLon &&
        b.maxLon >= minLon
      );
    });
    results.push(...inBounds);
  }
  
  return results;
}

export default {
  fetchFisheryDistricts,
  fetchAllFisheryData,
  getFisheryStats,
  searchDistrict,
  getDistrictsInBounds,
  ALASKA_REGIONS,
  SERVICES
};
