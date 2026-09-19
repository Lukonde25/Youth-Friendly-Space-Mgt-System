/**
 * TextArea Component
 * 
 * Usage:
 * <TextArea
 *   label="Comments"
 *   value={comments}
 *   onChange={(e) => setComments(e.target.value)}
 *   rows={5}
 * />
 */

import React from 'react';

const TextArea = ({
  label,
  value,
  onChange,
  placeholder,
  error,
  required = false,
  disabled = false,
  id,
  name,
  rows = 4,
  className = '',
  helpText,
  maxLength,
  ...props
}) => {
  const textareaId = id || name || `textarea-${Math.random()}`;
  const currentLength = value ? value.length : 0;
  const showCharCount = maxLength && value;

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={textareaId} className={required ? 'required' : ''}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className={className}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${textareaId}-error` : helpText ? `${textareaId}-help` : undefined}
        {...props}
      />
      {error && (
        <div id={`${textareaId}-error`} className="form-error" role="alert">
          {error}
        </div>
      )}
      {helpText && !error && (
        <div id={`${textareaId}-help`} className="text-muted mt-1">
          {helpText}
        </div>
      )}
      {showCharCount && (
        <div className="text-xs text-tertiary mt-1">
          {currentLength} / {maxLength} characters
        </div>
      )}
    </div>
  );
};

export default TextArea;
