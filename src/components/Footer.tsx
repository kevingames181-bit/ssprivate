import { Link } from 'react-router-dom';
import { Icon } from './Icon';

export const Footer = () => {
  return (
    <footer className="site-footer">

      {/* Cinematic ambient glow orbs */}
      <div className="footer-orb left" />
      <div className="footer-orb right" />
      <div className="footer-shimmer" />

      <div className="footer-container">

        {/* =========================================================
            BRAND / ABOUT
           ========================================================= */}
        <div className="footer-section footer-about">

          <Link to="/" className="footer-logo-link">
            <img
              src="/images/common-logo.png"
              alt="SeaScope"
              className="footer-logo-img"
            />
          </Link>

          <p>
            SeaScope Alaska is a next-generation fishery intelligence platform
            delivering realtime hatchery releases, RMIS movement tracking,
            marine analytics, environmental intelligence, tides, live salmon
            counters, and predictive fishery insights across Alaska.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '0.8rem',
              flexWrap: 'wrap',
              marginTop: '0.5rem',
            }}
          >
            {[
              'Realtime RMIS',
              'Live Salmon Data',
              'Ocean Intelligence',
              'Marine Analytics',
            ].map((tag) => (
              <div
                key={tag}
                style={{
                  padding: '0.55rem 0.9rem',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.82)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.4px',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* =========================================================
            PLATFORM
           ========================================================= */}
        <div className="footer-section">

          <h3>Platform</h3>

          <ul className="footer-links">

            <li>
              <Link to="/map">
                <Icon name="map" size={18} />
                <span>Fishery Intelligence Map</span>
              </Link>
            </li>

            <li>
              <Link to="/movements">
                <Icon name="activity" size={18} />
                <span>Fish Movements</span>
              </Link>
            </li>

            <li>
              <Link to="/analytics">
                <Icon name="chart" size={18} />
                <span>Analytics & Forecasting</span>
              </Link>
            </li>

            <li>
              <Link to="/weather">
                <Icon name="cloudRain" size={18} />
                <span>Marine Weather</span>
              </Link>
            </li>

            <li>
              <Link to="/pricing">
                <Icon name="dollarSign" size={18} />
                <span>Pricing</span>
              </Link>
            </li>

          </ul>
        </div>

        {/* =========================================================
            COMPANY
           ========================================================= */}
        <div className="footer-section">

          <h3>Company</h3>

          <ul className="footer-links">

            <li>
              <Link to="/company">
                <Icon name="building" size={18} />
                <span>About SeaScope</span>
              </Link>
            </li>

            <li>
              <Link to="/technology">
                <Icon name="cpu" size={18} />
                <span>Technology</span>
              </Link>
            </li>

            <li>
              <Link to="/partners">
                <Icon name="globe" size={18} />
                <span>Partners</span>
              </Link>
            </li>

            <li>
              <Link to="/careers">
                <Icon name="briefcase" size={18} />
                <span>Careers</span>
              </Link>
            </li>

            <li>
              <Link to="/contact">
                <Icon name="mail" size={18} />
                <span>Contact</span>
              </Link>
            </li>

          </ul>
        </div>

        {/* =========================================================
            LEGAL + SOCIAL
           ========================================================= */}
        <div className="footer-section">

          <h3>Connect</h3>

          <div className="social-links">

            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <Icon name="twitter" size={20} />
              <span>Twitter / X</span>
            </a>

            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <Icon name="linkedin" size={20} />
              <span>LinkedIn</span>
            </a>

            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <Icon name="instagram" size={20} />
              <span>Instagram</span>
            </a>

            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <Icon name="play" size={20} />
              <span>YouTube</span>
            </a>

          </div>

          <div
            style={{
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <ul className="footer-links">

              <li>
                <Link to="/privacy">
                  <Icon name="shield" size={18} />
                  <span>Privacy Policy</span>
                </Link>
              </li>

              <li>
                <Link to="/terms">
                  <Icon name="fileText" size={18} />
                  <span>Terms of Service</span>
                </Link>
              </li>

              <li>
                <Link to="/security">
                  <Icon name="lock" size={18} />
                  <span>Security</span>
                </Link>
              </li>

            </ul>
          </div>
        </div>
      </div>

      {/* =========================================================
          BOTTOM
         ========================================================= */}
      <div className="footer-bottom">

        <div className="footer-bottom-content">

          <p className="copyright">
            © 2026 SEASCOPE ALASKA — ALL RIGHTS RESERVED
          </p>

          <p className="pyron-credit">
            ENGINEERED BY{' '}
            <a
              href="https://pyroncompany.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              PYRON COMPANY
            </a>
          </p>

        </div>
      </div>
    </footer>
  );
};