import React from 'react';

/**
 * Table component for displaying data in rows and columns
 * 
 * @param {Object} props
 * @param {Array} props.columns - Array of column definitions with { id, header, accessor, className }
 * @param {Array} props.data - Array of data objects to display
 * @param {Function} [props.onRowClick] - Optional handler for row click events
 * @param {boolean} [props.hoverable] - Whether rows should have hover effect
 * @param {boolean} [props.striped] - Whether to apply striped styling to rows
 * @param {string} [props.size] - Table size: 'sm', 'md' (default), or 'lg'
 * @param {string} [props.className] - Additional classes for the table container
 * @param {Object} [props.emptyState] - Content to display when data is empty
 */
const Table = ({
  columns = [],
  data = [],
  onRowClick,
  hoverable = true,
  striped = false,
  size = 'md',
  className = '',
  emptyState = { message: 'No data available' }
}) => {
  const sizeClasses = {
    sm: 'text-xs py-2 px-3',
    md: 'text-sm py-3 px-4',
    lg: 'text-base py-3 px-6'
  };

  const headerClasses = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-3 text-xs',
    lg: 'px-6 py-3 text-sm'
  };

  return (
    <div className={`overflow-x-auto rounded-md border border-neutral-200 ${className}`}>
      <table className="min-w-full divide-y divide-neutral-200">
        <thead className="bg-neutral-50">
          <tr>
            {columns.map(column => (
              <th
                key={column.id || column.accessor}
                scope="col"
                className={`${headerClasses[size]} font-medium text-neutral-500 uppercase tracking-wider text-left ${column.className || ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        
        <tbody className="bg-white divide-y divide-neutral-200">
          {data.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr 
                key={row.id || rowIndex}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`
                  ${onRowClick ? 'cursor-pointer' : ''}
                  ${hoverable ? 'hover:bg-neutral-50' : ''}
                  ${striped && rowIndex % 2 ? 'bg-neutral-50' : ''}
                `}
              >
                {columns.map((column, colIndex) => {
                  const cellValue = typeof column.accessor === 'function' 
                    ? column.accessor(row)
                    : row[column.accessor];
                    
                  return (
                    <td
                      key={`${rowIndex}-${column.id || colIndex}`}
                      className={`${sizeClasses[size]} whitespace-nowrap text-neutral-800 ${column.cellClassName || ''}`}
                    >
                      {column.cell ? column.cell(cellValue, row) : cellValue}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td 
                colSpan={columns.length} 
                className="text-center py-8 text-neutral-500"
              >
                {emptyState.icon && <div className="mb-2">{emptyState.icon}</div>}
                {emptyState.message}
                {emptyState.action && <div className="mt-3">{emptyState.action}</div>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;