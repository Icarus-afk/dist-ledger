#!/bin/bash
# filepath: /home/lothrok/Documents/projects/dist-ledger/setup.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up TechChain Dashboard Frontend...${NC}"

# Create project directory
FRONTEND_DIR="frontend"
mkdir -p $FRONTEND_DIR
cd $FRONTEND_DIR

# Initialize Vite project with React
echo -e "${GREEN}Initializing Vite project with React...${NC}"
npm create vite@latest . -- --template react

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install react-router-dom
npm install -D tailwindcss postcss autoprefixer

# Set up Tailwind CSS
echo -e "${GREEN}Setting up Tailwind CSS...${NC}"
npx tailwindcss init -p

# Create Tailwind config
cat > tailwind.config.js << 'EOL'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        secondary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        accent: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        highlight: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
}
EOL

# Create directory structure
echo -e "${GREEN}Creating directory structure...${NC}"
mkdir -p public/assets
mkdir -p src/components/common
mkdir -p src/hooks
mkdir -p src/layouts
mkdir -p src/pages/{auth,dashboard,manufacturer,distributor,retailer,verification}
mkdir -p src/services

# Create a simple logo placeholder
echo -e "${GREEN}Creating logo placeholder...${NC}"
mkdir -p public/assets
cat > public/assets/logo.svg << 'EOL'
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
</svg>
EOL

# Create CSS with Tailwind directives
cat > src/index.css << 'EOL'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOL

# Create main.jsx
echo -e "${GREEN}Creating main.jsx...${NC}"
cat > src/main.jsx << 'EOL'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOL

# Create App.jsx
echo -e "${GREEN}Creating App.jsx...${NC}"
cat > src/App.jsx << 'EOL'
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
EOL

# Create routes.jsx
echo -e "${GREEN}Creating routes.jsx...${NC}"
cat > src/routes.jsx << 'EOL'
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import VerificationLayout from './layouts/VerificationLayout';

// Pages - These will be implemented later
import Dashboard from './pages/dashboard/Index';

// Manufacturer pages
import ManufacturerProducts from './pages/manufacturer/Products';
import ManufacturerTransfers from './pages/manufacturer/Transfers';

// Distributor pages
import DistributorInventory from './pages/distributor/Inventory';
import DistributorShipments from './pages/distributor/Shipments';

// Retailer pages
import RetailerInventory from './pages/retailer/Inventory';
import RetailerSales from './pages/retailer/Sales';
import RetailerReturns from './pages/retailer/Returns';

// Verification page
import VerifyProduct from './pages/verification/VerifyProduct';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
      </Route>
      
      {/* Dashboard Routes */}
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Manufacturer Routes */}
        <Route path="/manufacturer/products" element={<ManufacturerProducts />} />
        <Route path="/manufacturer/transfers" element={<ManufacturerTransfers />} />
        
        {/* Distributor Routes */}
        <Route path="/distributor/inventory" element={<DistributorInventory />} />
        <Route path="/distributor/shipments" element={<DistributorShipments />} />
        
        {/* Retailer Routes */}
        <Route path="/retailer/inventory" element={<RetailerInventory />} />
        <Route path="/retailer/sales" element={<RetailerSales />} />
        <Route path="/retailer/returns" element={<RetailerReturns />} />
      </Route>
      
      {/* Verification Routes - Public */}
      <Route element={<VerificationLayout />}>
        <Route path="/verification/product" element={<VerifyProduct />} />
      </Route>
      
      {/* Catch-all route */}
      <Route path="*" element={<div className="p-8 text-center">Page Not Found</div>} />
    </Routes>
  );
};

export default AppRoutes;
EOL

