import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Banner } from './components/Banner';
import { HomePage } from './pages/HomePage';
import MapPage from './pages/MapPage';
import { TrendsPage } from './pages/TrendsPage';
import { PricingPage } from './pages/PricingPage';
import { CompanyPage } from './pages/CompanyPage';
import { FAQPage } from './pages/FAQPage';
import { ContactPage } from './pages/ContactPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosterPage } from './pages/PosterPage';
import { PresentationPage } from './pages/PresentationPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { CookiePage } from './pages/CookiePage';
import { TermsPage } from './pages/TermsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CommercialFishingPage } from './pages/CommercialFishingPage';
import { ResearchPage } from './pages/ResearchPage';
import { TutorialsPage } from './pages/TutorialsPage';
import { MovementsPage } from './pages/MovementsPage';
import { FirebaseAuthProvider } from './contexts/FirebaseAuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import './styles/reset.css';
import './styles/variables.css';
import './styles/design-system.css';
import './styles/animations.css';
import './styles/n8n-global.css';
import './styles/modern-header.css';
import './styles/n8n-footer.css';
import './styles/n8n-homepage.css';
import './styles/n8n-auth.css';
import './styles/n8n-map.css';
import './styles/n8n-pricing.css';
import './styles/n8n-pages.css';
import './styles/n8n-trends.css';
import './styles/dashboard.css';
import './styles/pages.css';
import './styles/premium-home.css';
import './styles/movements-intelligence.css';
import './styles/map-page.css';

function App() {
  return (
    <FirebaseAuthProvider>
      <div className="app">
        <Banner
          message="🐟 Live Mark Recovery Data Now Integrated — View Recovery Locations on the Map"
          type="promo"
          link={{
            text: "Open Map",
            url: "/map"
          }}
        />
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
            <Route path="/trends" element={<ProtectedRoute><TrendsPage /></ProtectedRoute>} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/company" element={<CompanyPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/poster" element={<PosterPage />} />
            <Route path="/presentation" element={<PresentationPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/solutions/commercial" element={<CommercialFishingPage />} />
            <Route path="/solutions/research" element={<ResearchPage />} />
            <Route path="/tutorials" element={<TutorialsPage />} />
            <Route path="/movements" element={<ProtectedRoute><MovementsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </FirebaseAuthProvider>
  );
}

export default App;
