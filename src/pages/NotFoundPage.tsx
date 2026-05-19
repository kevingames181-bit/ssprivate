import { Link } from 'react-router-dom';
import { Home, Map, BarChart3, DollarSign, HelpCircle, ArrowRight } from 'lucide-react';

const LINKS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/map', icon: Map, label: 'Live Map' },
  { to: '/trends', icon: BarChart3, label: 'Analytics' },
  { to: '/pricing', icon: DollarSign, label: 'Pricing' },
  { to: '/faq', icon: HelpCircle, label: 'FAQ' },
];

export const NotFoundPage = () => (
  <div className="nf-page">
    <div className="nf-bg-glow" />

    <div className="nf-content">
      {/* Big number */}
      <div className="nf-number" aria-hidden>404</div>

      {/* Message */}
      <div className="nf-message">
        <h1>Lost at sea?</h1>
        <p>This page doesn't exist or has been moved. Let's get you back on course.</p>
      </div>

      {/* Primary action */}
      <Link to="/" className="nf-home-btn">
        <Home size={18} />
        Back to Home
        <ArrowRight size={16} />
      </Link>

      {/* Quick nav */}
      <div className="nf-nav">
        <p className="nf-nav-label">Or navigate to</p>
        <div className="nf-nav-grid">
          {LINKS.slice(1).map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="nf-nav-item">
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  </div>
);
