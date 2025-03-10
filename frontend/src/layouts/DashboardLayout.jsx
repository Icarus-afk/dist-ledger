import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get user information from auth context
  const { userRole, currentUser, logout } = useAuth();
  
  // Navigation configuration for different roles
  const navigation = {
    manufacturer: [
      { name: 'Dashboard', href: '/manufacturer/dashboard' },
      { name: 'Products', href: '/manufacturer/products' },
      { name: 'Register Products', href: '/manufacturer/register-product' }
    ],
    distributor: [
      { name: 'Dashboard', href: '/distributor/dashboard' },
      { name: 'Inventory', href: '/distributor/inventory' },
      { name: 'Shipments', href: '/distributor/shipments' }
    ],
    retailer: [
      { name: 'Dashboard', href: '/retailer/dashboard' },
      { name: 'Inventory', href: '/retailer/inventory' },
      { name: 'Sales', href: '/retailer/sales' },
      { name: 'Returns', href: '/retailer/returns' }
    ],
    admin: [
      { name: 'Dashboard', href: '/admin/dashboard' },
      { name: 'Users', href: '/admin/users' },
      { name: 'System Status', href: '/admin/system' },
      { name: 'Analytics', href: '/admin/analytics' },
      { name: 'Settings', href: '/admin/settings' }
    ]
  };

  // Role labels for display
  const roleLabels = {
    manufacturer: 'Manufacturer',
    distributor: 'Distributor',
    retailer: 'Retailer',
    admin: 'Administrator'
  };

  // Get navigation links based on user role
  const navLinks = navigation[userRole] || [];
  
  // Logout handler
  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  // Get user display name
  const userDisplayName = currentUser?.name || currentUser?.username || 'User';

  // Get page title based on current path
  const getPageTitle = () => {
    // Extract the last part of the path
    const pathSegments = location.pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    // Special case for dashboard routes
    if (lastSegment === 'dashboard') {
      return 'Dashboard';
    }
    
    // Capitalize first letter
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile sidebar backdrop */}
      <div className={`fixed inset-0 bg-neutral-800 bg-opacity-75 z-40 md:hidden ${
        sidebarOpen ? 'block' : 'hidden'
      }`} onClick={() => setSidebarOpen(false)}></div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-40 w-64 h-screen transition-transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="h-full px-3 py-4 overflow-y-auto bg-white border-r border-neutral-200">
          <div className="flex items-center mb-5 px-2">
            <img src="/assets/logo.svg" alt="Logo" className="h-8 w-8" />
            <span className="ml-3 text-xl font-semibold text-primary-700">DistLedger</span>
          </div>
          
          {/* User profile section */}
          <div className="mb-6 px-2 py-3 bg-neutral-50 rounded-lg">
            <div className="font-medium text-neutral-800">{userDisplayName}</div>
            <div className="text-xs text-neutral-500 mt-1">
              {roleLabels[userRole] || 'User'}
            </div>
          </div>
          
          {/* Navigation links */}
          <div className="mb-4">
            <p className="px-2 mb-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Main Navigation
            </p>
            <ul className="space-y-1">
              {navLinks.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center p-2 text-base font-normal rounded-lg ${
                        isActive 
                          ? 'bg-primary-100 text-primary-700' 
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          
          {/* Verification section - available to all roles */}
          <div className="mb-4">
            <p className="px-2 mb-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Verification
            </p>
            <ul className="space-y-1">
              <li>
                <Link
                  to="/verification/product"
                  className={`flex items-center p-2 text-base font-normal rounded-lg ${
                    location.pathname === '/verification/product'
                      ? 'bg-highlight-100 text-highlight-700'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span>Verify Product</span>
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Account section */}
          <div className="mt-auto pt-5 border-t border-neutral-200">
            <p className="px-2 mb-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Account
            </p>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center p-2 text-base font-normal text-neutral-700 rounded-lg hover:bg-neutral-100"
                >
                  <span>Sign Out</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-200">
            <div className="flex items-center">
              <button
                className="md:hidden mr-2 text-neutral-500 hover:text-neutral-600"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle navigation menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              </button>
              <h1 className="text-lg font-medium text-neutral-800">
                {getPageTitle()}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500" aria-label="Notifications">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
              </button>
              
              {/* User dropdown could be added here */}
              <div className="hidden md:block">
                <span className="text-sm font-medium text-neutral-700">{userDisplayName}</span>
                <span className="text-xs text-neutral-500 ml-1">({roleLabels[userRole] || 'User'})</span>
              </div>
            </div>
          </div>
        </header>
        
        {/* Main content area */}
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
        
        {/* Footer */}
        <footer className="py-3 bg-white border-t border-neutral-200">
          <div className="px-4 text-center text-sm text-neutral-500">
            © {new Date().getFullYear()} DistLedger. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;