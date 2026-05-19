import { PlayCircle, Clock, BookOpen } from 'lucide-react';

const TUTORIALS = [
  {
    id: 1,
    title: 'Getting Started with SeaScope',
    description: 'A complete walkthrough of the platform — from signing up to navigating your first live map.',
    duration: 'Coming soon',
    videoUrl: null,
  },
  {
    id: 2,
    title: 'Using the Interactive Map',
    description: 'Learn how to read district boundaries, filter by species, and interpret live ADF&G data on the map.',
    duration: 'Coming soon',
    videoUrl: null,
  },
  {
    id: 3,
    title: 'Analytics & Trends Deep Dive',
    description: 'How to use the Trends page to analyze species data, compare regions, and export reports.',
    duration: 'Coming soon',
    videoUrl: null,
  },
  {
    id: 4,
    title: 'Understanding Tide Data',
    description: 'How to read NOAA tide predictions and use them to plan your fishing operations.',
    duration: 'Coming soon',
    videoUrl: null,
  },
];

export const TutorialsPage = () => (
  <div className="fq-page">
    <section className="fq-hero">
      <div className="fq-hero-glow" />
      <div className="fq-hero-inner">
        <h1>Tutorials</h1>
        <p>Video guides to help you get the most out of SeaScope</p>
      </div>
    </section>

    <section className="fq-body">
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2rem 5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
          {TUTORIALS.map(tutorial => (
            <div key={tutorial.id} className="co-value-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: 'rgba(0,191,255,0.06)',
                border: '1px solid rgba(0,191,255,0.15)',
                borderRadius: '0.875rem',
                aspectRatio: '16/9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '0.75rem',
                color: 'rgba(255,255,255,0.3)',
              }}>
                {tutorial.videoUrl ? (
                  <iframe
                    src={tutorial.videoUrl}
                    title={tutorial.title}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: '0.875rem' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
                    <PlayCircle size={40} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Video coming soon</span>
                  </>
                )}
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem' }}>{tutorial.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', margin: '0 0 0.75rem', lineHeight: 1.6 }}>{tutorial.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                  <Clock size={13} />
                  <span>{tutorial.duration}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '3rem', padding: '2rem', background: 'rgba(13,33,55,0.7)', border: '1px solid rgba(0,191,255,0.15)', borderRadius: '1rem', textAlign: 'center' }}>
          <BookOpen size={32} style={{ color: 'var(--ocean-accent)', marginBottom: '1rem' }} />
          <h3 style={{ color: '#fff', margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}>More tutorials on the way</h3>
          <p style={{ color: 'rgba(255,255,255,0.55)', margin: 0, fontSize: '0.9rem' }}>
            We're recording step-by-step guides to help you get the most out of every feature. Check back soon.
          </p>
        </div>
      </div>
    </section>
  </div>
);
