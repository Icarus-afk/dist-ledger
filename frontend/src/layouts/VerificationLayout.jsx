import React from 'react';
import { Outlet, Link } from 'react-router-dom';

const VerificationLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/assets/logo.svg" alt="Logo" className="h-8 w-8" />
            <span className="ml-3 font-bold text-xl text-primary-700">
              TechChain<span className="text-highlight-600">Verify</span>
            </span>
          </div>
          
          <div>
            <Link
              to="/"
              className="text-sm text-neutral-600 hover:text-primary-600"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto py-6 px-4 sm:px-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-neutral-500">
            &copy; {new Date().getFullYear()} TechChain. All rights reserved.
          </p>
          <p className="text-xs text-neutral-400 mt-2">
            Powered by blockchain technology for transparent and secure supply chain verification
          </p>
        </div>
      </footer>
    </div>
  );
};

export default VerificationLayout;
