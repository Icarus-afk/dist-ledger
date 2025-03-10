import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card';

const UnAuthorized = () => {
  return (
    <Card className="w-full max-w-md mx-auto">
      <div className="text-center">
        <div className="mb-5 flex justify-center">
          <div className="rounded-full bg-accent-100 p-3">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor" 
              className="w-10 h-10 text-accent-600"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" 
              />
            </svg>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-neutral-800 mb-2">Access Denied</h2>
        <p className="mb-5 text-neutral-600">
          You don't have permission to access this page. Please log in with the appropriate credentials.
        </p>
        
        <div className="space-y-4">
          <Link 
            to="/auth/login"
            className="block w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-center font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Go to Login
          </Link>
          
          <Link 
            to="/"
            className="block w-full py-2 px-4 border border-neutral-300 rounded-md shadow-sm text-center font-medium text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </Card>
  );
};

export default UnAuthorized;