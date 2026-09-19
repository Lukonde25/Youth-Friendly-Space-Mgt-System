/**
 * Button Component
 * 
 * Variants: primary, secondary, danger, success, ghost
 * Sizes: sm, base (default), lg
 * States: disabled, loading
 * 
 * Usage:
 * <Button>Save</Button>
 * <Button variant="danger">Delete</Button>
 * <Button size="lg" block>Full Width</Button>
 */

import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'base',
  block = false,
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  onClick,
  ...props
}) => {
  const baseClasses = 'btn';
  
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    success: 'btn-success',
    ghost: 'btn-ghost'
  };

  const sizeClasses = {
    sm: 'btn-sm',
    base: '',
    lg: 'btn-lg'
  };

  const blockClass = block ? 'btn-block' : '';

  const finalClassName = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    blockClass,
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={finalClassName}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="spinner" />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
