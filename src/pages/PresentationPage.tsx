import { Icon } from '../components/Icon';

export const PresentationPage = () => {
  return (
    <div className="presentation-page">
      <section className="presentation-hero">
        <div className="presentation-hero-content">
          <div className="announcement-badge">
            <Icon name="target" size={32} />
            <span>UPCOMING EVENT</span>
          </div>
          <h1>SeaScope Live Presentation</h1>
          <p className="presentation-subtitle">Coming to Anchorage, Alaska</p>
        </div>
      </section>

      <section className="presentation-details">
        <div className="details-container">
          <div className="detail-card">
            <div style={{ fontSize: '48px' }}>🇺🇸</div>
            <h3>Location</h3>
            <p>Anchorage, Alaska, USA</p>
            <p className="detail-note">Venue details to be announced</p>
          </div>

          <div className="detail-card">
            <Icon name="calendar" size={48} />
            <h3>Date</h3>
            <p>Coming Soon</p>
            <p className="detail-note">Stay tuned for announcement</p>
          </div>

          <div className="detail-card">
            <Icon name="user" size={48} />
            <h3>Presenter</h3>
            <p>Pyron Company Team</p>
            <p className="detail-note">K. van Beek & M. Polar & Co.</p>
          </div>
        </div>
      </section>

      <section className="presentation-about">
        <div className="about-content">
          <h2>About the Presentation</h2>
          <p>
            We're bringing SeaScope directly to Alaska's fishing community! Join us in Anchorage 
            for an exclusive live demonstration of Alaska's premier fishery intelligence platform.
          </p>

          <div className="presentation-highlights">
            <h3>What You'll Experience</h3>
            <div className="highlights-grid">
              <div className="highlight-item">
                <Icon name="lightbulb" size={32} />
                <h4>Live Product Demo</h4>
                <p>See SeaScope in action with real Alaska fishery data</p>
              </div>

              <div className="highlight-item">
                <Icon name="chart" size={32} />
                <h4>Data Analytics Showcase</h4>
                <p>Discover how to leverage trends and predictions</p>
              </div>

              <div className="highlight-item">
                <Icon name="map" size={32} />
                <h4>Interactive Mapping</h4>
                <p>Explore the powerful visualization features</p>
              </div>

              <div className="highlight-item">
                <Icon name="user" size={32} />
                <h4>Q&A Session</h4>
                <p>Get your questions answered by our experts</p>
              </div>

              <div className="highlight-item">
                <Icon name="target" size={32} />
                <h4>Partnership Opportunities</h4>
                <p>Learn about collaboration and integration options</p>
              </div>

              <div className="highlight-item">
                <Icon name="checkCircle" size={32} />
                <h4>Exclusive Offers</h4>
                <p>Special pricing for Alaska-based organizations</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="presentation-audience">
        <div className="audience-content">
          <h2>Who Should Attend</h2>
          <div className="audience-grid">
            <div className="audience-card">
              <Icon name="fish" size={40} />
              <h3>Commercial Fishermen</h3>
              <p>Optimize your operations with real-time data and tide predictions</p>
            </div>

            <div className="audience-card">
              <Icon name="building" size={40} />
              <h3>Fishery Managers</h3>
              <p>Enhance decision-making with comprehensive analytics</p>
            </div>

            <div className="audience-card">
              <Icon name="chart" size={40} />
              <h3>Marine Biologists</h3>
              <p>Access powerful research tools and historical data</p>
            </div>

            <div className="audience-card">
              <Icon name="globe" size={40} />
              <h3>ADF&G Officials</h3>
              <p>Explore collaboration opportunities and data integration</p>
            </div>

            <div className="audience-card">
              <Icon name="target" size={40} />
              <h3>Hatchery Operators</h3>
              <p>Track releases and monitor program effectiveness</p>
            </div>

            <div className="audience-card">
              <Icon name="user" size={40} />
              <h3>Industry Stakeholders</h3>
              <p>Learn how SeaScope supports sustainable fishing</p>
            </div>
          </div>
        </div>
      </section>

      <section className="presentation-register">
        <div className="register-content">
          <h2>Register Your Interest</h2>
          <p>
            Be the first to know when registration opens. Leave your contact information 
            and we'll notify you with event details.
          </p>

          <form className="register-form">
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input type="text" placeholder="Your name" />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="your.email@example.com" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Organization</label>
                <input type="text" placeholder="Company or institution" />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select>
                  <option value="">Select your role</option>
                  <option value="fisherman">Commercial Fisherman</option>
                  <option value="manager">Fishery Manager</option>
                  <option value="biologist">Marine Biologist</option>
                  <option value="official">Government Official</option>
                  <option value="operator">Hatchery Operator</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Message (Optional)</label>
              <textarea placeholder="Any questions or special interests?"></textarea>
            </div>

            <button type="submit" className="register-btn">
              <Icon name="send" size={20} />
              Notify Me
            </button>
          </form>
        </div>
      </section>

      <section className="presentation-contact">
        <div className="contact-content">
          <h2>Questions About the Event?</h2>
          <p>Contact our team for more information about the Anchorage presentation.</p>
          
          <div className="contact-methods">
            <div className="contact-method">
              <Icon name="envelope" size={32} />
              <h4>Email</h4>
              <p>info@pyroncompany.com</p>
            </div>

            <div className="contact-method">
              <Icon name="globe" size={32} />
              <h4>Website</h4>
              <p>www.getseascope.com</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
