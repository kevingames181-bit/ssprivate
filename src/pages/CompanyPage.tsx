import { Link } from 'react-router-dom';
import { Target, Zap, Users, Award, TrendingUp, Shield, Heart, ArrowRight, CheckCircle, Globe, Database, Waves } from 'lucide-react';

const STATS = [
  { value: '150+', label: 'Fishing Districts', sub: 'Across 5 regions' },
  { value: '13', label: 'Hatchery Sites', sub: 'Real ADF&G coordinates' },
  { value: '99.9%', label: 'Uptime SLA', sub: 'Always-on data' },
  { value: '5', label: 'Salmon Species', sub: 'Full tracking' },
];

const VALUES = [
  { icon: Shield, title: 'Reliability', desc: 'Accurate, real-time data you can trust. Built on robust infrastructure with 99.9% uptime.' },
  { icon: Users, title: 'Community First', desc: "Alaska's fishing community is at the heart of everything we do. We listen and build what matters." },
  { icon: Zap, title: 'Real Data Only', desc: 'Direct ADF&G and NOAA integration — no synthetic data, no guesses, just official sources.' },
  { icon: Heart, title: 'Sustainability', desc: "Supporting sustainable fishing practices and preserving Alaska's marine ecosystems for future generations." },
  { icon: TrendingUp, title: 'Always Improving', desc: 'Constantly evolving based on user feedback and the latest data from official sources.' },
  { icon: Award, title: 'Excellence', desc: 'We strive for excellence in data accuracy, user experience, and customer support.' },
];

const TIMELINE = [
  { year: '2026', title: 'Founded', desc: 'SeaScope launched with a mission to democratize fishery intelligence for Alaska.' },
  { year: '2026', title: 'ADF&G Integration', desc: 'Live integration with Alaska Department of Fish & Game GIS services went live.' },
  { year: '2026', title: 'NOAA Tides', desc: 'Real-time tide predictions added for all major Alaska fishing stations.' },
  { year: '2026', title: 'Full Platform', desc: 'Trends, analytics, and hatchery tracking launched across all 4 Alaska regions.' },
];

export const CompanyPage = () => (
  <div className="co-page">

    {/* ── HERO ── */}
    <section className="co-hero">
      <div className="co-hero-bg">
        <img src="/images/hero-illustration.svg" alt="" aria-hidden />
        <div className="co-hero-overlay" />
      </div>
      <div className="co-hero-content">
        <div className="co-eyebrow">
          <span className="co-dot" />
          Alaska-Based · Founded 2026
        </div>
        <h1>
          Built for the people<br />
          <span className="co-hero-accent">who work the water</span>
        </h1>
        <p>SeaScope delivers real-time fishery intelligence directly from official ADF&amp;G and NOAA sources — no guesswork, no delays.</p>
        <div className="co-hero-actions">
          <Link to="/signup" className="co-btn-primary">Get Started <ArrowRight size={16} /></Link>
          <Link to="/contact" className="co-btn-ghost">Talk to us</Link>
        </div>
      </div>
    </section>

    {/* ── STATS STRIP ── */}
    <div className="co-stats-strip">
      {STATS.map((s, i) => (
        <div key={i} className="co-stat-item">
          <div className="co-stat-num">{s.value}</div>
          <div className="co-stat-label">{s.label}</div>
          <div className="co-stat-sub">{s.sub}</div>
        </div>
      ))}
    </div>

    {/* ── MISSION ── */}
    <section className="co-mission">
      <div className="co-wrap">
        <div className="co-mission-text">
          <div className="co-tag"><Target size={13} />Our Mission</div>
          <h2>Data-driven decisions for every fisherman</h2>
          <p>SeaScope was built to level the playing field. Whether you're an independent fisherman or running a large commercial fleet, you deserve the same quality of intelligence that was once only available to a select few.</p>
          <p>We integrate directly with ADF&amp;G GIS services and NOAA's Tides &amp; Currents API to deliver accurate, real-time information.</p>
          <ul className="co-mission-list">
            {['Live ADF&G district boundaries', 'NOAA tide predictions', '13 real hatchery locations', 'Seasonal release estimates', 'Prince William Sound coverage'].map((item, i) => (
              <li key={i}><CheckCircle size={16} />{item}</li>
            ))}
          </ul>
        </div>
        <div className="co-mission-visual">
          <div className="co-mission-card co-mission-card--top">
            <Globe size={20} />
            <div>
              <strong>ADF&G GIS Live</strong>
              <span>150+ districts synced</span>
            </div>
          </div>
          <div className="co-mission-card co-mission-card--mid">
            <Database size={20} />
            <div>
              <strong>NOAA Tides API</strong>
              <span>Real-time predictions</span>
            </div>
          </div>
          <div className="co-mission-card co-mission-card--bot">
            <Waves size={20} />
            <div>
              <strong>Hatchery Tracking</strong>
              <span>13 official locations</span>
            </div>
          </div>
          <img src="/images/map-illustration.svg" alt="Alaska fishing harbor" className="co-mission-img" />
        </div>
      </div>
    </section>

    {/* ── VALUES ── */}
    <section className="co-values">
      <div className="co-wrap">
        <div className="co-section-head">
          <h2>What we stand for</h2>
          <p>The principles behind every decision we make</p>
        </div>
        <div className="co-values-grid">
          {VALUES.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="co-value-card">
              <div className="co-value-icon"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── TIMELINE ── */}
    <section className="co-timeline">
      <div className="co-wrap">
        <div className="co-section-head">
          <h2>Our journey</h2>
          <p>From idea to Alaska's premier fishery platform</p>
        </div>
        <div className="co-timeline-track">
          {TIMELINE.map((t, i) => (
            <div key={i} className="co-timeline-item">
              <div className="co-timeline-year">{t.year}</div>
              <div className="co-timeline-dot" />
              <div className="co-timeline-body">
                <strong>{t.title}</strong>
                <p>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── CTA ── */}
    <section className="co-cta">
      <div className="co-cta-inner">
        <h2>Ready to fish smarter?</h2>
        <p>Join Alaska's fishery intelligence platform.</p>
        <div className="co-cta-btns">
          <Link to="/signup" className="co-btn-primary">Get Started <ArrowRight size={16} /></Link>
          <Link to="/contact" className="co-btn-ghost">Contact Us</Link>
        </div>
      </div>
    </section>

  </div>
);
