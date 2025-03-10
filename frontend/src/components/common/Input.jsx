import React from 'react';

const Input = ({ 
  label,
  id,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  fullWidth = false,
  className = '',
  error = '',
  ...rest
}) => {
  // Simple input with no side effects
  return (
    <div className={`mb-2 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1">
          {label} {required && <span className="text-accent-600">*</span>}
        </label>
      )}
      
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`block rounded-md shadow-sm border-neutral-300 focus:ring-primary-500 focus:border-primary-500 ${
          fullWidth ? 'w-full' : ''
        } ${className} ${error ? 'border-accent-300' : ''}`}
        {...rest}
      />
      
      {error && <p className="mt-1 text-xs text-accent-600">{error}</p>}
    </div>
  );
};

export default React.memo(Input); // Memoize the component to prevent unnecessary re-renders