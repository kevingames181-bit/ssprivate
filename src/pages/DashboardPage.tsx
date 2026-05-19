import { useAuth } from '../contexts/FirebaseAuthContext';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Activity, 
  TrendingUp, 
  MapPin, 
  Bell,
  Settings,
  CreditCard,
  FileText,
  LogOut
} from 'lucide-react';
import { Link } from 'react-router-dom';
import '../styles/dashboard.css';

export const DashboardPage = () => {
  const { user, logout } = useAuth();

  const stats = [
    {
      icon: Activity,
      label: 'Active Sessions',
      value: '1',
      change: '+0%',
      color: 'blue'
    },
    {
      icon: MapPin,
      label: 'Saved Locations',
      value: '12',
      change: '+3',
      color: 'green'
    },
    {
      icon: TrendingUp,
      label: 'Data Queries',
      value: '847',
      change: '+24%',
      color: 'purple'
    },
    {
      icon: Bell,
      label: 'Active Alerts',
      value: '5',
      change: '+2',
      color: 'orange'
    }
  ];

  const quickActions = [
    { icon: MapPin, label: 'View Map', link: '/map', color: 'blue' },
    { icon: TrendingUp, label: 'Analytics', link: '/trends', color: 'purple' },
    { icon: Bell, label: 'Alerts', link: '/dashboard', color: 'orange' },
    { icon: Settings, label: 'Settings', link: '/dashboard', color: 'gray' }
  ];

  const recentActivity = [
    { action: 'Viewed Bristol Bay data', time: '2 hours ago', icon: MapPin },
    { action: 'Updated alert preferences', time: '5 hours ago', icon: Bell },
    { action: 'Exported catch report', time: '1 day ago', icon: FileText },
    { action: 'Checked weather forecast', time: '2 days ago', icon: Activity }
  ];

  return (
    <div className="dashboard-page-modern">
      {/* Hero Section */}
      <section className="dashboard-hero">
        <div className="dashboard-hero-bg">
          <div className="dashboard-hero-gradient"></div>
        </div>
        
        <div className="dashboard-container">
          <div className="dashboard-welcome">
            <div className="welcome-text">
              <h1>Welcome back, {user?.displayName || 'Fisherman'}!</h1>
              <p>Here's what's happening with your account today</p>
            </div>
            <div className="welcome-actions">
              <Link to="/map" className="dashboard-btn-primary">
                <MapPin size={18} />
                <span>View Map</span>
              </Link>
              <button className="dashboard-btn-secondary" onClick={logout}>
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="dashboard-stats">
        <div className="dashboard-container">
          <div className="stats-grid-dashboard">
            {stats.map((stat, idx) => (
              <div key={idx} className={`stat-card-dashboard ${stat.color}`}>
                <div className="stat-icon-wrapper">
                  <stat.icon size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-change">{stat.change}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="dashboard-content">
        <div className="dashboard-container">
          <div className="dashboard-grid">
            {/* Account Info */}
            <div className="dashboard-card">
              <div className="card-header">
                <User size={20} />
                <h2>Account Information</h2>
              </div>
              <div className="card-body">
                <div className="info-row">
                  <div className="info-icon">
                    <Mail size={18} />
                  </div>
                  <div className="info-content">
                    <div className="info-label">Email</div>
                    <div className="info-value">{user?.email}</div>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-icon">
                    <User size={18} />
                  </div>
                  <div className="info-content">
                    <div className="info-label">Name</div>
                    <div className="info-value">{user?.displayName || 'Not set'}</div>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-icon">
                    <Shield size={18} />
                  </div>
                  <div className="info-content">
                    <div className="info-label">Email Verified</div>
                    <div className="info-value">
                      <span className={`status-badge ${user?.emailVerified ? 'verified' : 'unverified'}`}>
                        {user?.emailVerified ? 'Verified' : 'Not Verified'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-icon">
                    <Calendar size={18} />
                  </div>
                  <div className="info-content">
                    <div className="info-label">Member Since</div>
                    <div className="info-value">{new Date().toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
              <div className="card-footer">
                <button className="card-action-btn">
                  <Settings size={16} />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="dashboard-card">
              <div className="card-header">
                <Activity size={20} />
                <h2>Quick Actions</h2>
              </div>
              <div className="card-body">
                <div className="quick-actions-grid">
                  {quickActions.map((action, idx) => (
                    <Link 
                      key={idx} 
                      to={action.link} 
                      className={`quick-action-btn ${action.color}`}
                    >
                      <action.icon size={24} />
                      <span>{action.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="dashboard-card full-width">
              <div className="card-header">
                <Activity size={20} />
                <h2>Recent Activity</h2>
              </div>
              <div className="card-body">
                <div className="activity-list">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="activity-item">
                      <div className="activity-icon">
                        <activity.icon size={18} />
                      </div>
                      <div className="activity-content">
                        <div className="activity-action">{activity.action}</div>
                        <div className="activity-time">{activity.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subscription Info */}
            <div className="dashboard-card">
              <div className="card-header">
                <CreditCard size={20} />
                <h2>Subscription</h2>
              </div>
              <div className="card-body">
                <div className="subscription-info">
                  <div className="subscription-plan">
                    <div className="plan-name">Free Trial</div>
                    <div className="plan-status">Active</div>
                  </div>
                  <div className="subscription-details">
                    <p>14 days remaining</p>
                    <p className="subscription-note">Upgrade to unlock all features</p>
                  </div>
                </div>
              </div>
              <div className="card-footer">
                <Link to="/pricing" className="card-action-btn primary">
                  <TrendingUp size={16} />
                  <span>Upgrade Plan</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
