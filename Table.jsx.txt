/**
 * Table Component
 * 
 * Usage:
 * const columns = [
 *   { key: 'name', label: 'Name' },
 *   { key: 'phone', label: 'Phone' },
 *   { key: 'events', label: 'Events Attended' }
 * ];
 * 
 * const data = [
 *   { id: 1, name: 'Alice', phone: '0712...', events: 5 },
 *   { id: 2, name: 'Bob', phone: '0701...', events: 3 }
 * ];
 * 
 * <Table columns={columns} data={data} />
 */

import React, { useState } from 'react';

const Table = ({
  columns = [],
  data = [],
  onRowClick,
  striped = true,
  hover = true,
  className = '',
  loading = false,
  empty = false,
  emptyMessage = 'No data available',
  ...props
}) => {
  const tableClasses = [
    'w-full',
    'border-collapse',
    className
  ]
    .filter(Boolean)
    .join(' ');

  if (loading) {
    return (
      <div className="p-6 text-center text-secondary">
        <p>Loading...</p>
      </div>
    );
  }

  if (empty || data.length === 0) {
    return (
      <div className="p-6 text-center text-secondary">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={tableClasses} {...props}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="text-left">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={row.id || index}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer' : ''}
            >
              {columns.map((column) => (
                <td key={`${row.id}-${column.key}`}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
