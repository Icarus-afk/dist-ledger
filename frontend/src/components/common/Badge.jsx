import React from 'react';

/**
 * Badge component for displaying status indicators or labels
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Badge content
 * @param {string} [props.variant='neutral'] - Badge variant (neutral, primary, success, warning, danger)
 * @param {string} [props.size='md'] - Badge size (sm, md, lg)
 * @param {boolean} [props.pill=false] - Whether to use pill shape (more rounded)
 * @param {boolean} [props.outline=false] - Whether to use outlined style instead of filled
 * @param {string} [props.className=''] - Additional CSS classes
 */
const Badge = ({ 
  children, 
  variant = 'neutral', 
  size = 'md', 
  pill = false,
  outline = false,
  className = '',
  ...props 
}) => {
  // Color variants
  const variantClasses = {
    neutral: outline 
      ? 'bg-white text-neutral-700 border border-neutral-300' 
      : 'bg-neutral-100 text-neutral-700',
    primary: outline 
      ? 'bg-white text-primary-700 border border-primary-300' 
      : 'bg-primary-100 text-primary-700',
    success: outline 
      ? 'bg-white text-success-700 border border-success-300' 
      : 'bg-success-100 text-success-700',
    warning: outline 
      ? 'bg-white text-warning-700 border border-warning-300' 
      : 'bg-warning-100 text-warning-700',
    danger: outline 
      ? 'bg-white text-accent-700 border border-accent-300' 
      : 'bg-accent-100 text-accent-700',
  };
  
  // Size variants
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };
  
  // Border radius based on pill prop
  const radiusClass = pill ? 'rounded-full' : 'rounded';
  
  return (
    <span
      className={`
        inline-flex items-center font-medium
        ${variantClasses[variant] || variantClasses.neutral}
        ${sizeClasses[size] || sizeClasses.md}
        ${radiusClass}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;