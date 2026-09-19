/**
 * StatCard Component
 * 
 * Displays a key statistic with optional icon and trend
 * This is the "signature element" - what makes the system feel good
 * 
 * Usage:
 * <StatCard
 *   label="People Reached This Month"
 *   value={450}
 *   icon="👥"
 *   trend={{ value: 12, direction: 'up' }}
 * />
 * 
 * <StatCard
 *   label="Active Members"
 *   value={48}
 *   color="primary"
 * />
 */

import React from 'react';

const StatCard = ({
  label,
  value,
  icon,
  unit = '',
  color = 'primary',
  trend,
  size = 'base',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'p-4',
    base: 'p-6',
    lg: 'p-8'
  };

  const fontSizeClasses = {
    sm: 'text-2xl',
    base: 'text-3xl',
    lg: 'text-4xl'
  };

  const cardClasses = [
    'card',
    sizeClasses[size],
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClasses} {...props}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-muted text-sm">{label}</p>
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>

      <div className="mb-4">
        <div className={`font-bold ${fontSizeClasses[size]} text-primary`}>
          {value}
          {unit && <span className="text-sm ml-1">{unit}</span>}
        </div>
      </div>

      {trend && (
        <div className={`text-sm flex items-center ${
          trend.direction === 'up' ? 'text-success' : 'text-error'
        }`}>
          <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
          <span className="ml-1">{trend.value}% from last month</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
