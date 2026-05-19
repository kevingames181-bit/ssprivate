import { Link } from 'react-router-dom';
import { ArrowRight, Database, TrendingUp, Globe, Shield, CheckCircle, Beaker } from 'lucide-react';

const FEATURES = [
  { icon: Database, title: 'Raw Data Access', desc: 'Export fishery data in CSV and JSON formats for your own analysis pipelines.' },
  { icon: TrendingUp, title: 'Historical Trends', desc: 'Access historical release data and district activity to support longitudinal research.' },
  { icon: Globe, title: 'GIS Integration', desc: 'Official ADF&G district boundaries and hatchery coordinates for spatial analysis.' },
  { icon: Shield, title: 'Data Integrity', desc: 'All data sourced directly from official government agencies — no synthetic data.' },
];

export const ResearchPage = () => (
  <div className="co-page">
    <section className="co-hero">
      <div className="co-hero-bg">
        <img src="/images/analytics-illustration.svg" alt="" aria-hidden />
        <div className="co-hero-overlay" />
      </div>
      <div className="co-hero-content">
        <div className="co-eyebrow">
          <Beaker size={14} />
          Solutions · Research
        </div>
        <h1>
          Official data for<br />
          <span className="co-hero-accent">serious research</span>
        </h1>
        <p>Access authoritative ADF&G and NOAA data in formats ready for scientific analysis, GIS workflows, and academic research.</p>
        <div className="co-hero-actions">
          <Link to="/signup" className="co-btn-primary">Get Started <ArrowRight size={16} /></Link>
          <Link to="/contact" className="co-btn-ghost">Talk to us</Link>
        </div>
      </div>
    </section>

    <section className="co-values" style={{ padding: '5rem 0' }}>
      <div className="co-wrap">
        <div className="co-section-head">
          <h2>Built for researchers</h2>
          <p>The data tools you need for rigorous analysis</p>
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
          <div className="co-tag"><Database size={13} />Data Coverage</div>
          <h2>Comprehensive Alaska fishery data</h2>
          <p>SeaScope aggregates data across all major Alaska fishing regions, giving researchers a single source of truth for fishery intelligence.</p>
          <ul className="co-mission-list">
            {['150+ fishing districts', '13 hatchery locations with coordinates', '5 salmon species tracked', 'Cook Inlet, Bristol Bay, Southeast Alaska, Kodiak, Prince William Sound'].map((item, i) => (
              <li key={i}><CheckCircle size={16} />{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <img src="/images/resources-illustration.svg" alt="Research data" style={{ width: '100%', borderRadius: '1.25rem' }} />
        </div>
      </div>
    </section>

    <section className="co-cta">
      <div className="co-cta-inner">
        <h2>Start your research today</h2>
        <p>Access Alaska's most comprehensive fishery data platform.</p>
        <div className="co-cta-btns">
          <Link to="/signup" className="co-btn-primary">Get Started <ArrowRight size={16} /></Link>
          <Link to="/contact" className="co-btn-ghost">Contact Us</Link>
        </div>
      </div>
    </section>
  </div>
);
