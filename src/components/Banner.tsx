import { useState } from 'react';
import { Icon } from './Icon';

interface BannerProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'promo';
  dismissible?: boolean;
  link?: {
    text: string;
    url: string;
  };
}

export const Banner = ({ message, type = 'info', dismissible = true, link }: BannerProps) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'checkCircle';
      case 'warning':
        return 'alertTriangle';
      case 'promo':
        return 'star';
      default:
        return 'info';
    }
  };

  return (
    <div className={`n8n-banner n8n-banner-${type}`}>
      <div className="n8n-banner-content">
        <div className="n8n-banner-icon">
          <Icon name={getIcon()} size={20} />
        </div>
        <div className="n8n-banner-message">
          <span>{message}</span>
          {link && (
            <a href={link.url} className="n8n-banner-link">
              {link.text} →
            </a>
          )}
        </div>
        {dismissible && (
          <button
            className="n8n-banner-close"
            onClick={() => setIsVisible(false)}
            aria-label="Close banner"
          >
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
