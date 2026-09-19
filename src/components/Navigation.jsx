/**
 * Navigation Component
 * 
 * Sidebar navigation with links
 * 
 * Usage:
 * <Navigation
 *   items={[
 *     { label: 'Dashboard', href: '/dashboard', active: true },
 *     { label: 'Members', href: '/members' },
 *     { label: 'Events', href: '/events' }
 *   ]}
 *   user={{ name: 'John Doe', role: 'Admin' }}
 *   onLogout={() => handleLogout()}
 * />
 */

import React, { useState } from 'react';

const Navigation = ({
  items = [],
  user,
  onLogout,
  className = '',
  ...props
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden p-4 bg-primary text-inverse flex justify-between items-center">
        <span className="font-semibold">Menu</span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-inverse"
          aria-label="Toggle menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className={[
          'w-64 bg-secondary border-r border-gray-200 md:block',
          mobileOpen ? 'block' : 'hidden',
          className
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
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
            {items.map((item) => (
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
    </>
  );
};

export default Navigation;
