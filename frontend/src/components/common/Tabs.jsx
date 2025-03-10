import React from 'react';

const Tabs = ({ 
  tabs, 
  activeTab, 
  onChange, 
  className = '' 
}) => {
  // Make sure tabs is an array to prevent rendering errors
  const tabsArray = Array.isArray(tabs) ? tabs : [
    { id: 'manufacturer', label: 'Manufacturer' },
    { id: 'distributor', label: 'Distributor' },
    { id: 'retailer', label: 'Retailer' }
  ];

  return (
    <div className={`border-b border-neutral-200 ${className}`}>
      <nav className="-mb-px flex space-x-4">
        {tabsArray.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
              ${activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-700 hover:border-neutral-300'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default React.memo(Tabs); // Memoize to prevent unnecessary re-renders