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

import React, { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import {
  fetchNotifications,
  markNotificationAsRead,
  subscribeToNotifications
} from '../services/notificationService';

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
  showMobileGreeting = true,
  showPageHeading = true,
  theme,
  onToggleTheme,
  notificationUserId,
  notificationOrganizationId,
  onOpenMembershipRequests,
  className = '',
  ...props
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState(null);
  const [notificationBusyId, setNotificationBusyId] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const mobileNavItems = navItems.slice(0, 4);
  const searchResults = navItems.filter((item) => (
    getNavText(item.label).toLowerCase().includes(searchQuery.trim().toLowerCase())
  ));

  const navigateTo = (item) => {
    item.onClick?.();
    setSearchQuery('');
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!notificationUserId || !notificationOrganizationId) return undefined;

    let isMounted = true
    const loadNotifications = async () => {
      try {
        const data = await fetchNotifications(notificationUserId)
        if (isMounted) {
          setNotifications(data)
          setNotificationError(null)
        }
      } catch (loadError) {
        console.error('Failed to load admin notifications:', loadError)
        if (isMounted) setNotificationError(loadError.message)
      }
    }

    loadNotifications()
    const unsubscribe = subscribeToNotifications(
      notificationUserId,
      loadNotifications,
      (subscriptionError) => {
        console.error('Admin notification subscription failed:', subscriptionError)
        if (isMounted) {
          setNotificationError(`Live updates unavailable. Retrying automatically: ${subscriptionError.message}`)
        }
      }
    )
    const intervalId = window.setInterval(loadNotifications, 30000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadNotifications()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      unsubscribe()
    }
  }, [notificationUserId, notificationOrganizationId])

  const openRequestNotification = async (notification) => {
    if (!notification.read_at) {
      try {
        setNotificationBusyId(notification.id)
        await markNotificationAsRead(notification.id, notificationUserId)
        setNotifications((current) => current.map((item) => (
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )))
        setNotificationError(null)
      } catch (markError) {
        console.error('Failed to mark notification as read:', markError)
        setNotificationError(markError.message)
        setNotificationBusyId(null)
        return
      }
    }

    setNotificationBusyId(null)
    setIsNotificationsOpen(false)
    onOpenMembershipRequests?.()
  }

  const renderNotificationControl = (className) => {
    if (!notificationUserId || !notificationOrganizationId) return null
    const unreadCount = notifications.filter((item) => !item.read_at).length

    return (
      <div className={`notification-control ${className}`}>
        <button
          type="button"
          className="notification-bell"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          aria-expanded={isNotificationsOpen}
          onClick={() => setIsNotificationsOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
          {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
        {isNotificationsOpen && (
          <section className="notification-popover" aria-label="Notifications">
            <header>
              <strong>Notifications</strong>
              {unreadCount > 0 && <span>{unreadCount} new</span>}
            </header>
            {notificationError && (
              <p className="notification-error" role="alert">
                Could not load notifications: {notificationError}
              </p>
            )}
            <div className="notification-list">
              {notifications.length ? notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={notification.read_at ? 'notification-item' : 'notification-item unread'}
                  disabled={notificationBusyId === notification.id}
                  onClick={() => openRequestNotification(notification)}
                >
                  <span className="notification-item-icon" aria-hidden="true">👤</span>
                  <span className="notification-item-copy">
                    <strong>{notification.title}</strong>
                    <span>{notification.body}</span>
                    <time dateTime={notification.created_at}>
                      {new Date(notification.created_at).toLocaleString()}
                    </time>
                  </span>
                  {!notification.read_at && <span className="notification-unread-dot" aria-label="Unread" />}
                </button>
              )) : (
                !notificationError && <p className="notification-empty">No notifications yet.</p>
              )}
            </div>
            <button
              type="button"
              className="notification-view-requests"
              onClick={() => {
                setIsNotificationsOpen(false)
                onOpenMembershipRequests?.()
              }}
            >
              View membership requests
            </button>
          </section>
        )}
      </div>
    )
  }

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
          {onToggleTheme && (
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          )}
          {renderNotificationControl('notification-mobile')}
          {isProfileOpen && user && (
            <div className="mobile-profile-popover">
              <strong>{user.name}</strong>
              <span>{user.role}</span>
              {onLogout && <button type="button" onClick={onLogout}>Sign out</button>}
            </div>
          )}
        </div>
        {showNavigation && showPageHeading && (
          <div className="mobile-page-heading">
            {showMobileGreeting && user && <p className="mobile-greeting">Welcome back, {user.name}</p>}
            {title && <h1>{title}</h1>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}
      </header>

      <div className="flex">
        {/* Navigation Sidebar */}
        {showNavigation && (
          <nav className={`app-sidebar w-64 bg-secondary border-r border-gray-200 hidden md:block${notificationOrganizationId ? ' admin-sidebar-nav' : ''}`}>
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
            {onToggleTheme && (
              <ThemeToggle
                theme={theme}
                onToggle={onToggleTheme}
                className="sidebar-theme-toggle"
              />
            )}
            {renderNotificationControl('notification-desktop')}
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
          {showNavigation && showPageHeading && (
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
