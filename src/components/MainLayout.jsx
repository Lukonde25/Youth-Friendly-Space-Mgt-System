/**
 * MainLayout Component
 * 
 * Main wrapper layout for pages with header, navigation, and content area
 * 
 * Usage:
 * <MainLayout
 *   title="Dashboard"
 *   subtitle="Welcome back"
 *   navItems={navItems}
 *   user={currentUser}
 * >
 *   <div>Page content here</div>
 * </MainLayout>
 */

import React, { useState } from 'react';

const getNavIcon = (label = '') => label.split(' ')[0] || '•';
const getNavText = (label = '') => label.replace(/^\S+\s*/, '');

const MainLayout = ({
  children,
  title,
  subtitle,
  navItems = [],
  user,
  onLogout,
  actions,
  showNavigation = true,
  showMobileNavigation = true,
  className = '',
  ...props
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mobileNavItems = navItems.slice(0, 4);
  const searchResults = navItems.filter((item) => (
    getNavText(item.label).toLowerCase().includes(searchQuery.trim().toLowerCase())
  ));

  const navigateTo = (item) => {
    item.onClick?.();
    setSearchQuery('');
    setIsMenuOpen(false);
  };

  return (
    <div className={`app-shell min-h-screen bg-gray-50${showNavigation ? ' has-sidebar' : ''}`}>
      {/* Header */}
      <header className="app-header bg-primary text-inverse">
        <div className="desktop-header-content container py-6">
          <div className="flex-between">
            <div className="desktop-page-title">
              {title && <h1 className="text-3xl font-bold m-0">{title}</h1>}
              {subtitle && (
                <p className="text-sm opacity-90 m-0 mt-1">{subtitle}</p>
              )}
            </div>
            <div className="flex gap-3">{actions}</div>
          </div>
        </div>
        <div className="mobile-appbar">
          {showNavigation && (
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
              onClick={() => {
                setIsMenuOpen((open) => !open);
                setIsProfileOpen(false);
              }}
            >
              <span aria-hidden="true">☰</span>
            </button>
          )}
          {showNavigation ? (
            <div className="mobile-search">
              <span className="mobile-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <circle cx="10.8" cy="10.8" r="6.8" />
                  <path d="m16 16 5 5" />
                </svg>
              </span>
              <input
                type="search"
                aria-label="Search navigation"
                placeholder="Search sections..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchQuery('');
                  if (event.key === 'Enter' && searchResults[0]) navigateTo(searchResults[0]);
                }}
              />
              {searchQuery && (
                <div className="mobile-search-results" role="listbox" aria-label="Navigation results">
                  {searchResults.length ? searchResults.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      role="option"
                      aria-selected={item.active}
                      onClick={() => navigateTo(item)}
                    >
                      <span aria-hidden="true">{getNavIcon(item.label)}</span>
                      {getNavText(item.label)}
                    </button>
                  )) : <p>No matching sections</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="mobile-app-brand">
              <span className="mobile-brand-mark" aria-hidden="true">YH</span>
              <span>{title}</span>
            </div>
          )}
          {user && (
            <button
              type="button"
              className="mobile-avatar"
              aria-label={`Account menu for ${user.name || 'User'}`}
              aria-expanded={isProfileOpen}
              onClick={() => {
                setIsProfileOpen((open) => !open);
                setIsMenuOpen(false);
              }}
            >
              {(user.name || 'U').trim().charAt(0).toUpperCase()}
            </button>
          )}
          {isProfileOpen && user && (
            <div className="mobile-profile-popover">
              <strong>{user.name}</strong>
              <span>{user.role}</span>
              {onLogout && <button type="button" onClick={onLogout}>Sign out</button>}
            </div>
          )}
        </div>
        {showNavigation && (
          <div className="mobile-page-heading">
            {user && <p className="mobile-greeting">Welcome back, {user.name}</p>}
            {title && <h1>{title}</h1>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}
      </header>

      <div className="flex">
        {/* Navigation Sidebar */}
        {showNavigation && (
          <nav className="app-sidebar w-64 bg-secondary border-r border-gray-200 hidden md:block">
            <div className="sidebar-brand">
              <span className="sidebar-brand-mark" aria-hidden="true">YH</span>
              <span>Youth Health</span>
            </div>
            <div className="sidebar-nav-wrap">
              <p className="sidebar-section-label">WORKSPACE</p>
              <ul className="space-y-2">
                {navItems.map((item, index) => (
                  <li key={item.label || `nav-${index}`}>
                    <a
                      href={item.href}
                      onClick={(e) => {
                        if (item.onClick) {
                          e.preventDefault()
                          item.onClick()
                        }
                      }}
                      className={[
                        'block px-4 py-3 rounded-md transition-colors',
                        item.active
                          ? 'bg-primary text-inverse font-semibold'
                          : 'text-primary hover:bg-primary-light'
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className="sidebar-nav-icon" aria-hidden="true">
                        {item.icon || getNavIcon(item.label)}
                      </span>
                      <span>{getNavText(item.label)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {user && (
              <div className="sidebar-profile">
                <span className="sidebar-avatar" aria-hidden="true">
                  {(user.name || 'U').trim().charAt(0).toUpperCase()}
                </span>
                <span className="sidebar-profile-copy">
                  <strong>{user.name}</strong>
                  <span>{user.role}</span>
                </span>
                {onLogout && (
                  <button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out">
                    ↪
                  </button>
                )}
              </div>
            )}
          </nav>
        )}

        {/* Main Content */}
        <main className={['app-content flex-1 md:p-8 p-4', className].filter(Boolean).join(' ')} {...props}>
          {showNavigation && (
            <div className="desktop-content-heading">
              <div>
                {title && <h1>{title}</h1>}
                {subtitle && <p>{subtitle}</p>}
              </div>
              {actions && <div className="desktop-content-actions">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
      {showNavigation && showMobileNavigation && (
        <nav className="app-mobile-nav" aria-label="Main navigation">
          {mobileNavItems.map((item, index) => (
            <button
              key={item.label || `mobile-nav-${index}`}
              type="button"
              className={item.active ? 'app-mobile-nav-item active' : 'app-mobile-nav-item'}
              onClick={() => navigateTo(item)}
            >
              <span className="mobile-nav-icon" aria-hidden="true">{getNavIcon(item.label)}</span>
              <span>{getNavText(item.label)}</span>
            </button>
          ))}
          <button
            type="button"
            className={isMenuOpen ? 'app-mobile-nav-item active' : 'app-mobile-nav-item'}
            aria-expanded={isMenuOpen}
            onClick={() => {
              setIsMenuOpen((open) => !open);
              setIsProfileOpen(false);
            }}
          >
            <span className="mobile-nav-icon" aria-hidden="true">•••</span>
            <span>More</span>
          </button>
        </nav>
      )}
      {isMenuOpen && showNavigation && (
        <>
          <button
            type="button"
            className="mobile-menu-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setIsMenuOpen(false)}
          />
          <nav className="mobile-menu-panel" aria-label="More sections">
            <div className="mobile-menu-heading">
              <strong>{user?.name || 'Navigation'}</strong>
              <button type="button" aria-label="Close menu" onClick={() => setIsMenuOpen(false)}>×</button>
            </div>
            {navItems.map((item, index) => (
              <button
                key={item.label || `drawer-nav-${index}`}
                type="button"
                className={item.active ? 'mobile-menu-link active' : 'mobile-menu-link'}
                onClick={() => navigateTo(item)}
              >
                <span aria-hidden="true">{getNavIcon(item.label)}</span>
                {getNavText(item.label)}
              </button>
            ))}
            {onLogout && (
              <button type="button" className="mobile-menu-link mobile-menu-logout" onClick={onLogout}>
                <span aria-hidden="true">↪</span>
                Sign out
              </button>
            )}
          </nav>
        </>
      )}
    </div>
  );
};

export default MainLayout;
