/**
 * NOAA Tides & Currents API Service
 * Free public API - no key required
 * https://api.tidesandcurrents.noaa.gov/api/prod/
 */

const NOAA_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

// Alaska NOAA tide stations
export const ALASKA_TIDE_STATIONS: Record<string, { id: string; name: string }> = {
  Juneau: { id: '9452210', name: 'Juneau, AK' },
  Sitka: { id: '9451600', name: 'Sitka, AK' },
  Ketchikan: { id: '9450460', name: 'Ketchikan, AK' },
  Kodiak: { id: '9457292', name: 'Kodiak, AK' },
  Homer: { id: '9455920', name: 'Homer, AK' },
  Anchorage: { id: '9455920', name: 'Anchorage, AK' },
  Petersburg: { id: '9451054', name: 'Petersburg, AK' },
  Wrangell: { id: '9451600', name: 'Wrangell, AK' },
};

export interface TideInfo {
  date: string;
  highTide: string;
  lowTide: string;
  sunrise: string;
  sunset: string;
  station: string;
}

export interface TidePrediction {
  t: string; // time
  v: string; // value (feet)
  type: 'H' | 'L';
}

export async function fetchTidesForDate(stationId: string, date: string): Promise<TideInfo> {
  const formattedDate = date.replace(/-/g, '');

  const params = new URLSearchParams({
    begin_date: formattedDate,
    end_date: formattedDate,
    station: stationId,
    product: 'predictions',
    datum: 'MLLW',
    time_zone: 'lst_ldt',
    interval: 'hilo',
    units: 'english',
    application: 'SeaScope_Alaska',
    format: 'json',
  });

  const response = await fetch(`${NOAA_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`NOAA API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`NOAA API error: ${data.error.message}`);
  }

  const predictions: TidePrediction[] = data.predictions || [];
  const highs = predictions.filter(p => p.type === 'H');
  const lows = predictions.filter(p => p.type === 'L');

  const firstHigh = highs[0];
  const firstLow = lows[0];

  // sunrise/sunset reserved for future NOAA astronomy endpoint integration

  return {
    date,
    highTide: firstHigh ? `${parseFloat(firstHigh.v).toFixed(1)} ft at ${formatTime(firstHigh.t)}` : 'N/A',
    lowTide: firstLow ? `${parseFloat(firstLow.v).toFixed(1)} ft at ${formatTime(firstLow.t)}` : 'N/A',
    sunrise: 'See NOAA',
    sunset: 'See NOAA',
    station: stationId,
  };
}

export async function fetchTidesForLocation(location: string, date: string): Promise<TideInfo> {
  const station = ALASKA_TIDE_STATIONS[location] || ALASKA_TIDE_STATIONS['Juneau'];
  return fetchTidesForDate(station.id, date);
}

function formatTime(dateTimeStr: string): string {
  // NOAA returns "YYYY-MM-DD HH:MM"
  const parts = dateTimeStr.split(' ');
  if (parts.length < 2) return dateTimeStr;
  const [hours, minutes] = parts[1].split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export async function fetchTidesRange(stationId: string, startDate: string, endDate: string): Promise<TidePrediction[]> {
  const params = new URLSearchParams({
    begin_date: startDate.replace(/-/g, ''),
    end_date: endDate.replace(/-/g, ''),
    station: stationId,
    product: 'predictions',
    datum: 'MLLW',
    time_zone: 'lst_ldt',
    interval: 'hilo',
    units: 'english',
    application: 'SeaScope_Alaska',
    format: 'json',
  });

  const response = await fetch(`${NOAA_BASE}?${params}`);
  if (!response.ok) throw new Error(`NOAA API error: ${response.statusText}`);

  const data = await response.json();
  if (data.error) throw new Error(`NOAA API error: ${data.error.message}`);

  return data.predictions || [];
}
