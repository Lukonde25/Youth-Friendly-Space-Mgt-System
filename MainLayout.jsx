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

import React from 'react';

const MainLayout = ({
  children,
  title,
  subtitle,
  navItems = [],
  user,
  onLogout,
  actions,
  showNavigation = true,
  className = '',
  ...props
}) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-inverse">
        <div className="container py-6">
          <div className="flex-between">
            <div>
              {title && <h1 className="text-3xl font-bold m-0">{title}</h1>}
              {subtitle && (
                <p className="text-sm opacity-90 m-0 mt-1">{subtitle}</p>
              )}
            </div>
            <div className="flex gap-3">{actions}</div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Navigation Sidebar */}
        {showNavigation && (
          <nav className="w-64 bg-secondary border-r border-gray-200 hidden md:block">
            <div className="p-6">
              {/* User Section */}
              {user && (
                <div className="mb-8 pb-6 border-b border-gray-300">
                  <h3 className="font-semibold">{user.name}</h3>
                  <p className="text-sm text-secondary">{user.role}</p>
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="text-sm text-primary hover:underline mt-2"
                    >
                      Logout
                    </button>
                  )}
                </div>
              )}

              {/* Navigation Items */}
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.href || item.label}>
                    <a
                      href={item.href}
                      className={[
                        'block px-4 py-3 rounded-md transition-colors',
                        item.active
                          ? 'bg-primary text-inverse font-semibold'
                          : 'text-primary hover:bg-primary-light'
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {item.icon && <span className="mr-3">{item.icon}</span>}
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}

        {/* Main Content */}
        <main className={['flex-1 md:p-8 p-4', className].filter(Boolean).join(' ')} {...props}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
