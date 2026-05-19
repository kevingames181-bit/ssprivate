import type { FishRelease } from '../services/fisheryDataService';
import { getAvailableHatcheries } from '../services/fisheryDataService';
import { Icon } from './Icon';

interface StatsPanelProps {
  data: FishRelease[];
}

export const StatsPanel = ({ data }: StatsPanelProps) => {
  const totalReleases = data.reduce((sum, release) => sum + release.quantity, 0);
  
  const speciesBreakdown = data.reduce((acc, release) => {
    acc[release.species] = (acc[release.species] || 0) + release.quantity;
    return acc;
  }, {} as Record<string, number>);

  // Active hatcheries = unique hatcheries in current filtered data
  // Total hatcheries = all known hatcheries from live data source
  const activeHatcheries = new Set(data.map(r => r.hatchery));
  const totalKnownHatcheries = getAvailableHatcheries().length;
  const locationCount = new Set(data.map(r => r.location)).size;

  const getSpeciesColor = (species: string): string => {
    const colors: Record<string, string> = {
      'Chinook Salmon': '#00bfff',
      'Sockeye Salmon': '#00e5ff',
      'Coho Salmon': '#0088cc',
      'Pink Salmon': '#0066cc',
      'Chum Salmon': '#00aaff'
    };
    return colors[species] || '#64748b';
  };

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <Icon name="barChart" size={24} />
        <h3>Daily Statistics</h3>
      </div>
      
      <div className="stat-card">
        <div className="stat-value">{totalReleases.toLocaleString()}</div>
        <div className="stat-label">Total Fish Released</div>
      </div>

      <div className="stat-card">
        <div className="stat-value">{data.length}</div>
        <div className="stat-label">Release Events</div>
      </div>

      <div className="stat-card">
        <div className="stat-value">{activeHatcheries.size}<span className="stat-total">/{totalKnownHatcheries}</span></div>
        <div className="stat-label">Active Hatcheries</div>
      </div>

      <div className="stat-card">
        <div className="stat-value">{locationCount}</div>
        <div className="stat-label">Locations</div>
      </div>

      <div className="species-breakdown">
        <h4>Species Breakdown</h4>
        {Object.entries(speciesBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([species, count]) => (
            <div key={species} className="species-stat">
              <div className="species-info">
                <span 
                  className="species-dot" 
                  style={{ backgroundColor: getSpeciesColor(species) }}
                />
                <span className="species-name">{species}</span>
              </div>
              <span className="species-count">{count.toLocaleString()}</span>
            </div>
          ))}
      </div>

      <div className="data-source-note">
        <span className="data-source-icon">ℹ️</span>
        <div>
          <div className="data-source-title">Data Sources</div>
          <div className="data-source-detail">Locations &amp; districts: ADF&amp;G GIS (live)</div>
          <div className="data-source-detail">Quantities: est. from 2023 permit data</div>
          <div className="data-source-detail">Tides: NOAA API (live)</div>
        </div>
      </div>
    </div>
  );
};
