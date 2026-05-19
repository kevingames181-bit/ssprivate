import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Zap, Building2, Sparkles, ArrowRight, MessageSquare, Star } from 'lucide-react';

const ANNUAL_DISCOUNT = 0.8; // 20% off

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    icon: Zap,
    monthly: 50,
    get annual() { return Math.round(this.monthly * ANNUAL_DISCOUNT); },
    get annualTotal() { return Math.round(this.monthly * ANNUAL_DISCOUNT * 12); },
    description: 'For independent fishermen and small operations',
    badge: null,
    color: 'default' as const,
    features: [
      'Full interactive map access',
      'Live ADF&G district data',
      'NOAA tide predictions',
      'All 5 salmon species tracking',
      '13 hatchery locations',
      '30-day release history',
      'CSV & JSON export',
      'Email support',
    ],
    cta: 'Get started',
    href: '/signup',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Building2,
    monthly: 100,
    get annual() { return Math.round(this.monthly * ANNUAL_DISCOUNT); },
    get annualTotal() { return Math.round(this.monthly * ANNUAL_DISCOUNT * 12); },
    description: 'For fleets, processors, and industry professionals',
    badge: 'Most popular',
    color: 'featured' as const,
    features: [
      'Everything in Pro',
      'All 5 Alaska regions',
      'Unlimited data history',
      'Priority API access',
      'Team collaboration (up to 10)',
      'Advanced analytics dashboard',
      'Webhook integrations',
      'Priority support',
      'Custom reporting',
    ],
    cta: 'Get started',
    href: '/signup',
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: Sparkles,
    monthly: null,
    annual: null,
    annualTotal: null,
    description: 'For large organizations with specific requirements',
    badge: null,
    color: 'default' as const,
    features: [
      'Everything in Enterprise',
      'Unlimited team members',
      'Dedicated account manager',
      'Custom data integrations',
      'On-premise deployment',
      'Custom SLA & uptime guarantee',
      'White-label options',
      '24/7 phone support',
    ],
    cta: 'Contact sales',
    href: '/contact',
  },
];

const COMPARE = [
  { feature: 'Interactive map', pro: true, ent: true, custom: true },
  { feature: 'ADF&G live districts', pro: true, ent: true, custom: true },
  { feature: 'NOAA tide data', pro: true, ent: true, custom: true },
  { feature: 'Species tracking', pro: '5 species', ent: '5 species', custom: '5 species' },
  { feature: 'Hatchery locations', pro: '13', ent: '13', custom: '13' },
  { feature: 'Data history', pro: '30 days', ent: 'Unlimited', custom: 'Unlimited' },
  { feature: 'API access', pro: false, ent: true, custom: true },
  { feature: 'Team members', pro: '1', ent: 'Up to 10', custom: 'Unlimited' },
  { feature: 'Export formats', pro: 'CSV, JSON', ent: 'CSV, JSON', custom: 'Custom' },
  { feature: 'Support', pro: 'Email', ent: 'Priority', custom: '24/7 Phone' },
  { feature: 'Custom integrations', pro: false, ent: false, custom: true },
];

const pro = PLANS[0];
const ent = PLANS[1];

const FAQS = [
  { q: 'Can I change plans later?', a: 'Yes, upgrade or downgrade anytime. Changes take effect immediately with prorated billing.' },
  { q: 'Is there a free trial?', a: 'Contact us to discuss access options and find the right plan for your operation.' },
  { q: 'What data sources does SeaScope use?', a: 'We integrate with official government and scientific data sources to provide accurate, real-time fishery intelligence.' },
  { q: 'Do you offer annual discounts?', a: `Yes — annual billing saves 20%. Pro drops from $${pro.monthly} to $${pro.annual}/mo, Enterprise from $${ent.monthly} to $${ent.annual}/mo.` },
  { q: 'What is the Custom plan?', a: 'Custom is for large organizations needing white-label options, on-premise deployment, or volume pricing.' },
  { q: 'Can I cancel anytime?', a: 'Absolutely. Cancel anytime with no penalties. Access continues until the end of your billing period.' },
];

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check size={17} className="pr-check" />;
  if (v === false) return <X size={17} className="pr-x" />;
  return <span className="pr-cell-text">{v}</span>;
}

