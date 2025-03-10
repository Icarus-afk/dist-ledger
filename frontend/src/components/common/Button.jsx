import React from 'react';

/**
 * Button component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {string} [props.variant='primary'] - Button variant (primary, secondary, outline, text)
 * @param {string} [props.size='md'] - Button size (sm, md, lg)
 * @param {boolean} [props.fullWidth=false] - Whether button should take full width
 * @param {boolean} [props.disabled=false] - Whether button is disabled
 * @param {boolean} [props.loading=false] - Whether button is in loading state
 * @param {string} [props.type='button'] - Button type attribute
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {Function} [props.onClick] - Click handler
 */
const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  onClick,
  ...props 
}) => {
  // Base classes for all buttons
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  // Classes based on variant
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-secondary-600 text-white hover:bg-secondary-700 focus:ring-secondary-500',
    success: 'bg-success-600 text-white hover:bg-success-700 focus:ring-success-500',
    warning: 'bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500',
    danger: 'bg-accent-600 text-white hover:bg-accent-700 focus:ring-accent-500',
    outline: 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 focus:ring-primary-500',
    text: 'bg-transparent text-neutral-700 hover:bg-neutral-100 focus:ring-primary-500',
  };
  
  // Classes based on size
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };
  
  // Additional classes for disabled and loading states
  const stateClasses = [
    disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
    fullWidth ? 'w-full' : '',
  ];
  
  return (
    <button
      type={type}
      className={`
        ${baseClasses} 
        ${variantClasses[variant] || variantClasses.primary} 
        ${sizeClasses[size] || sizeClasses.md}
        ${stateClasses.join(' ')}
        ${className}
      `}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;