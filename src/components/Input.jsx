/**
 * Input Component
 * 
 * Usage:
 * <Input
 *   label="Full Name"
 *   value={name}
 *   onChange={(e) => setName(e.target.value)}
 *   required
 * />
 * 
 * <Input
 *   type="email"
 *   label="Email"
 *   error="Invalid email format"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 * />
 */

import React from 'react';

const Input = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required = false,
  disabled = false,
  id,
  name,
  className = '',
  helpText,
  ...props
}) => {
  const inputId = id || name || `input-${Math.random()}`;

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className={required ? 'required' : ''}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={className}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
        {...props}
      />
      {error && (
        <div id={`${inputId}-error`} className="form-error" role="alert">
          {error}
        </div>
      )}
      {helpText && !error && (
        <div id={`${inputId}-help`} className="text-muted mt-1">
          {helpText}
        </div>
      )}
    </div>
  );
};

export default Input;
