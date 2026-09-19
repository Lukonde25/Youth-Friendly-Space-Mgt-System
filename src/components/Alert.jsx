/**
 * Alert Component
 * 
 * Variants: success, error, warning, info
 * 
 * Usage:
 * <Alert variant="success" title="Success">
 *   Member successfully added to the system
 * </Alert>
 * 
 * <Alert variant="error">
 *   Something went wrong. Please try again.
 * </Alert>
 */

import React from 'react';

const iconMap = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'ℹ'
};

const Alert = ({
  children,
  variant = 'info',
  title,
  className = '',
  onDismiss,
  ...props
}) => {
  const alertClasses = [
    'alert',
    `alert-${variant}`,
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={alertClasses} role="alert" {...props}>
      <span className="alert-icon">{iconMap[variant]}</span>
      <div>
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="btn btn-ghost btn-sm ml-auto"
          aria-label="Dismiss alert"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Alert;
