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
}

export interface TideInfo {
  date: string;
  highTide: string;
  lowTide: string;
  sunrise: string;
  sunset: string;
}

// Alaska fishery locations with realistic coordinates
export const fisheryData: FishRelease[] = [
  // February 10, 2026
  { id: '1', species: 'Chinook Salmon', quantity: 1250, lat: 58.3019, lng: -134.4197, date: '2026-02-10', hatchery: 'Douglas Island Pink & Chum', releaseType: 'Hatchery', location: 'Juneau' },
  { id: '2', species: 'Sockeye Salmon', quantity: 890, lat: 58.4540, lng: -134.1740, date: '2026-02-10', hatchery: 'Macaulay Salmon', releaseType: 'Hatchery', location: 'North Juneau' },
  { id: '3', species: 'Coho Salmon', quantity: 2100, lat: 57.0531, lng: -135.3300, date: '2026-02-10', hatchery: 'Sitka Sound Science', releaseType: 'Hatchery', location: 'Sitka' },
  { id: '4', species: 'Pink Salmon', quantity: 3500, lat: 56.4708, lng: -132.3750, date: '2026-02-10', hatchery: 'Neets Bay', releaseType: 'Hatchery', location: 'Ketchikan' },
  { id: '5', species: 'Chinook Salmon', quantity: 650, lat: 57.7900, lng: -135.3100, date: '2026-02-10', hatchery: 'Hidden Falls', releaseType: 'Wild', location: 'Baranof Island' },
  
  // February 11, 2026
  { id: '6', species: 'Chinook Salmon', quantity: 1420, lat: 58.3019, lng: -134.4197, date: '2026-02-11', hatchery: 'Douglas Island Pink & Chum', releaseType: 'Hatchery', location: 'Juneau' },
  { id: '7', species: 'Sockeye Salmon', quantity: 1050, lat: 58.4540, lng: -134.1740, date: '2026-02-11', hatchery: 'Macaulay Salmon', releaseType: 'Hatchery', location: 'North Juneau' },
  { id: '8', species: 'Coho Salmon', quantity: 1890, lat: 57.0531, lng: -135.3300, date: '2026-02-11', hatchery: 'Sitka Sound Science', releaseType: 'Hatchery', location: 'Sitka' },
  { id: '9', species: 'Chum Salmon', quantity: 2800, lat: 55.3422, lng: -131.6461, date: '2026-02-11', hatchery: 'Kendrick Bay', releaseType: 'Hatchery', location: 'Prince of Wales' },
  { id: '10', species: 'Pink Salmon', quantity: 4200, lat: 56.4708, lng: -132.3750, date: '2026-02-11', hatchery: 'Neets Bay', releaseType: 'Hatchery', location: 'Ketchikan' },
  
  // February 12, 2026
  { id: '11', species: 'Chinook Salmon', quantity: 980, lat: 58.3019, lng: -134.4197, date: '2026-02-12', hatchery: 'Douglas Island Pink & Chum', releaseType: 'Hatchery', location: 'Juneau' },
  { id: '12', species: 'Sockeye Salmon', quantity: 1320, lat: 58.4540, lng: -134.1740, date: '2026-02-12', hatchery: 'Macaulay Salmon', releaseType: 'Hatchery', location: 'North Juneau' },
  { id: '13', species: 'Coho Salmon', quantity: 2450, lat: 57.0531, lng: -135.3300, date: '2026-02-12', hatchery: 'Sitka Sound Science', releaseType: 'Hatchery', location: 'Sitka' },
  { id: '14', species: 'Pink Salmon', quantity: 3100, lat: 56.4708, lng: -132.3750, date: '2026-02-12', hatchery: 'Neets Bay', releaseType: 'Hatchery', location: 'Ketchikan' },
  { id: '15', species: 'Chum Salmon', quantity: 1750, lat: 57.4500, lng: -133.5300, date: '2026-02-12', hatchery: 'Burnett Inlet', releaseType: 'Wild', location: 'Petersburg' },
  
  // February 13, 2026
  { id: '16', species: 'Chinook Salmon', quantity: 1580, lat: 58.3019, lng: -134.4197, date: '2026-02-13', hatchery: 'Douglas Island Pink & Chum', releaseType: 'Hatchery', location: 'Juneau' },
  { id: '17', species: 'Sockeye Salmon', quantity: 920, lat: 58.4540, lng: -134.1740, date: '2026-02-13', hatchery: 'Macaulay Salmon', releaseType: 'Hatchery', location: 'North Juneau' },
  { id: '18', species: 'Coho Salmon', quantity: 2680, lat: 57.0531, lng: -135.3300, date: '2026-02-13', hatchery: 'Sitka Sound Science', releaseType: 'Hatchery', location: 'Sitka' },
  { id: '19', species: 'Pink Salmon', quantity: 3900, lat: 56.4708, lng: -132.3750, date: '2026-02-13', hatchery: 'Neets Bay', releaseType: 'Hatchery', location: 'Ketchikan' },
  { id: '20', species: 'Chum Salmon', quantity: 2200, lat: 55.3422, lng: -131.6461, date: '2026-02-13', hatchery: 'Kendrick Bay', releaseType: 'Hatchery', location: 'Prince of Wales' },
  
  // February 14, 2026
  { id: '21', species: 'Chinook Salmon', quantity: 1100, lat: 58.3019, lng: -134.4197, date: '2026-02-14', hatchery: 'Douglas Island Pink & Chum', releaseType: 'Hatchery', location: 'Juneau' },
  { id: '22', species: 'Sockeye Salmon', quantity: 1450, lat: 58.4540, lng: -134.1740, date: '2026-02-14', hatchery: 'Macaulay Salmon', releaseType: 'Hatchery', location: 'North Juneau' },
  { id: '23', species: 'Coho Salmon', quantity: 1950, lat: 57.0531, lng: -135.3300, date: '2026-02-14', hatchery: 'Sitka Sound Science', releaseType: 'Hatchery', location: 'Sitka' },
  { id: '24', species: 'Pink Salmon', quantity: 4500, lat: 56.4708, lng: -132.3750, date: '2026-02-14', hatchery: 'Neets Bay', releaseType: 'Hatchery', location: 'Ketchikan' },
  { id: '25', species: 'Chinook Salmon', quantity: 780, lat: 57.7900, lng: -135.3100, date: '2026-02-14', hatchery: 'Hidden Falls', releaseType: 'Wild', location: 'Baranof Island' },
  
  // February 15, 2026
  { id: '26', species: 'Chinook Salmon', quantity: 1350, lat: 58.3019, lng: -134.4197, date: '2026-02-15', hatchery: 'Douglas Island Pink & Chum', releaseType: 'Hatchery', location: 'Juneau' },
  { id: '27', species: 'Sockeye Salmon', quantity: 1180, lat: 58.4540, lng: -134.1740, date: '2026-02-15', hatchery: 'Macaulay Salmon', releaseType: 'Hatchery', location: 'North Juneau' },
  { id: '28', species: 'Coho Salmon', quantity: 2300, lat: 57.0531, lng: -135.3300, date: '2026-02-15', hatchery: 'Sitka Sound Science', releaseType: 'Hatchery', location: 'Sitka' },
  { id: '29', species: 'Pink Salmon', quantity: 3700, lat: 56.4708, lng: -132.3750, date: '2026-02-15', hatchery: 'Neets Bay', releaseType: 'Hatchery', location: 'Ketchikan' },
  { id: '30', species: 'Chum Salmon', quantity: 2500, lat: 55.3422, lng: -131.6461, date: '2026-02-15', hatchery: 'Kendrick Bay', releaseType: 'Hatchery', location: 'Prince of Wales' },
  
  // February 16, 2026
  { id: '31', species: 'Chinook Salmon', quantity: 1620, lat: 58.3019, lng: -134.4197, date: '2026-02-16', hatchery: 'Douglas Island Pink & Chum', releaseType: 'Hatchery', location: 'Juneau' },
  { id: '32', species: 'Sockeye Salmon', quantity: 1090, lat: 58.4540, lng: -134.1740, date: '2026-02-16', hatchery: 'Macaulay Salmon', releaseType: 'Hatchery', location: 'North Juneau' },
  { id: '33', species: 'Coho Salmon', quantity: 2580, lat: 57.0531, lng: -135.3300, date: '2026-02-16', hatchery: 'Sitka Sound Science', releaseType: 'Hatchery', location: 'Sitka' },
  { id: '34', species: 'Pink Salmon', quantity: 4100, lat: 56.4708, lng: -132.3750, date: '2026-02-16', hatchery: 'Neets Bay', releaseType: 'Hatchery', location: 'Ketchikan' },
  { id: '35', species: 'Chum Salmon', quantity: 1900, lat: 57.4500, lng: -133.5300, date: '2026-02-16', hatchery: 'Burnett Inlet', releaseType: 'Wild', location: 'Petersburg' },
];

