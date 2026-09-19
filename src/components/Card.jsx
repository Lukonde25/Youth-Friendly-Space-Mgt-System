/**
 * Card Component
 * 
 * A flexible container component for displaying grouped content
 * 
 * Usage:
 * <Card>
 *   <h3>Member Stats</h3>
 *   <p>45 active members this month</p>
 * </Card>
 * 
 * <Card size="sm" className="clickable">
 *   <p>Click me</p>
 * </Card>
 */

import React from 'react';

const Card = ({
  children,
  size = 'base',
  className = '',
  onClick,
  ...props
}) => {
  const sizeClasses = {
    sm: 'card card-sm',
    base: 'card',
    lg: 'card card-lg'
  };

  const finalClassName = [
    sizeClasses[size],
    onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={finalClassName}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
