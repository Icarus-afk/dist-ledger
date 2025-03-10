import React from 'react';
import { Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';

// Temporary Logo component
const Logo = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl'
  };
  
  return (
    <Link to="/" className={`font-bold ${sizeClasses[size]} text-primary-600`}>
      DistLedger
    </Link>
  );
};

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <header className="py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <Outlet />
        </div>
      </main>

      <footer className="py-6 bg-white border-t border-neutral-100">
        <div className="container mx-auto px-4 text-center text-sm text-neutral-500">
          &copy; {new Date().getFullYear()} DistLedger. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;