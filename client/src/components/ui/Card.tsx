import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  headerRight,
  noPadding = false,
}) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm ${className}`}>
      {(title || headerRight) && (
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 dark:border-gray-700 gap-3 flex-wrap sm:flex-nowrap">
          <div>
            {title && <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4 md:p-6'}>{children}</div>
    </div>
  );
};