export const tideData: TideInfo[] = [
  { date: '2026-02-10', highTide: '3.2 ft at 6:45 AM', lowTide: '0.8 ft at 12:30 PM', sunrise: '8:42 AM', sunset: '5:18 PM' },
  { date: '2026-02-11', highTide: '3.5 ft at 7:20 AM', lowTide: '0.6 ft at 1:15 PM', sunrise: '8:40 AM', sunset: '5:20 PM' },
  { date: '2026-02-12', highTide: '3.8 ft at 8:00 AM', lowTide: '0.4 ft at 2:00 PM', sunrise: '8:38 AM', sunset: '5:22 PM' },
  { date: '2026-02-13', highTide: '4.1 ft at 8:35 AM', lowTide: '0.3 ft at 2:45 PM', sunrise: '8:36 AM', sunset: '5:24 PM' },
  { date: '2026-02-14', highTide: '4.3 ft at 9:15 AM', lowTide: '0.2 ft at 3:30 PM', sunrise: '8:34 AM', sunset: '5:26 PM' },
  { date: '2026-02-15', highTide: '4.0 ft at 9:50 AM', lowTide: '0.5 ft at 4:10 PM', sunrise: '8:32 AM', sunset: '5:28 PM' },
  { date: '2026-02-16', highTide: '3.7 ft at 10:30 AM', lowTide: '0.7 ft at 4:50 PM', sunrise: '8:30 AM', sunset: '5:30 PM' },
];

export const getAvailableDates = (): string[] => {
  return Array.from(new Set(fisheryData.map(f => f.date))).sort();
};

export const getAvailableSpecies = (): string[] => {
  return Array.from(new Set(fisheryData.map(f => f.species))).sort();
};

export const getAvailableHatcheries = (): string[] => {
  return Array.from(new Set(fisheryData.map(f => f.hatchery))).sort();
};

export const getDataForDate = (date: string): FishRelease[] => {
  return fisheryData.filter(f => f.date === date);
};

export const getTideForDate = (date: string): TideInfo | undefined => {
  return tideData.find(t => t.date === date);
};
