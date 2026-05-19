import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Icon } from '../components/Icon';
import { fetchAllFisheryData, type FisheryData } from '../services/adfgApiService';
import { getDataForDate, type FishRelease } from '../services/fisheryDataService';
import { fetchRecoveries, fetchReleases, aggregateRecoveriesBySpecies, aggregateReleasesByYear } from '../services/rmisApiService';
import { Download, Share2, Search, Filter, X } from 'lucide-react';
import '../styles/n8n-trends.css';

export const TrendsPage = () => {
  const [adfgData, setAdfgData] = useState<Record<string, FisheryData> | null>(null);
  const [liveReleases, setLiveReleases] = useState<FishRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regionStats, setRegionStats] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // RMIS data
  const [rmisRecBySpecies, setRmisRecBySpecies] = useState<{ species: string; count: number; estimated: number }[]>([]);
  const [rmisRelByYear, setRmisRelByYear] = useState<{ year: number; total: number; cwt: number }[]>([]);
  const [rmisLoading, setRmisLoading] = useState(false);

  // Fetch real ADF&G data
  useEffect(() => {
    async function loadData() {
      try {
        // Load ADF&G district data
        const data = await fetchAllFisheryData();
        setAdfgData(data);
        const stats = Object.entries(data).map(([key, regionData]) => ({
          region: regionData.region,
          districts: regionData.districts.length,
          key
        }));
        setRegionStats(stats);

        // Load live release data for last 30 days
        const today = new Date();
        const releases: FishRelease[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const dayData = await getDataForDate(dateStr);
          releases.push(...dayData);
        }
        setLiveReleases(releases);
      } catch (error) {
        console.error('Failed to load data:', error);
        setError('Failed to load fishery data. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Fetch RMIS data for trends
  useEffect(() => {
    async function loadRmisData() {
      setRmisLoading(true);
      try {
        const [recRes, relRes] = await Promise.allSettled([
          fetchRecoveries({ limit: '200' }),
          fetchReleases({ limit: '200' }),
        ]);
        if (recRes.status === 'fulfilled') {
          setRmisRecBySpecies(aggregateRecoveriesBySpecies(recRes.value.records ?? []));
        }
        if (relRes.status === 'fulfilled') {
          setRmisRelByYear(aggregateReleasesByYear(relRes.value.records ?? []));
        }
      } catch (e) {
        console.warn('Tag recovery data unavailable:', e);
      } finally {
        setRmisLoading(false);
      }
    }
    loadRmisData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown')) setShowFilterMenu(false);
      if (!target.closest('.export-dropdown')) setShowExportMenu(false);
      if (!target.closest('.share-dropdown')) setShowShareMenu(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const aggregateByDate = () => {
    const dateMap = new Map<string, { total: number; species: Record<string, number> }>();
    
    liveReleases.forEach(release => {
      // Filter by search query
      if (searchQuery && !release.species.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !release.hatchery.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }
      
      // Filter by selected species
      if (selectedSpecies.length > 0 && !selectedSpecies.includes(release.species)) {
        return;
      }
      
      if (!dateMap.has(release.date)) {
        dateMap.set(release.date, { total: 0, species: {} });
      }
      const entry = dateMap.get(release.date)!;
      entry.total += release.quantity;
      entry.species[release.species] = (entry.species[release.species] || 0) + release.quantity;
    });

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        total: data.total,
        ...data.species
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const aggregateBySpecies = () => {
    const speciesMap = new Map<string, number>();
    
    liveReleases.forEach(release => {
      // Filter by search query
      if (searchQuery && !release.species.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !release.hatchery.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }
      
      // Filter by selected species
      if (selectedSpecies.length > 0 && !selectedSpecies.includes(release.species)) {
        return;
      }
      
      speciesMap.set(release.species, (speciesMap.get(release.species) || 0) + release.quantity);
    });

    return Array.from(speciesMap.entries())
      .map(([species, quantity]) => ({ species, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  };

  // Export functions
  const exportToCSV = () => {
    const csvData = liveReleases.map(item => 
      `${item.date},${item.species},${item.hatchery},${item.quantity}`
    ).join('\n');
    
    const header = 'Date,Species,Hatchery,Quantity\n';
    const blob = new Blob([header + csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seascope-trends-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const exportToJSON = () => {
    const jsonData = JSON.stringify(liveReleases, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seascope-trends-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // Share functions
  const shareViaEmail = () => {
    const subject = 'SeaScope Trends Data';
    const body = `Check out the latest fishery trends data from SeaScope Alaska:\n\n${window.location.href}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShowShareMenu(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setShowShareMenu(false);
  };

  const toggleSpeciesFilter = (species: string) => {
    setSelectedSpecies(prev => 
      prev.includes(species) 
        ? prev.filter(s => s !== species)
        : [...prev, species]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedSpecies([]);
  };

  const lineData = aggregateByDate();
  const barData = aggregateBySpecies();

  const speciesColors: Record<string, string> = {
    'Chinook Salmon': '#FF6B6B',
    'Sockeye Salmon': '#4ECDC4',
    'Coho Salmon': '#45B7D1',
    'Pink Salmon': '#FFA07A',
    'Chum Salmon': '#98D8C8'
  };

  const species = Object.keys(speciesColors);

  return (
    <div className="trends-page">
      <div className="trends-hero-banner">
        <img 
          src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1600&q=80" 
          alt="Alaska fishing harbor" 
          className="trends-hero-image"
        />
        <div className="trends-hero-overlay"></div>
      </div>
      <div className="page-header">
        <div className="page-title-section">
          <div className="page-title-with-icon">
            <Icon name="chart" size={32} />
            <h1>Trends & Analytics</h1>
          </div>
          <p>View historical trends, peak releases, and predicted patterns</p>
          {adfgData && (
            <div className="adfg-data-badge">
              <Icon name="check" size={16} />
              <span>Live ADF&G Data: {Object.keys(adfgData).length} regions</span>
            </div>
          )}
        </div>

        {/* Search and Actions Bar */}
        <div className="trends-toolbar">
          <div className="search-bar-trends">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search species, hatchery..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>

          <div className="trends-actions">
            <div className="filter-dropdown">
              <button 
                className="action-btn"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
              >
                <Filter size={18} />
                <span>Filter</span>
              </button>
              {showFilterMenu && (
                <div className="filter-menu">
                  <div className="filter-header">Filter by Species</div>
                  {species.map(sp => (
                    <label key={sp} className="filter-option">
                      <input
                        type="checkbox"
                        checked={selectedSpecies.includes(sp)}
                        onChange={() => toggleSpeciesFilter(sp)}
                      />
                      <span>{sp}</span>
                    </label>
                  ))}
                  {selectedSpecies.length > 0 && (
                    <button className="clear-filters-btn" onClick={clearFilters}>
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="export-dropdown">
              <button 
                className="action-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                <Download size={18} />
                <span>Export</span>
              </button>
              {showExportMenu && (
                <div className="export-menu">
                  <button onClick={exportToCSV}>
                    <Icon name="fileText" size={16} />
                    <span>Export as CSV</span>
                  </button>
                  <button onClick={exportToJSON}>
                    <Icon name="fileText" size={16} />
                    <span>Export as JSON</span>
                  </button>
                </div>
              )}
            </div>

            <div className="share-dropdown">
              <button className="action-btn" onClick={() => setShowShareMenu(!showShareMenu)}>
                <Share2 size={18} />
                <span>Share</span>
              </button>
              {showShareMenu && (
                <div className="share-menu">
                  <button onClick={copyLink}>
                    <Icon name="share" size={16} />
                    <span>Copy Link</span>
                  </button>
                  <button onClick={shareViaEmail}>
                    <Icon name="mail" size={16} />
                    <span>Share via Email</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-banner">
          <Icon name="loader" size={20} />
          <span>Loading Alaska Department of Fish & Game data...</span>
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <Icon name="alertTriangle" size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="trends-content">
        {/* ADF&G Real Data Section */}
        {adfgData && (
          <section className="chart-section">
            <div className="chart-card">
              <h2>ADF&G Fishery Districts by Region</h2>
              <p className="chart-description">Real-time data from Alaska Department of Fish & Game</p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={regionStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1976d2" />
                  <XAxis dataKey="region" stroke="#90caf9" />
                  <YAxis stroke="#90caf9" />
                  <Tooltip 
                    contentStyle={{ background: '#132f4c', border: '1px solid #1976d2', borderRadius: '8px' }}
                    labelStyle={{ color: '#90caf9' }}
                  />
                  <Legend />
                  <Bar dataKey="districts" fill="#00d4aa" name="Total Districts" />
                </BarChart>
              </ResponsiveContainer>
              <div className="data-source-note">
                <Icon name="info" size={16} />
                <span>Source: {adfgData[Object.keys(adfgData)[0]]?.source}</span>
              </div>
            </div>
          </section>
        )}

        {/* Tag Recovery Charts */}
        {(rmisRecBySpecies.length > 0 || rmisRelByYear.length > 0) && (
          <section className="chart-section">
            <div className="chart-card">
              <h2>Tag Recoveries by Species</h2>
              <p className="chart-description">Coded wire tag recovery records by species</p>
              {rmisLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#90caf9' }}>Loading recovery data…</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={rmisRecBySpecies}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1976d2" />
                    <XAxis dataKey="species" stroke="#90caf9" />
                    <YAxis stroke="#90caf9" />
                    <Tooltip contentStyle={{ background: '#132f4c', border: '1px solid #1976d2', borderRadius: '8px' }} labelStyle={{ color: '#90caf9' }} />
                    <Legend />
                    <Bar dataKey="count" fill="#00d4aa" name="Recovery Records" />
                    <Bar dataKey="estimated" fill="#64b5f6" name="Estimated Fish" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="data-source-note">
                <Icon name="info" size={16} />
                <span>Pacific salmon mark recovery data</span>
              </div>
            </div>
          </section>
        )}

        {rmisRelByYear.length > 0 && (
          <section className="chart-section">
            <div className="chart-card">
              <h2>Releases by Brood Year</h2>
              <p className="chart-description">Total releases and tagged fish by brood year</p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={rmisRelByYear}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1976d2" />
                  <XAxis dataKey="year" stroke="#90caf9" />
                  <YAxis stroke="#90caf9" tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : String(v)} />
                  <Tooltip contentStyle={{ background: '#132f4c', border: '1px solid #1976d2', borderRadius: '8px' }} labelStyle={{ color: '#90caf9' }} formatter={(v: number) => v.toLocaleString()} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#00d4aa" strokeWidth={2} name="Total Released" />
                  <Line type="monotone" dataKey="cwt" stroke="#64b5f6" strokeWidth={2} name="Tagged Fish" />
                </LineChart>
              </ResponsiveContainer>
              <div className="data-source-note">
                <Icon name="info" size={16} />
                <span>Pacific salmon release and tagging data</span>
              </div>
            </div>
          </section>
        )}
        <section className="chart-section">
          <div className="chart-card">
            <h2>Daily Release Trends</h2>
            <p className="chart-description">Total fish releases over time with species breakdown</p>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1976d2" />
                <XAxis dataKey="date" stroke="#90caf9" />
                <YAxis stroke="#90caf9" />
                <Tooltip 
                  contentStyle={{ background: '#132f4c', border: '1px solid #1976d2', borderRadius: '8px' }}
                  labelStyle={{ color: '#90caf9' }}
                />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#fff" strokeWidth={3} name="Total Releases" />
                {species.map((sp) => (
                  <Line key={sp} type="monotone" dataKey={sp} stroke={speciesColors[sp]} strokeWidth={2} name={sp} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-section">
          <div className="chart-card">
            <h2>Species Breakdown</h2>
            <p className="chart-description">Total releases by species across all dates</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1976d2" />
                <XAxis dataKey="species" stroke="#90caf9" />
                <YAxis stroke="#90caf9" />
                <Tooltip 
                  contentStyle={{ background: '#132f4c', border: '1px solid #1976d2', borderRadius: '8px' }}
                  labelStyle={{ color: '#90caf9' }}
                />
                <Legend />
                <Bar dataKey="quantity" fill="#64b5f6" name="Total Quantity" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="insights-section">
          <h2>Key Insights</h2>          <div className="insights-grid">
            <div className="insight-card">
              <div className="insight-icon">
                <Icon name="trendingUp" size={40} />
              </div>
              <h3>Peak Release Day</h3>
              <p>
                {(() => {
                  const byDate = aggregateByDate();
                  if (byDate.length === 0) return 'No data available';
                  const peak = byDate.reduce((a, b) => a.total > b.total ? a : b);
                  return `${peak.date} had the highest releases with ${peak.total.toLocaleString()} fish`;
                })()}
              </p>
            </div>
            <div className="insight-card">
              <div className="insight-icon">
                <Icon name="fish" size={40} />
              </div>
              <h3>Top Species</h3>
              <p>
                {(() => {
                  const bySpecies = aggregateBySpecies();
                  if (bySpecies.length === 0) return 'No data available';
                  const top = bySpecies[0];
                  return `${top.species} leads with ${top.quantity.toLocaleString()} total releases`;
                })()}
              </p>
            </div>
            <div className="insight-card">
              <div className="insight-icon">
                <Icon name="building" size={40} />
              </div>
              <h3>Active Hatcheries</h3>
              <p>
                {(() => {
                  const hatcheries = new Set(liveReleases.map(r => r.hatchery));
                  return hatcheries.size > 0
                    ? `${hatcheries.size} hatcheries active in the last 30 days`
                    : 'No hatchery data available';
                })()}
              </p>
            </div>
            <div className="insight-card">
              <div className="insight-icon">
                <Icon name="wave" size={40} />
              </div>
              <h3>ADF&G Coverage</h3>
              <p>{adfgData ? `${Object.keys(adfgData).length} regions with ${Object.values(adfgData).reduce((sum, r) => sum + r.districts.length, 0)} districts` : 'Loading real-time data...'}</p>
            </div>
            <div className="insight-card">
              <div className="insight-icon">
                <Icon name="tag" size={40} />
              </div>
              <h3>Tag Recoveries</h3>
              <p>{rmisRecBySpecies.length > 0 ? `${rmisRecBySpecies.reduce((s, r) => s + r.count, 0).toLocaleString()} recovery records across ${rmisRecBySpecies.length} species` : rmisLoading ? 'Loading data…' : 'No recovery data loaded'}</p>
            </div>
            <div className="insight-card">
              <div className="insight-icon">
                <Icon name="fish" size={40} />
              </div>
              <h3>Tagged Releases</h3>
              <p>{rmisRelByYear.length > 0 ? `${rmisRelByYear.reduce((s, r) => s + r.total, 0).toLocaleString()} total fish released across ${rmisRelByYear.length} brood years` : rmisLoading ? 'Loading data…' : 'No release data loaded'}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
