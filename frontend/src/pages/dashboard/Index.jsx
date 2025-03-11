import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';

// Quick Action Button Component
const QuickActionButton = ({ to, icon, label, color = "primary" }) => (
  <Link to={to} className={`block p-4 rounded-lg border transition-all hover:shadow-md bg-white hover:bg-${color}-50`}>
    <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center bg-${color}-100 text-${color}-600 text-xl`}>
      {icon}
    </div>
    <p className="text-center font-medium text-sm">{label}</p>
  </Link>
);

// Main dashboard component - simplified to only show quick actions
const DashboardIndex = () => {
  const { userRole, currentUser } = useAuth();

  // Quick Actions based on user role
  const renderQuickActions = () => {
    switch (userRole) {
      case 'manufacturer':
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickActionButton 
              to="/manufacturer/register-product" // Fixed: was /manufacturer/products/register
              icon="➕" 
              label="Register New Product" 
              color="emerald" 
            />
            <QuickActionButton 
              to="/manufacturer/products" // Changed to existing route
              icon="🚚" 
              label="Transfer Products" 
              color="blue" 
            />
            <QuickActionButton 
              to="/manufacturer/products" 
              icon="📦" 
              label="View Products" 
              color="primary" 
            />
            <QuickActionButton 
              to="/manufacturer/dashboard" // Changed to dashboard as fallback
              icon="📊" 
              label="View Analytics" 
              color="indigo" 
            />
          </div>
        );
        
      case 'distributor':
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickActionButton 
              to="/distributor/shipments" // Fixed: was /distributor/shipments/receive
              icon="📥" 
              label="Receive Shipment" 
              color="blue" 
            />
            <QuickActionButton 
              to="/distributor/shipments" // Fixed: was /distributor/shipments/create
              icon="📤" 
              label="Create Shipment" 
              color="emerald" 
            />
            <QuickActionButton 
              to="/distributor/inventory" 
              icon="📦" 
              label="View Inventory" 
              color="primary" 
            />
            <QuickActionButton 
              to="/distributor/returns" 
              icon="↩️" 
              label="Process Returns" 
              color="amber" 
            />
          </div>
        );
        
      case 'retailer':
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickActionButton 
              to="/retailer/sales" // Fixed: was /retailer/sales/record
              icon="💰" 
              label="Record Sale" 
              color="emerald" 
            />
            <QuickActionButton 
              to="/retailer/returns" // Fixed: was /retailer/returns/process
              icon="↩️" 
              label="Process Return" 
              color="amber" 
            />
            <QuickActionButton 
              to="/retailer/inventory" 
              icon="📦" 
              label="View Inventory" 
              color="primary" 
            />
            <QuickActionButton 
              to="/retailer/sales" // Changed to sales as fallback since no shipments route exists
              icon="📥" 
              label="Receive Products" 
              color="blue" 
            />
          </div>
        );
        
      case 'admin':
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickActionButton 
              to="/admin/dashboard" // Fixed: was /admin/entities
              icon="🏢" 
              label="Manage Entities" 
              color="primary" 
            />
            <QuickActionButton 
              to="/admin/dashboard" // Fixed: was /admin/users
              icon="👤" 
              label="Manage Users" 
              color="indigo" 
            />
            <QuickActionButton 
              to="/admin/dashboard" // Fixed: was /admin/system
              icon="⚙️" 
              label="System Status" 
              color="emerald" 
            />
            <QuickActionButton 
              to="/admin/dashboard" // Fixed: was /admin/blockchain
              icon="🔗" 
              label="Blockchain Explorer" 
              color="amber" 
            />
          </div>
        );
        
      default:
        return (
          <div className="text-center p-6">
            <p>No quick actions available for your role.</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-800">Quick Actions</h1>
        <div className="text-sm text-neutral-500">
          Welcome, <span className="font-medium">{currentUser?.name || currentUser?.username || 'User'}</span>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-medium mb-4">What would you like to do?</h2>
        {renderQuickActions()}
      </Card>
    </div>
  );
};

export default DashboardIndex;