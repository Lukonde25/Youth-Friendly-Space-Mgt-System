/**
 * Header Component
 * 
 * Main navigation header for the application
 * 
 * Usage:
 * <Header
 *   title="Youth Health Management"
 *   subtitle="Member Dashboard"
 *   showBack={true}
 *   onBack={() => navigate(-1)}
 *   actions={
 *     <Button size="sm" variant="secondary">Settings</Button>
 *   }
 * />
 */

import React from 'react';

const Header = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions,
  className = '',
  children,
  ...props
}) => {
  return (
    <header
      className={['bg-primary text-inverse', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <div className="container py-6">
        <div className="flex-between">
          <div className="flex items-center gap-4">
            {showBack && (
              <button
                onClick={onBack}
                className="text-inverse hover:opacity-80 transition-opacity"
                aria-label="Go back"
              >
                ← Back
              </button>
            )}
            <div>
              {title && <h1 className="text-3xl font-bold m-0">{title}</h1>}
              {subtitle && <p className="text-sm opacity-90 m-0 mt-1">{subtitle}</p>}
            </div>
          </div>
          <div className="flex gap-3">{actions}</div>
        </div>
        {children}
      </div>
    </header>
  );
};

export default Header;
