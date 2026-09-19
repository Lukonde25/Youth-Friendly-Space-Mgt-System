/**
 * Badge Component
 * 
 * Variants: success, warning, error, info, primary
 * 
 * Usage:
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning">Pending</Badge>
 * <Badge variant="error">Inactive</Badge>
 */

import React from 'react';

const Badge = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    primary: 'badge-primary'
  };

  const finalClassName = [
    'badge',
    variantClasses[variant],
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={finalClassName} {...props}>
      {children}
    </span>
  );
};

export default Badge;
