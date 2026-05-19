export const CookiePage = () => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Cookie Policy</h1>
        <p className="last-updated">Last Updated: February 17, 2026</p>

        <section className="legal-section">
          <h2>1. What Are Cookies</h2>
          <p>
            Cookies are small text files stored on your device when you visit our website. They help 
            us provide you with a better experience by remembering your preferences and understanding 
            how you use our platform.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Types of Cookies We Use</h2>
          
          <h3>Essential Cookies</h3>
          <p>Required for the platform to function properly. These cannot be disabled.</p>
          <ul>
            <li><strong>Authentication:</strong> Keep you logged in to your account</li>
            <li><strong>Security:</strong> Protect against fraudulent activity</li>
            <li><strong>Session Management:</strong> Maintain your session state</li>
          </ul>

          <h3>Performance Cookies</h3>
          <p>Help us understand how visitors interact with our platform.</p>
          <ul>
            <li><strong>Analytics:</strong> Track page views and user behavior</li>
            <li><strong>Error Tracking:</strong> Identify and fix technical issues</li>
            <li><strong>Load Times:</strong> Monitor platform performance</li>
          </ul>

          <h3>Functional Cookies</h3>
          <p>Remember your preferences and settings.</p>
          <ul>
            <li><strong>Language Preferences:</strong> Remember your language choice</li>
            <li><strong>Display Settings:</strong> Save your map view preferences</li>
            <li><strong>Filter Selections:</strong> Remember your data filters</li>
          </ul>

          <h3>Marketing Cookies</h3>
          <p>Used to deliver relevant advertisements and track campaign effectiveness.</p>
          <ul>
            <li><strong>Advertising:</strong> Show relevant ads based on your interests</li>
            <li><strong>Social Media:</strong> Enable sharing on social platforms</li>
            <li><strong>Campaign Tracking:</strong> Measure marketing effectiveness</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. Third-Party Cookies</h2>
          <p>We use services from trusted third parties that may set cookies:</p>
          <ul>
            <li><strong>Google Analytics:</strong> Website traffic analysis</li>
            <li><strong>Stripe:</strong> Payment processing</li>
            <li><strong>Leaflet/Mapbox:</strong> Interactive mapping services</li>
            <li><strong>Social Media Platforms:</strong> Sharing and integration features</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Cookie Duration</h2>
          <ul>
            <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
            <li><strong>Persistent Cookies:</strong> Remain for a set period (typically 1-12 months)</li>
            <li><strong>Authentication Cookies:</strong> Last up to 30 days</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. Managing Cookies</h2>
          <p>You can control cookies through:</p>
          
          <h3>Browser Settings</h3>
          <p>Most browsers allow you to:</p>
          <ul>
            <li>View and delete cookies</li>
            <li>Block third-party cookies</li>
            <li>Block all cookies (may affect functionality)</li>
            <li>Clear cookies when closing the browser</li>
          </ul>

          <h3>Our Cookie Preferences</h3>
          <p>
            You can manage your cookie preferences through our Cookie Settings panel, 
            accessible from the footer of any page.
          </p>

          <h3>Opt-Out Tools</h3>
          <ul>
            <li><strong>Google Analytics:</strong> <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Opt-out browser add-on</a></li>
            <li><strong>Network Advertising:</strong> <a href="http://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer">NAI opt-out</a></li>
            <li><strong>Digital Advertising:</strong> <a href="http://optout.aboutads.info/" target="_blank" rel="noopener noreferrer">DAA opt-out</a></li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>6. Do Not Track Signals</h2>
          <p>
            We currently do not respond to Do Not Track (DNT) browser signals. We will update 
            this policy if we implement DNT support in the future.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Mobile Devices</h2>
          <p>
            Mobile apps may use similar tracking technologies. You can manage these through 
            your device settings:
          </p>
          <ul>
            <li><strong>iOS:</strong> Settings → Privacy → Tracking</li>
            <li><strong>Android:</strong> Settings → Google → Ads</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>8. Impact of Disabling Cookies</h2>
          <p>Disabling cookies may affect your experience:</p>
          <ul>
            <li>You may need to log in repeatedly</li>
            <li>Preferences and settings won't be saved</li>
            <li>Some features may not function properly</li>
            <li>Personalized content will be limited</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>9. Updates to This Policy</h2>
          <p>
            We may update this Cookie Policy to reflect changes in technology or regulations. 
            Check this page periodically for updates.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Contact Us</h2>
          <p>For questions about our use of cookies:</p>
          <ul>
            <li><strong>Email:</strong> privacy@pyroncompany.com</li>
            <li><strong>Website:</strong> www.getseascope.com</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
