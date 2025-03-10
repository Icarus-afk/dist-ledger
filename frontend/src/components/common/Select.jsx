import React from 'react';

const Select = ({ 
  label, 
  id, 
  name, 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Select an option', 
  required = false,
  disabled = false,
  error = '',
  fullWidth = false,
  className = ''
}) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1">
          {label}{required && <span className="text-accent-600">*</span>}
        </label>
      )}
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`
          block w-full rounded-md border-neutral-300 py-2 pl-3 pr-10 text-neutral-900 
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          sm:text-sm ${error ? 'border-accent-300 ring-1 ring-accent-300' : ''}
        `}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-accent-600">{error}</p>}
    </div>
  );
};

export default Select;