# Create API service
echo -e "${GREEN}Creating API service...${NC}"
cat > src/services/api.js << 'EOL'
// Base API service for making HTTP requests to the backend

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper to handle HTTP errors
const handleResponse = async (response) => {
  if (!response.ok) {
    // Try to get error message from response
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error ${response.status}`);
    } catch (e) {
      throw new Error(`HTTP error ${response.status}`);
    }
  }
  
  // Check if response is empty
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return response.text();
};

// API service
const apiService = {
  // Base fetch method with auth and error handling
  async fetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Get auth token from localStorage if available
    const token = localStorage.getItem('auth_token');
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    
    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };
    
    try {
      const response = await fetch(url, config);
      return await handleResponse(response);
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },
  
  // HTTP method wrappers
  get(endpoint, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'GET' });
  },
  
  post(endpoint, data, options = {}) {
    return this.fetch(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  put(endpoint, data, options = {}) {
    return this.fetch(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  delete(endpoint, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'DELETE' });
  },
};

export default apiService;
EOL

# Create layout templates
echo -e "${GREEN}Creating layout templates...${NC}"

# AuthLayout
cat > src/layouts/AuthLayout.jsx << 'EOL'
import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <img src="/assets/logo.svg" alt="Logo" className="h-12 w-12 mx-auto" />
          <h1 className="mt-2 text-3xl font-bold text-primary-700">TechChain</h1>
          <p className="mt-1 text-sm text-neutral-600">Blockchain-powered supply chain transparency</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
EOL

# DashboardLayout
cat > src/layouts/DashboardLayout.jsx << 'EOL'
import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // This would normally come from auth context
  const userRole = 'retailer'; // Could be 'manufacturer', 'distributor', or 'retailer'
  
  const navigation = {
    manufacturer: [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Products', href: '/manufacturer/products' },
      { name: 'Transfers', href: '/manufacturer/transfers' }
    ],
    distributor: [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Inventory', href: '/distributor/inventory' },
      { name: 'Shipments', href: '/distributor/shipments' }
    ],
    retailer: [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Inventory', href: '/retailer/inventory' },
      { name: 'Sales', href: '/retailer/sales' },
      { name: 'Returns', href: '/retailer/returns' }
    ]
  };

  // Get navigation links based on user role
  const navLinks = navigation[userRole] || [];
  
  // Logout handler
  const handleLogout = () => {
    // In a real app, clear auth token, etc.
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Sidebar */}
      <div className={`fixed inset-0 bg-neutral-800 bg-opacity-75 z-40 md:hidden ${
        sidebarOpen ? 'block' : 'hidden'
      }`} onClick={() => setSidebarOpen(false)}></div>

      <aside className={`fixed top-0 left-0 z-40 w-64 h-screen transition-transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="h-full px-3 py-4 overflow-y-auto bg-white border-r border-neutral-200">
          <div className="flex items-center mb-5 px-2">
            <img src="/assets/logo.svg" alt="Logo" className="h-8 w-8" />
            <span className="ml-3 text-xl font-semibold text-primary-700">TechChain</span>
          </div>
          <ul className="space-y-2">
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
                    <span className="ml-3">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="pt-5 mt-5 space-y-2 border-t border-neutral-200">
            <button
              onClick={handleLogout}
              className="flex w-full items-center p-2 text-base font-normal text-neutral-700 rounded-lg hover:bg-neutral-100"
            >
              <span className="ml-3">Logout</span>
            </button>
            <Link
              to="/verification/product"
              className="flex w-full items-center p-2 text-base font-normal text-highlight-700 bg-highlight-50 rounded-lg hover:bg-highlight-100"
            >
              <span className="ml-3">Verify Product</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm z-10">
          <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-200">
            <div className="flex items-center">
              <button
                className="md:hidden mr-2 text-neutral-500 hover:text-neutral-600"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              </button>
              <h1 className="text-lg font-medium text-neutral-800">
                {/* Page title based on current path */}
                {location.pathname === '/dashboard' && 'Dashboard'}
                {location.pathname === '/manufacturer/products' && 'Products'}
                {location.pathname === '/manufacturer/transfers' && 'Transfers'}
                {location.pathname === '/distributor/inventory' && 'Inventory'}
                {location.pathname === '/distributor/shipments' && 'Shipments'}
                {location.pathname === '/retailer/inventory' && 'Inventory'}
                {location.pathname === '/retailer/sales' && 'Sales'}
                {location.pathname === '/retailer/returns' && 'Returns'}
              </h1>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-neutral-600 mr-4">User Name</span>
              <button className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 focus:outline-none">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
              </button>
            </div>
          </div>
        </header>
        
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
        
        <footer className="py-3 bg-white border-t border-neutral-200">
          <div className="px-4 text-center text-sm text-neutral-500">
            © {new Date().getFullYear()} TechChain. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;
EOL

# VerificationLayout
cat > src/layouts/VerificationLayout.jsx << 'EOL'
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
EOL

# Create placeholder page components
echo -e "${GREEN}Creating placeholder page components...${NC}"

# Create auth pages
mkdir -p src/pages/auth
touch src/pages/auth/Login.jsx
touch src/pages/auth/Register.jsx

# Create dashboard pages
mkdir -p src/pages/dashboard
touch src/pages/dashboard/Index.jsx

# Create manufacturer pages
mkdir -p src/pages/manufacturer
touch src/pages/manufacturer/Products.jsx
touch src/pages/manufacturer/Transfers.jsx

# Create distributor pages
mkdir -p src/pages/distributor
touch src/pages/distributor/Inventory.jsx
touch src/pages/distributor/Shipments.jsx

# Create retailer pages
mkdir -p src/pages/retailer
touch src/pages/retailer/Inventory.jsx
touch src/pages/retailer/Sales.jsx
touch src/pages/retailer/Returns.jsx

# Create verification pages
mkdir -p src/pages/verification
touch src/pages/verification/VerifyProduct.jsx

# Create common components
mkdir -p src/components/common
touch src/components/common/Button.jsx
touch src/components/common/Card.jsx
touch src/components/common/Input.jsx
touch src/components/common/Table.jsx
touch src/components/common/Badge.jsx
touch src/components/common/Tabs.jsx
touch src/components/common/Chart.jsx

# Create API hook
mkdir -p src/hooks
touch src/hooks/useApi.js

echo -e "${GREEN}Frontend project structure created successfully!${NC}"
echo -e "${BLUE}To start development, run:${NC}"
echo -e "cd ${FRONTEND_DIR}"
echo -e "npm install"
echo -e "npm run dev"