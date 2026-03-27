import React from 'react';
import { Navbar } from './Navbar';

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  title,
  className = '',
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <Navbar pageTitle={title} />
      <main className={`flex-1 overflow-y-auto bg-gray-50 p-6 ${className}`}>
        {children}
      </main>
    </div>
  );
};
