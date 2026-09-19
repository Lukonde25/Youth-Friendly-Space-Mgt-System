/**
 * Select Component
 * 
 * Usage:
 * <Select
 *   label="Activity Type"
 *   value={activityType}
 *   onChange={(e) => setActivityType(e.target.value)}
 *   options={[
 *     { value: 'clinic', label: 'Clinic Visit' },
 *     { value: 'outreach', label: 'Outreach' }
 *   ]}
 * />
 */

import React from 'react';

const Select = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  error,
  required = false,
  disabled = false,
  id,
  name,
  className = '',
  helpText,
  ...props
}) => {
  const selectId = id || name || `select-${Math.random()}`;

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={selectId} className={required ? 'required' : ''}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={className}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <div id={`${selectId}-error`} className="form-error" role="alert">
          {error}
        </div>
      )}
      {helpText && !error && (
        <div id={`${selectId}-help`} className="text-muted mt-1">
          {helpText}
        </div>
      )}
    </div>
  );
};

export default Select;
