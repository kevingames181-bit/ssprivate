import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { Lock, Mail, Anchor } from 'lucide-react';

export const LoginPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      navigate('/map');
    } catch (err: any) {
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/map');
    } catch (err: any) {
      console.error('Google login error:', err);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="modern-auth-page">
      <div className="modern-auth-bg">
        <div className="modern-auth-gradient"></div>
        <div className="modern-auth-pattern"></div>
        <img 
          src="/images/hero-illustration.svg" 
          alt="Alaska waters" 
          className="auth-bg-image"
        />
      </div>
      
      <div className="modern-auth-container">
        <div className="modern-auth-card">
          <div className="modern-auth-brand">
            <img 
              src="/images/common-logo.png" 
              alt="SeaScope Logo" 
              className="auth-logo"
            />
          </div>

          <div className="modern-auth-header">
            <div className="auth-badge">
              <Anchor size={16} />
              <span>{t('auth.login.badge')}</span>
            </div>
            <h1>{t('auth.login.title')}</h1>
            <p>{t('auth.login.subtitle')}</p>
          </div>
          
          {error && (
            <div className="modern-error-message">
              {error}
            </div>
          )}
          
          <form className="modern-auth-form" onSubmit={handleSubmit}>
            <div className="modern-input-group">
              <label htmlFor="email">
                <Mail size={16} />
                <span>{t('auth.login.email')}</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div className="modern-input-group">
              <div className="modern-label-row">
                <label htmlFor="password">
                  <Lock size={16} />
                  <span>{t('auth.login.password')}</span>
                </label>
                <Link to="/forgot-password" className="modern-forgot-link">
                  {t('auth.login.forgot')}
                </Link>
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" className="modern-submit-btn" disabled={loading}>
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>

            <div className="modern-auth-divider">
              <span>{t('auth.login.divider')}</span>
            </div>

            <button
              type="button"
              className="modern-google-btn"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Icon name="loader" size={20} />
              ) : (
                <>
                  <Icon name="google" size={20} />
                  <span>{t('auth.login.google')}</span>
                </>
              )}
            </button>
          </form>

          <div className="modern-auth-footer">
            <p>{t('auth.login.noAccount')} <Link to="/signup">{t('auth.login.createAccount')}</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};
