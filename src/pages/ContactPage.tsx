import { useState } from 'react';
import { Mail, MapPin, Clock, Send, CheckCircle2, HelpCircle, ArrowRight, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

const TOPICS = [
  { value: '', label: 'Select a topic' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'support', label: 'Technical Support' },
  { value: 'sales', label: 'Sales & Pricing' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Other' },
];

export const ContactPage = () => {
  const [form, setForm] = useState({ name: '', email: '', company: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setSent(true);
    setLoading(false);
    setTimeout(() => {
      setSent(false);
      setForm({ name: '', email: '', company: '', subject: '', message: '' });
    }, 6000);
  };

  return (
    <div className="cn-page">

      {/* ── HERO ── */}
      <section className="cn-hero">
        <div className="cn-hero-glow" />
        <div className="cn-hero-inner">
          <div className="cn-hero-icon-wrap">
            <MessageSquare size={28} />
          </div>
          <h1>Get in touch</h1>
          <p>Questions, feedback, or partnership inquiries — we're here.</p>
        </div>
      </section>

      {/* ── MAIN ── */}
      <section className="cn-body">
        <div className="cn-wrap">

          {/* Form */}
          <div className="cn-form-col">
            {sent ? (
              <div className="cn-success">
                <CheckCircle2 size={52} />
                <h2>Message sent!</h2>
                <p>Thanks for reaching out. We'll get back to you within 24 hours on business days.</p>
                <button className="cn-success-btn" onClick={() => setSent(false)}>Send another</button>
              </div>
            ) : (
              <>
                <div className="cn-form-head">
                  <h2>Send us a message</h2>
                  <p>We respond within 24 hours on business days.</p>
                </div>
                <form className="cn-form" onSubmit={handleSubmit}>
                  <div className="cn-row">
                    <div className="cn-field">
                      <label htmlFor="cn-name">Full Name *</label>
                      <input id="cn-name" name="name" type="text" placeholder="John Doe" value={form.name} onChange={handleChange} required />
                    </div>
                    <div className="cn-field">
                      <label htmlFor="cn-email">Email *</label>
                      <input id="cn-email" name="email" type="email" placeholder="john@example.com" value={form.email} onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="cn-row">
                    <div className="cn-field">
                      <label htmlFor="cn-company">Company / Vessel</label>
                      <input id="cn-company" name="company" type="text" placeholder="Alaska Seafood Co." value={form.company} onChange={handleChange} />
                    </div>
                    <div className="cn-field">
                      <label htmlFor="cn-subject">Topic *</label>
                      <select id="cn-subject" name="subject" value={form.subject} onChange={handleChange} required>
                        {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="cn-field cn-field--full">
                    <label htmlFor="cn-message">Message *</label>
                    <textarea id="cn-message" name="message" rows={5} placeholder="How can we help?" value={form.message} onChange={handleChange} required />
                  </div>
                  <button type="submit" className="cn-submit" disabled={loading}>
                    {loading
                      ? <><span className="cn-spinner" />Sending...</>
                      : <><Send size={17} />Send Message</>
                    }
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Info sidebar */}
          <aside className="cn-aside">
            <div className="cn-info-block">
              <h3>Contact info</h3>
              <div className="cn-info-list">
                <div className="cn-info-item">
                  <div className="cn-info-icon"><Mail size={18} /></div>
                  <div>
                    <strong>Email</strong>
                    <a href="mailto:support@seascope.alaska">support@seascope.us</a>
                    <span>Responds within 24 hours</span>
                  </div>
                </div>
                <div className="cn-info-item">
                  <div className="cn-info-icon"><MapPin size={18} /></div>
                  <div>
                    <strong>Location</strong>
                    <span>Anchorage, Alaska</span>
                    <span>Serving all Alaska regions</span>
                  </div>
                </div>
                <div className="cn-info-item">
                  <div className="cn-info-icon"><Clock size={18} /></div>
                  <div>
                    <strong>Business Hours</strong>
                    <span>Mon – Fri, 9 AM – 5 PM AKST</span>
                    <span>Closed weekends</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="cn-faq-card">
              <HelpCircle size={22} />
              <div>
                <strong>Looking for quick answers?</strong>
                <p>Browse our FAQ for common questions about data, pricing, and features.</p>
                <Link to="/faq" className="cn-faq-link">Visit FAQ <ArrowRight size={13} /></Link>
              </div>
            </div>

            <div className="cn-trial-card">
              <strong>Ready to get started?</strong>
              <p>Pick a plan and get access to Alaska's fishery intelligence platform today.</p>
              <Link to="/pricing" className="cn-trial-btn">View Pricing <ArrowRight size={14} /></Link>
            </div>
          </aside>

        </div>
      </section>

    </div>
  );
};
