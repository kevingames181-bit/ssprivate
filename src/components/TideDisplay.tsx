import type { TideInfo } from '../services/noaaTideService';
import { Icon } from './Icon';

interface TideDisplayProps {
  tideInfo: TideInfo | undefined;
}

export const TideDisplay = ({ tideInfo }: TideDisplayProps) => {
  if (!tideInfo) {
    return (
      <div className="tide-display">
        <div className="tide-header">
          <Icon name="wave" size={24} />
          <h3>Tide Information</h3>
        </div>
        <p>No tide data available</p>
      </div>
    );
  }

  return (
    <div className="tide-display">
      <div className="tide-header">
        <Icon name="wave" size={24} />
        <h3>Tide Information</h3>
      </div>
      <div className="tide-grid">
        <div className="tide-item">
          <span className="tide-label">High Tide</span>
          <span className="tide-value">{tideInfo.highTide}</span>
        </div>
        <div className="tide-item">
          <span className="tide-label">Low Tide</span>
          <span className="tide-value">{tideInfo.lowTide}</span>
        </div>
        <div className="tide-item">
          <Icon name="sun" size={16} />
          <span className="tide-label">Sunrise</span>
          <span className="tide-value">{tideInfo.sunrise}</span>
        </div>
        <div className="tide-item">
          <Icon name="moon" size={16} />
          <span className="tide-label">Sunset</span>
          <span className="tide-value">{tideInfo.sunset}</span>
        </div>
      </div>
    </div>
  );
};
