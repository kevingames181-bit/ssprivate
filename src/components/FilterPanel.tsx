import { useState, useEffect } from 'react';
import { Icon } from './Icon';

interface FilterPanelProps {
  availableSpecies: string[];
  availableHatcheries: string[];
  availableReleaseTypes: string[];
  onFilterChange: (filters: ActiveFilters) => void;
  /** Render species and areas as two separate sidebar boxes */
  splitBoxes?: boolean;
}

export interface ActiveFilters {
  species: string[];
  hatcheries: string[];
  releaseTypes: string[];
}

const SPECIES_COLORS: Record<string, string> = {
  'Chinook Salmon': '#FFD700',  // Gold
  'Sockeye Salmon': '#E53935',  // Red
  'Coho Salmon':    '#C0C0C0',  // Silver
  'Pink Salmon':    '#FF69B4',  // Pink
  'Chum Salmon':    '#8B4513',  // Brown
};

const SPECIES_DISPLAY: Record<string, string> = {
  'Chinook Salmon': 'King (Chinook)',
  'Sockeye Salmon': 'Red (Sockeye)',
  'Coho Salmon':    'Silver (Coho)',
  'Pink Salmon':    'Pink (Humpy)',
  'Chum Salmon':    'Chum (Dog)',
};

export const FilterPanel = ({
  availableSpecies,
  availableHatcheries,
  availableReleaseTypes,
  onFilterChange,
  splitBoxes = false,
}: FilterPanelProps) => {
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(availableSpecies);
  const [selectedHatcheries, setSelectedHatcheries] = useState<string[]>(availableHatcheries);
  const [selectedReleaseTypes, setSelectedReleaseTypes] = useState<string[]>(availableReleaseTypes);

  // Sync when the available lists change (e.g. new hatcheries added to data source)
  useEffect(() => {
    setSelectedHatcheries(prev => {
      const newOnes = availableHatcheries.filter(h => !prev.includes(h));
      if (newOnes.length === 0) return prev; // no change, avoid re-render
      return [...prev, ...newOnes];
    });
  }, [availableHatcheries]);

  useEffect(() => {
    setSelectedSpecies(prev => {
      const newOnes = availableSpecies.filter(s => !prev.includes(s));
      if (newOnes.length === 0) return prev; // no change, avoid re-render
      return [...prev, ...newOnes];
    });
  }, [availableSpecies]);

  useEffect(() => {
    onFilterChange({ species: selectedSpecies, hatcheries: selectedHatcheries, releaseTypes: selectedReleaseTypes });
  }, [selectedSpecies, selectedHatcheries, selectedReleaseTypes]);

  const toggleSpecies = (sp: string) =>
    setSelectedSpecies(prev => prev.includes(sp) ? prev.filter(s => s !== sp) : [...prev, sp]);

  const toggleHatchery = (h: string) =>
    setSelectedHatcheries(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);

  const toggleReleaseType = (t: string) =>
    setSelectedReleaseTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const speciesSection = (
    <>
      <div className="filter-section">
        <h4>Species</h4>
        {availableSpecies.map(sp => (
          <label key={sp} className="checkbox-label">
            <input type="checkbox" checked={selectedSpecies.includes(sp)} onChange={() => toggleSpecies(sp)} />
            <span className="species-indicator" style={{ backgroundColor: SPECIES_COLORS[sp] || '#95A5A6' }} />
            {SPECIES_DISPLAY[sp] ?? sp}
          </label>
        ))}
      </div>
      <div className="filter-section">
        <h4>Release Type</h4>
        {availableReleaseTypes.map(t => (
          <label key={t} className="checkbox-label">
            <input type="checkbox" checked={selectedReleaseTypes.includes(t)} onChange={() => toggleReleaseType(t)} />
            {t}
          </label>
        ))}
      </div>
    </>
  );

  const areasSection = (
    <div className="filter-section">
      {!splitBoxes && <h4>Areas & Hatcheries</h4>}
      {availableHatcheries.map(h => (
        <label key={h} className="checkbox-label small">
          <input type="checkbox" checked={selectedHatcheries.includes(h)} onChange={() => toggleHatchery(h)} />
          {h.replace(' Hatchery', '')}
        </label>
      ))}
    </div>
  );

  if (splitBoxes) {
    return (
      <>
        <div className="sidebar-section">
          <div className="section-header">
            <Icon name="filter" size={18} />
            <h3>SPECIES</h3>
          </div>
          <div className="filter-panel">{speciesSection}</div>
        </div>
        <div className="sidebar-section">
          <div className="section-header">
            <Icon name="map-pin" size={18} />
            <h3>AREAS & HATCHERIES</h3>
          </div>
          <div className="filter-panel">{areasSection}</div>
        </div>
      </>
    );
  }

  return (
    <div className="filter-panel">
      <h3><Icon name="filter" size={18} /> Data Filters</h3>
      {speciesSection}
      {areasSection}
    </div>
  );
};
