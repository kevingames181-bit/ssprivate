import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, Search, ArrowRight, MessageCircle, BookOpen, DollarSign, Headphones, Zap } from 'lucide-react';

const FAQS = [
  { cat: 'Getting Started', q: 'What is SeaScope?', a: "SeaScope is Alaska's fishery intelligence platform. We integrate with ADF&G GIS services for live district data and NOAA Tides & Currents for tide predictions. Hatchery release quantities are estimated from ADF&G annual permit data." },
  { cat: 'Getting Started', q: 'How do I sign up?', a: 'Click "Get Started" on the homepage, create your account with email or Google, and you have immediate access.' },
  { cat: 'Getting Started', q: 'Is there a mobile app?', a: 'SeaScope is fully responsive and works on all devices through your browser — no app install needed. Native iOS and Android apps are on the roadmap.' },
  { cat: 'Data & Features', q: 'What data sources does SeaScope use?', a: 'SeaScope integrates with official government and scientific data sources to provide accurate, real-time fishery intelligence. All data is sourced from authoritative agencies to ensure reliability.' },
  { cat: 'Data & Features', q: 'Which Alaska regions are covered?', a: 'Cook Inlet, Bristol Bay, Southeast Alaska, Kodiak, and Prince William Sound — all pulled live from official sources. We track 150+ fishing districts with official boundary maps.' },
  { cat: 'Data & Features', q: 'Are the release quantities real-time?', a: 'Hatchery locations and district boundaries are live from ADF&G. Release quantities are estimated from ADF&G 2023 annual permit targets distributed across typical seasonal windows — real-time daily counts require ADF&G FMPD operator access which is not publicly available.' },
  { cat: 'Pricing', q: 'What plans are available?', a: 'Pro at $50/month, Enterprise at $100/month, and Custom pricing for large organizations. Annual billing saves 20%.' },
  { cat: 'Pricing', q: 'Can I cancel anytime?', a: 'Yes. Cancel anytime with no penalties. Access continues until the end of your billing period.' },
  { cat: 'Pricing', q: 'What is the Custom plan?', a: 'Custom is for large organizations needing white-label options, on-premise deployment, custom integrations, or volume pricing. Contact us to discuss.' },
  { cat: 'Support', q: 'How do I report a bug?', a: 'Contact us through the Contact page or email support@seascope.alaska. Include your browser, device, and any error messages. We respond within 24 hours.' },
  { cat: 'Support', q: 'Is my data secure?', a: 'All data is encrypted in transit and at rest. We never share personal information with third parties. See our Privacy Policy for full details.' },
];

const CATS = [
  { id: 'All', label: 'All Questions', icon: Zap },
  { id: 'Getting Started', label: 'Getting Started', icon: BookOpen },
  { id: 'Data & Features', label: 'Data & Features', icon: Search },
  { id: 'Pricing', label: 'Pricing', icon: DollarSign },
  { id: 'Support', label: 'Support', icon: Headphones },
];

export const FAQPage = () => {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [cat, setCat] = useState('All');

  const filtered = FAQS.filter(f => {
    const q = search.toLowerCase();
    return (cat === 'All' || f.cat === cat) &&
      (!q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  });

  return (
    <div className="fq-page">

      {/* ── HERO ── */}
      <section className="fq-hero">
        <div className="fq-hero-glow" />
        <div className="fq-hero-inner">
          <h1>How can we help?</h1>
          <p>Search our knowledge base or browse by category</p>
          <div className="fq-search">
            <Search size={18} className="fq-search-icon" />
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="fq-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>
      </section>

      {/* ── BODY ── */}
      <section className="fq-body">
        <div className="fq-wrap">

          {/* Category sidebar */}
          <aside className="fq-sidebar">
            <nav className="fq-nav">
              {CATS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`fq-nav-btn ${cat === id ? 'active' : ''}`}
                  onClick={() => setCat(id)}
                >
                  <Icon size={16} />
                  {label}
                  <span className="fq-nav-count">
                    {id === 'All' ? FAQS.length : FAQS.filter(f => f.cat === id).length}
                  </span>
                </button>
              ))}
            </nav>

            <div className="fq-contact-card">
              <MessageCircle size={24} />
              <h3>Still stuck?</h3>
              <p>Our team responds within 24 hours.</p>
              <Link to="/contact" className="fq-contact-btn">Contact Support <ArrowRight size={14} /></Link>
            </div>
          </aside>

          {/* FAQ list */}
          <div className="fq-main">
            {search && (
              <div className="fq-results-label">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="fq-empty">
                <Search size={48} />
                <h3>No results found</h3>
                <p>Try a different search term or browse all categories.</p>
                <button className="fq-reset-btn" onClick={() => { setSearch(''); setCat('All'); }}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="fq-list">
                {filtered.map((f, i) => (
                  <div key={i} className={`fq-item ${open === i ? 'open' : ''}`}>
                    <button className="fq-question" onClick={() => setOpen(open === i ? null : i)}>
                      <div className="fq-question-inner">
                        <span className="fq-cat-pill">{f.cat}</span>
                        <span className="fq-q-text">{f.q}</span>
                      </div>
                      <ChevronDown size={18} className="fq-chevron" />
                    </button>
                    {open === i && (
                      <div className="fq-answer">
                        <p>{f.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="fq-cta">
        <div className="fq-cta-inner">
          <h2>Ready to get started?</h2>
          <p>Join Alaska's premier fishery intelligence platform.</p>
          <div className="fq-cta-btns">
            <Link to="/signup" className="co-btn-primary">Get Started <ArrowRight size={16} /></Link>
            <Link to="/pricing" className="co-btn-ghost">View Pricing</Link>
          </div>
        </div>
      </section>

    </div>
  );
};
