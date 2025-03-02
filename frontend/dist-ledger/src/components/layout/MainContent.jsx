import { useContext } from 'react';
import { RoleContext } from '../../context/RoleContext';
import Dashboard from '../dashboard/Dashboard';
import DistributorInventory from '../distributor/DistributorInventory';
import RetailerInventory from '../retailer/RetailerInventory';
import ProductRegistry from '../product/ProductRegistry';
import SupplyChain from '../supply-chain/SupplyChain';
import NetworkMonitor from '../network/NetworkMonitor';
import CrossChainView from '../cross-chain/CrossChainView';

const MainContent = ({ currentView, setCurrentView }) => {
  const { currentRole } = useContext(RoleContext);
  
  // Access control check
  const canAccess = (requiredRole) => {
    if (!requiredRole) return true;
    return currentRole === requiredRole || currentRole === 'admin';
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard setCurrentView={setCurrentView} />;
      case 'distributor-inventory':
        return canAccess('distributor') ? <DistributorInventory /> : <AccessDenied role="distributor" />;
      case 'retailer-inventory':
        return canAccess('retailer') ? <RetailerInventory /> : <AccessDenied role="retailer" />;
      case 'product-registry':
        return <ProductRegistry />;
      case 'supply-chain':
        return <SupplyChain />;
      case 'network-monitor':
        return canAccess('admin') ? <NetworkMonitor /> : <AccessDenied role="admin" />;
      case 'cross-chain':
        return canAccess('admin') ? <CrossChainView /> : <AccessDenied role="admin" />;
      default:
        return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  return (
    <main className="ml-sidebar-width p-6 flex-1 bg-gray-100">
      {renderView()}
    </main>
  );
};

const AccessDenied = ({ role }) => (
  <div className="w-full py-12 text-center">
    <div className="bg-red-50 border border-red-200 p-6 rounded-lg inline-block">
      <h2 className="text-xl font-bold text-red-500 mb-2">Access Denied</h2>
      <p className="text-gray-600">
        You need <span className="font-semibold">{role}</span> permissions to access this view.
      </p>
    </div>
  </div>
);

export default MainContent;
