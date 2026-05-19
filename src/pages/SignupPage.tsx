import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { Lock, Mail, User, Anchor } from 'lucide-react';

export const SignupPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { register, loginWithGoogle, error } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await register(formData.email, formData.password, formData.name);
      navigate('/login');
    } catch (err: any) {
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/map');
    } catch (err: any) {
      console.error('Google signup error:', err);
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
          alt="Alaska fishing" 
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
              <span>START FREE TRIAL</span>
            </div>
            <h1>Create Account</h1>
            <p>Join Alaska's premier fishery intelligence platform</p>
          </div>
          
          {error && (
            <div className="modern-error-message">
              {error}
            </div>
          )}
          
          <form className="modern-auth-form" onSubmit={handleSubmit}>
            <div className="modern-input-group">
              <label htmlFor="name">
                <User size={16} />
                <span>Full Name</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="modern-input-group">
              <label htmlFor="email">
                <Mail size={16} />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div className="modern-input-group">
              <label htmlFor="password">
                <Lock size={16} />
                <span>Password</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
                required
              />
            </div>

            <div className="modern-input-group">
              <label htmlFor="confirmPassword">
                <Lock size={16} />
                <span>Confirm Password</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                required
              />
            </div>

            <button type="submit" className="modern-submit-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <div className="modern-auth-divider">
              <span>Or continue with</span>
            </div>

            <button
              type="button"
              className="modern-google-btn"
              onClick={handleGoogleSignup}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Icon name="loader" size={20} />
              ) : (
                <>
                  <Icon name="google" size={20} />
                  <span>Google</span>
                </>
              )}
            </button>
          </form>

          <div className="modern-auth-footer">
            <p>Already have an account? <Link to="/login">Sign in</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};
