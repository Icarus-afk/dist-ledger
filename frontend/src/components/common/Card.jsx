import React from 'react';

/**
 * Card component for content containers
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {React.ReactNode} [props.header] - Card header content
 * @param {React.ReactNode} [props.footer] - Card footer content
 * @param {string} [props.title] - Card title (shorthand for simple header)
 * @param {boolean} [props.isLoading] - Whether the card is in loading state
 * @param {boolean} [props.hoverable] - Whether to apply hover effects
 * @param {string} [props.className] - Additional class names for the card container
 * @param {boolean} [props.noPadding] - Whether to remove default padding
 */
const Card = ({
  children,
  header,
  footer,
  title,
  isLoading = false,
  hoverable = false,
  className = '',
  noPadding = false,
  ...props
}) => {
  return (
    <div 
      className={`
        bg-white border border-neutral-200 rounded-lg shadow-sm
        ${hoverable ? 'transition-shadow hover:shadow-md' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Header - accept either predefined header or simple title */}
      {(header || title) && (
        <div className="px-4 py-4 border-b border-neutral-200">
          {header || (
            <h3 className="text-base font-medium text-neutral-800">{title}</h3>
          )}
        </div>
      )}
      
      {/* Main content */}
      <div className={noPadding ? '' : 'p-4'}>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
            <div className="h-4 bg-neutral-200 rounded"></div>
            <div className="h-4 bg-neutral-200 rounded w-5/6"></div>
          </div>
        ) : (
          children
        )}
      </div>
      
      {/* Footer if provided */}
      {footer && (
        <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;