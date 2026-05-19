/**
 * Header — Two-tier Princess-style navbar adapted for SeaScope.
 *
 * Tier 1 (top bar):   Logo · utility links (Special Offers, Deals) · auth actions
 * Tier 2 (nav bar):   Primary navigation links with mega-dropdown
 *
 * Dark navy theme with blue glow accents, matching the marine intelligence UI.
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import '../styles/language-switcher.css';

// ─── Nav data ─────────────────────────────────────────────────────────────────

interface NavSubItem {
  title: string;
  link: string;
  description?: string;
  badge?: string;
}

interface NavItem {
  title: string;
  items: NavSubItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    title: 'Platform',
    items: [
      { title: 'Map View', link: '/map', description: 'Live hatchery releases & recovery locations' },
      { title: 'Fish Movements', link: '/movements', description: 'Animated salmon migration paths', badge: 'LIVE' },
      { title: 'Analytics', link: '/trends', description: 'Trends, charts & species data' },
    ],
  },
  {
    title: 'Solutions',
    items: [
      { title: 'Commercial Fishing', link: '/solutions/commercial', description: 'Fleet intelligence & catch planning' },
      { title: 'Research', link: '/solutions/research', description: 'Scientific data access & export' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { title: 'Documentation', link: '/faq', description: 'API docs, guides & FAQs' },
      { title: 'Tutorials', link: '/tutorials', description: 'Step-by-step walkthroughs' },
    ],
  },
  {
    title: 'Company',
    items: [
      { title: 'About', link: '/company', description: 'Our mission & team' },
      { title: 'Contact', link: '/contact', description: 'Get in touch' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(true);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ── Scroll detection ────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Theme ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    document.body.style.background = darkMode ? '' : '#f0f4f8';
  }, [darkMode]);

  // ── Close menus on route change ─────────────────────────────────────────────
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
    setUserMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // ── Close user menu on outside click ───────────────────────────────────────
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  // ── Dropdown hover with delay ───────────────────────────────────────────────
  function handleNavEnter(idx: number) {
    if (dropdownTimerRef.current) clearTimeout(dropdownTimerRef.current);
    setOpenDropdown(idx);
  }

  function handleNavLeave() {
    dropdownTimerRef.current = setTimeout(() => setOpenDropdown(null), 120);
  }

  function handleDropdownEnter() {
    if (dropdownTimerRef.current) clearTimeout(dropdownTimerRef.current);
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/faq?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  // ── Active link check ───────────────────────────────────────────────────────
  function isActive(link: string) {
    return location.pathname === link || location.pathname.startsWith(link + '/');
  }

  function isGroupActive(items: NavSubItem[]) {
    return items.some(i => isActive(i.link));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <header className={`ss-header${scrolled ? ' scrolled' : ''}`}>

      {/* ── Tier 1: Top utility bar ─────────────────────────────────────── */}
      <div className="ss-topbar">
        <div className="ss-topbar-inner">

          {/* Logo */}
          <Link to="/" className="ss-logo" aria-label="SeaScope home">
            <img
              src="/images/common-logo.png"
              alt="SeaScope"
              className="ss-logo-img"
            />
          </Link>

          {/* Utility links */}
          <div className="ss-topbar-utils">
            <Link to="/movements" className="ss-util-link">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="7" cy="7" r="2.5" fill="currentColor"/>
              </svg>
              Live Movements
            </Link>
            <Link to="/pricing" className="ss-util-link">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Pricing
            </Link>
            <LanguageSwitcher />
          </div>

          {/* Auth + actions */}
          <div className="ss-topbar-actions">
            {/* Search */}
            <div className="ss-search-wrap">
              <button
                className="ss-icon-btn"
                aria-label="Search"
                onClick={() => setSearchOpen(s => !s)}
              >
                <Icon name="search" size={16} />
              </button>
              {searchOpen && (
                <form onSubmit={handleSearch} className="ss-search-form" role="search">
                  <input
                    type="search"
                    placeholder="Search SeaScope..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                    className="ss-search-input"
                    aria-label="Search"
                  />
                  <button type="submit" className="ss-search-go">Go</button>
                  <button
                    type="button"
                    className="ss-search-close"
                    onClick={() => setSearchOpen(false)}
                    aria-label="Close search"
                  >
                    ✕
                  </button>
                </form>
              )}
            </div>

            {/* Theme toggle */}
            <button
              className="ss-icon-btn"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setDarkMode(d => !d)}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              <Icon name={darkMode ? 'sun' : 'moon'} size={16} />
            </button>

            {/* Divider */}
            <span className="ss-topbar-divider" aria-hidden="true" />

            {user ? (
              <div className="ss-user-menu" ref={userMenuRef}>
                <button
                  className="ss-user-btn"
                  onClick={() => setUserMenuOpen(o => !o)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <span className="ss-user-avatar" aria-hidden="true">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </span>
                  <span className="ss-user-name">{user.displayName || 'Account'}</span>
                  <Icon name="chevron-down" size={12} />
                </button>

                {userMenuOpen && (
                  <div className="ss-user-dropdown" role="menu">
                    <div className="ss-user-dropdown-header">
                      <span className="ss-user-dropdown-name">{user.displayName || 'User'}</span>
                      <span className="ss-user-dropdown-email">{user.email}</span>
                    </div>
                    <div className="ss-user-dropdown-body">
                      <button
                        role="menuitem"
                        onClick={() => { setUserMenuOpen(false); navigate('/dashboard'); }}
                        className="ss-user-dropdown-item"
                      >
                        <Icon name="user" size={14} />
                        Dashboard
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { setUserMenuOpen(false); navigate('/map'); }}
                        className="ss-user-dropdown-item"
                      >
                        <Icon name="map" size={14} />
                        Map View
                      </button>
                      <div className="ss-user-dropdown-divider" />
                      <button
                        role="menuitem"
                        onClick={handleLogout}
                        className="ss-user-dropdown-item ss-user-dropdown-logout"
                      >
                        <Icon name="log-out" size={14} />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ss-auth-btns">
                <button
                  className="ss-topbar-auth-link"
                  onClick={() => navigate('/login')}
                >
                  <Icon name="user" size={14} />
                  Log In
                </button>
                <span className="ss-topbar-divider" aria-hidden="true" />
                <Link to="/signup" className="ss-topbar-auth-link ss-topbar-auth-link--signup">
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tier 2: Primary navigation bar ─────────────────────────────── */}
      <nav className="ss-navbar" aria-label="Primary navigation">
        <div className="ss-navbar-inner">

          {/* Desktop nav */}
          <ul className="ss-nav-list" role="list">
            {NAV_ITEMS.map((item, idx) => (
              <li
                key={idx}
                className={`ss-nav-item${openDropdown === idx ? ' open' : ''}${isGroupActive(item.items) ? ' active-group' : ''}`}
                onMouseEnter={() => handleNavEnter(idx)}
                onMouseLeave={handleNavLeave}
              >
                <button
                  className={`ss-nav-btn${isGroupActive(item.items) ? ' active' : ''}`}
                  aria-expanded={openDropdown === idx}
                  aria-haspopup="true"
                >
                  {item.title}
                  <svg
                    className="ss-nav-chevron"
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Dropdown */}
                <div
                  className="ss-dropdown"
                  onMouseEnter={handleDropdownEnter}
                  onMouseLeave={handleNavLeave}
                  role="menu"
                  aria-label={`${item.title} submenu`}
                >
                  <div className="ss-dropdown-inner">
                    {item.items.map((sub, sIdx) => (
                      <Link
                        key={sIdx}
                        to={sub.link}
                        className={`ss-dropdown-item${isActive(sub.link) ? ' active' : ''}`}
                        role="menuitem"
                      >
                        <span className="ss-dropdown-item-title">
                          {sub.title}
                          {sub.badge && (
                            <span className="ss-dropdown-badge">{sub.badge}</span>
                          )}
                        </span>
                        {sub.description && (
                          <span className="ss-dropdown-item-desc">{sub.description}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              </li>
            ))}

            {/* Direct links */}
            <li className="ss-nav-item">
              <Link
                to="/dashboard"
                className={`ss-nav-btn ss-nav-direct${isActive('/dashboard') ? ' active' : ''}`}
              >
                Dashboard
              </Link>
            </li>
          </ul>

          {/* Right side CTA */}
          <div className="ss-navbar-cta">
            {!user && (
              <Link to="/signup" className="ss-cta-btn">
                Get started free
              </Link>
            )}
            {user && (
              <Link to="/map" className="ss-cta-btn">
                Open Map
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="ss-mobile-toggle"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <span className={`ss-hamburger${mobileMenuOpen ? ' open' : ''}`} aria-hidden="true">
              <span /><span /><span />
            </span>
          </button>
        </div>
      </nav>

      {/* ── Mobile menu ─────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="ss-mobile-menu" role="dialog" aria-label="Mobile navigation">
          <div className="ss-mobile-menu-inner">
            {NAV_ITEMS.map((item, idx) => (
              <div key={idx} className="ss-mobile-section">
                <div className="ss-mobile-section-title">{item.title}</div>
                {item.items.map((sub, sIdx) => (
                  <Link
                    key={sIdx}
                    to={sub.link}
                    className={`ss-mobile-link${isActive(sub.link) ? ' active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {sub.title}
                    {sub.badge && <span className="ss-mobile-badge">{sub.badge}</span>}
                  </Link>
                ))}
              </div>
            ))}

            <div className="ss-mobile-section">
              <div className="ss-mobile-section-title">More</div>
              <Link to="/pricing" className="ss-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </Link>
              <Link to="/dashboard" className="ss-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                Dashboard
              </Link>
            </div>

            <div className="ss-mobile-footer">
              {user ? (
                <div className="ss-mobile-user">
                  <div className="ss-mobile-user-info">
                    <span className="ss-mobile-user-name">{user.displayName || 'User'}</span>
                    <span className="ss-mobile-user-email">{user.email}</span>
                  </div>
                  <button onClick={handleLogout} className="ss-mobile-logout">
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="ss-mobile-auth">
                  <Link to="/login" className="ss-mobile-login" onClick={() => setMobileMenuOpen(false)}>
                    Log In
                  </Link>
                  <Link to="/signup" className="ss-mobile-signup" onClick={() => setMobileMenuOpen(false)}>
                    Create account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
