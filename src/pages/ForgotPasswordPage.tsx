import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { Mail, Anchor, CheckCircle } from 'lucide-react';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { resetPassword, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: any) {
      console.error('Reset password error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
                <CheckCircle size={16} />
                <span>EMAIL SENT</span>
              </div>
              <h1>Check Your Email</h1>
              <p>We've sent a password reset link to {email}</p>
            </div>
            
            <div className="modern-success-message">
              <CheckCircle size={48} />
              <p>Click the link in the email to reset your password.</p>
            </div>

            <div className="modern-auth-footer">
              <p>Remember your password? <Link to="/login">Sign in</Link></p>
              <p>Don't have an account? <Link to="/signup">Create one</Link></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              <span>PASSWORD RESET</span>
            </div>
            <h1>Forgot Password</h1>
            <p>Enter your email and we'll send you a reset link</p>
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
                <span>Email Address</span>
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

            <button type="submit" className="modern-submit-btn" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="modern-auth-footer">
            <p>Remember your password? <Link to="/login">Sign in</Link></p>
            <p>Don't have an account? <Link to="/signup">Create one</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};