export const PricingPage = () => {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="pr-page">

      {/* ── HERO ── */}
      <section className="pr-hero">
        <div className="pr-hero-glow" />
        <div className="pr-hero-inner">
          <div className="pr-hero-eyebrow">
            <Star size={13} />
            Simple, transparent pricing
          </div>
          <h1>Plans for every operation</h1>
          <p>Simple, transparent pricing. No hidden fees.</p>

          <div className="pr-toggle">
            <button
              className={`pr-toggle-btn ${!annual ? 'active' : ''}`}
              onClick={() => setAnnual(false)}
            >Monthly</button>
            <button
              className={`pr-toggle-btn ${annual ? 'active' : ''}`}
              onClick={() => setAnnual(true)}
            >
              Annual
              <span className="pr-save-badge">–20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── CARDS ── */}
      <section className="pr-cards">
        <div className="pr-cards-inner">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const price = plan.monthly === null ? null : annual ? plan.annual : plan.monthly;
            return (
              <div key={plan.id} className={`pr-card ${plan.color === 'featured' ? 'pr-card--featured' : ''}`}>
                {plan.badge && (
                  <div className="pr-card-badge">{plan.badge}</div>
                )}
                <div className="pr-card-head">
                  <div className="pr-card-icon"><Icon size={20} /></div>
                  <div className="pr-card-name">{plan.name}</div>
                  <div className="pr-card-desc">{plan.description}</div>
                </div>

                <div className="pr-card-price">
                  {price === null ? (
                    <span className="pr-price-custom">Custom</span>
                  ) : (
                    <>
                      <span className="pr-price-dollar">$</span>
                      <span className="pr-price-num">{price}</span>
                      <span className="pr-price-per">/mo</span>
                    </>
                  )}
                  {annual && plan.annualTotal && (
                    <div className="pr-price-note">Billed ${plan.annualTotal}/year</div>
                  )}
                </div>

                <Link
                  to={plan.href}
                  className={`pr-card-cta ${plan.color === 'featured' ? 'pr-card-cta--primary' : 'pr-card-cta--secondary'}`}
                >
                  {plan.cta} <ArrowRight size={15} />
                </Link>

                <ul className="pr-features">
                  {plan.features.map((f, i) => (
                    <li key={i}>
                      <Check size={14} className="pr-feat-check" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── COMPARE ── */}
      <section className="pr-compare">
        <div className="pr-compare-inner">
          <h2>Full feature comparison</h2>
          <p>See exactly what's included in each plan</p>
          <div className="pr-table">
            <div className="pr-table-head">
              <div className="pr-th pr-th--feature">Feature</div>
              <div className="pr-th">Pro</div>
              <div className="pr-th pr-th--hl">Enterprise</div>
              <div className="pr-th">Custom</div>
            </div>
            {COMPARE.map((row, i) => (
              <div key={i} className="pr-table-row">
                <div className="pr-td pr-td--feature">{row.feature}</div>
                <div className="pr-td"><Cell v={row.pro} /></div>
                <div className="pr-td pr-td--hl"><Cell v={row.ent} /></div>
                <div className="pr-td"><Cell v={row.custom} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="pr-faq">
        <div className="pr-faq-inner">
          <h2>Common questions</h2>
          <div className="pr-faq-grid">
            {FAQS.map((f, i) => (
              <div key={i} className="pr-faq-item">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="pr-cta">
        <div className="pr-cta-inner">
          <MessageSquare size={36} className="pr-cta-icon" />
          <h2>Still have questions?</h2>
          <p>Talk to our team — we'll help you find the right plan.</p>
          <div className="pr-cta-btns">
            <Link to="/signup" className="co-btn-primary">Get Started <ArrowRight size={16} /></Link>
            <Link to="/contact" className="co-btn-ghost">Contact sales</Link>
          </div>
        </div>
      </section>

    </div>
  );
};
