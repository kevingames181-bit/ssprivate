import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { fetchAllFisheryData } from '../services/adfgApiService';
import {
  Waves,
  Cloud,
  Fish,
  MapPin,
  Zap,
  Shield,
  BarChart3,
  Sparkles,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

const ROTATING_IMAGES = [
  '/images/blocknear4/1.jpeg',
  '/images/blocknear4/2.png',
  '/images/blocknear4/3.png',
];

export const HomePage = () => {
  const [liveDataCount, setLiveDataCount] = useState<number | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadLiveData() {
      try {
        const data = await fetchAllFisheryData();
        const totalDistricts = Object.values(data).reduce((sum, region) => sum + region.districts.length, 0);
        setLiveDataCount(totalDistricts);
      } catch (error) {
        console.error('Failed to load live data count:', error);
      }
    }
    loadLiveData();
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveImg(prev => (prev + 1) % ROTATING_IMAGES.length);
    }, 3500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div className="n8n-home">
      {/* Hero Section */}
      <section className="n8n-hero" style={{ backgroundImage: 'url(/images/blocknear4/1.jpeg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
        <div className="n8n-hero-bg">
          <div className="n8n-hero-overlay"></div>
          <div className="n8n-hero-gradient"></div>
        </div>

        <div className="n8n-hero-content">
          <div className="n8n-hero-badge">
            <Sparkles size={16} />
            <span>LIVE DATA • ADF&G INTEGRATED • REAL-TIME</span>
          </div>

          <h1 className="n8n-hero-title">
            Alaska's Premier<br />
            <span className="n8n-gradient-text">Fishery Intelligence</span><br />
            Platform
          </h1>

          <p className="n8n-hero-subtitle">
            Real-time fishery data from official ADF&G sources, live NOAA tide predictions, and hatchery release tracking.
            {liveDataCount ? ` Currently tracking ${liveDataCount} districts across Alaska.` : " Navigate Alaska's waters with confidence."}
          </p>

          <div className="n8n-hero-cta">
            <Link to="/signup" className="n8n-btn-hero-primary">
              <span>Get Started</span>
              <ArrowRight size={20} />
            </Link>
            <Link to="/map" className="n8n-btn-hero-secondary">
              <MapPin size={20} />
              <span>Explore Live Map</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Rotating Image Showcase */}
      <section className="ss-img-showcase">
        <div className="ss-img-showcase-inner">
          <div className="ss-img-stage">
            {ROTATING_IMAGES.map((src, i) => {
              const offset = (i - activeImg + ROTATING_IMAGES.length) % ROTATING_IMAGES.length;
              return (
                <div
                  key={src}
                  className={`ss-img-card ss-img-card--${offset === 0 ? 'center' : offset === 1 ? 'right' : 'left'}`}
                  onClick={() => setActiveImg(i)}
                >
                  <img src={src} alt={`SeaScope view ${i + 1}`} />
                  <div className="ss-img-card-glow" />
                </div>
              );
            })}
          </div>
          <div className="ss-img-dots">
            {ROTATING_IMAGES.map((_, i) => (
              <button
                key={i}
                className={`ss-img-dot${i === activeImg ? ' ss-img-dot--active' : ''}`}
                onClick={() => setActiveImg(i)}
                aria-label={`View image ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="n8n-features">
        <div className="n8n-section-header">
          <h2 className="n8n-section-title">Everything You Need</h2>
          <p className="n8n-section-subtitle">
            Powerful tools designed for Alaska's fishing industry
          </p>
        </div>

        <div className="n8n-features-grid">
          <div className="n8n-feature-card">
            <div className="n8n-feature-icon">
              <MapPin size={28} />
            </div>
            <h3>Interactive Maps</h3>
            <p>
              Real-time fishery data visualization with official ADF&G integration.
              View district boundaries, statistical areas, and live hatchery data.
            </p>
            <Link to="/map" className="n8n-feature-link">
              Explore Maps <ArrowRight size={16} />
            </Link>
          </div>

          <div className="n8n-feature-card n8n-feature-highlight">
            <div className="n8n-feature-icon">
              <Zap size={28} />
            </div>
            <h3>Trends & Analytics</h3>
            <p>
              Species breakdown, release trends, and regional statistics
              sourced directly from ADF&G district data.
            </p>
            <Link to="/trends" className="n8n-feature-link">
              View Analytics <ArrowRight size={16} />
            </Link>
          </div>

          <div className="n8n-feature-card">
            <div className="n8n-feature-icon">
              <Cloud size={28} />
            </div>
            <h3>Weather & Tides</h3>
            <p>
              Live NOAA tide predictions for all major Alaska fishing stations
              including Juneau, Sitka, Kodiak, Homer, and more.
            </p>
            <Link to="/map" className="n8n-feature-link">
              Check Tides <ArrowRight size={16} />
            </Link>
          </div>

          <div className="n8n-feature-card">
            <div className="n8n-feature-icon">
              <Fish size={28} />
            </div>
            <h3>Species Tracking</h3>
            <p>
              Monitor Chinook, Sockeye, Coho, Pink, and Chum salmon releases
              across 13 hatcheries with real ADF&G location data.
            </p>
            <Link to="/trends" className="n8n-feature-link">
              Track Species <ArrowRight size={16} />
            </Link>
          </div>

          <div className="n8n-feature-card">
            <div className="n8n-feature-icon">
              <BarChart3 size={28} />
            </div>
            <h3>Release Data</h3>
            <p>
              Daily hatchery release estimates based on ADF&G annual permit targets,
              distributed across typical seasonal release windows.
            </p>
            <Link to="/trends" className="n8n-feature-link">
              View Data <ArrowRight size={16} />
            </Link>
          </div>

          <div className="n8n-feature-card">
            <div className="n8n-feature-icon">
              <Shield size={28} />
            </div>
            <h3>Compliance Tools</h3>
            <p>
              Stay informed on regulations, district boundaries, and reporting
              requirements across all Alaska fishing regions.
            </p>
            <Link to="/pricing" className="n8n-feature-link">
              Learn More <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Rotating Image Showcase */}
      <section className="n8n-image-showcase">
        <div className="n8n-showcase-track">
          <div className="n8n-showcase-slide" style={{ animationDelay: '0s' }}>
            <img src="/images/blocknear4/1.jpeg" alt="Alaska fishery" />
          </div>
          <div className="n8n-showcase-slide" style={{ animationDelay: '4s' }}>
            <img src="/images/blocknear4/2.png" alt="Alaska waters" />
          </div>
          <div className="n8n-showcase-slide" style={{ animationDelay: '8s' }}>
            <img src="/images/blocknear4/3.png" alt="Alaska fishing" />
          </div>
        </div>
        <div className="n8n-showcase-overlay-left" />
        <div className="n8n-showcase-overlay-right" />
      </section>

      {/* Data Source Section */}
      <section className="n8n-data-source">
        <div className="n8n-data-source-image">
          <img
            src="/images/analytics-illustration.svg"
            alt="Alaska fishing harbor"
            className="data-source-img"
            style={{ borderRadius: '12px', width: '100%', objectFit: 'cover', maxHeight: '400px' }}
          />
        </div>
        <div className="n8n-data-content">
          <div className="n8n-data-badge">
            <CheckCircle2 size={16} />
            <span>OFFICIAL DATA SOURCES</span>
          </div>

          <h2>Alaska's Fishing Industry, Powered by Real Data</h2>

          <p>
            Direct integration with ADF&G GIS services provides access to fishery districts,
            regulatory boundaries, and hatchery locations across Cook Inlet, Bristol Bay,
            Southeast Alaska, and Kodiak. Tide data from NOAA Tides & Currents API.
          </p>

          <div className="n8n-data-features">
            <div className="n8n-data-feature">
              <CheckCircle2 size={20} />
              <span>ADF&G GIS district boundaries (live)</span>
            </div>
            <div className="n8n-data-feature">
              <CheckCircle2 size={20} />
              <span>NOAA tide predictions (live)</span>
            </div>
            <div className="n8n-data-feature">
              <CheckCircle2 size={20} />
              <span>13 real hatchery locations</span>
            </div>
            <div className="n8n-data-feature">
              <CheckCircle2 size={20} />
              <span>Release estimates from ADF&G permit data</span>
            </div>
          </div>

          <Link to="/trends" className="n8n-btn-data">
            View Live Analytics
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="n8n-final-cta">
        <div className="n8n-cta-content">
          <Waves size={48} className="n8n-cta-icon" />
          <h2>Ready to Navigate Smarter?</h2>
          <p>
            Access Alaska's fishery intelligence platform today.
          </p>
          <div className="n8n-cta-buttons">
            <Link to="/signup" className="n8n-btn-cta-primary">
              Get Started
              <ArrowRight size={20} />
            </Link>
            <Link to="/contact" className="n8n-btn-cta-secondary">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
