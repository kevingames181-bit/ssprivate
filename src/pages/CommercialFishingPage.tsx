import { Link } from 'react-router-dom';
import { ArrowRight, Fish, MapPin, BarChart3, Waves, CheckCircle, Anchor } from 'lucide-react';

const FEATURES = [
  { icon: MapPin, title: 'District Boundary Maps', desc: 'Real-time ADF&G district boundaries so you always know exactly where you can fish.' },
  { icon: Fish, title: 'Species Tracking', desc: 'Monitor Chinook, Sockeye, Coho, Pink, and Chum salmon across all major Alaska regions.' },
  { icon: BarChart3, title: 'Catch Analytics', desc: 'Historical trends and seasonal patterns to help you plan your operations.' },
  { icon: Waves, title: 'Tide Predictions', desc: 'Live NOAA tide data for all major Alaska fishing stations.' },
];

const REGIONS = [
  'Cook Inlet', 'Bristol Bay', 'Southeast Alaska', 'Kodiak', 'Prince William Sound',
];

export const CommercialFishingPage = () => (
  <div className="co-page">
    <section className="co-hero">
      <div className="co-hero-bg">
        <img src="/images/map-illustration.svg" alt="" aria-hidden />
        <div className="co-hero-overlay" />
      </div>
      <div className="co-hero-content">
        <div className="co-eyebrow">
          <Anchor size={14} />
          Solutions · Commercial Fishing
        </div>
        <h1>
          Intelligence built for<br />
          <span className="co-hero-accent">commercial fishermen</span>
        </h1>
        <p>Real-time data from official ADF&G and NOAA sources — everything you need to make smarter decisions on the water.</p>
        <div className="co-hero-actions">
          <Link to="/signup" className="co-btn-primary">Get Started <ArrowRight size={16} /></Link>
          <Link to="/contact" className="co-btn-ghost">Talk to us</Link>
        </div>
      </div>
    </section>

    <section className="co-values" style={{ padding: '5rem 0' }}>
      <div className="co-wrap">
        <div className="co-section-head">
          <h2>Built for the fleet</h2>
          <p>Tools that matter to commercial fishing operations</p>
        </div>
        <div className="co-values-grid">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="co-value-card">
              <div className="co-value-icon"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="co-mission" style={{ padding: '5rem 0' }}>
      <div className="co-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
        <div className="co-mission-text">
          <div className="co-tag"><MapPin size={13} />Coverage Area</div>
          <h2>All major Alaska fishing regions</h2>
          <p>SeaScope covers the regions that matter most to Alaska's commercial fishing industry, with live data from official sources.</p>
          <ul className="co-mission-list">
            {REGIONS.map((r, i) => (
              <li key={i}><CheckCircle size={16} />{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <img src="/images/analytics-illustration.svg" alt="Alaska regions coverage" style={{ width: '100%', borderRadius: '1.25rem' }} />
        </div>
      </div>
    </section>

    <section className="co-cta">
      <div className="co-cta-inner">
        <h2>Ready to fish smarter?</h2>
        <p>Join Alaska's fishery intelligence platform.</p>
        <div className="co-cta-btns">
          <Link to="/signup" className="co-btn-primary">Get Started <ArrowRight size={16} /></Link>
          <Link to="/pricing" className="co-btn-ghost">View Pricing</Link>
        </div>
      </div>
    </section>
  </div>
);
