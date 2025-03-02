import { useContext } from 'react';
import { RoleContext } from '../../context/RoleContext';
import { NetworkContext } from '../../context/NetworkContext';
import { 
  FaChartBar, FaBox, FaShoppingBag, FaBarcode, 
  FaTruck, FaNetworkWired, FaExchangeAlt, 
  FaExclamationTriangle, FaCircle
} from 'react-icons/fa';

const Sidebar = ({ currentView, setCurrentView }) => {
  const { currentRole } = useContext(RoleContext);
  const { networkStatus, loading } = useContext(NetworkContext);

  const handleViewChange = (view) => (e) => {
    e.preventDefault();
    setCurrentView(view);
  };

  const renderNavItem = (id, label, icon, requiredRole = null) => {
    // Don't render if role restriction applies and user doesn't have that role
    if (requiredRole && !(currentRole === requiredRole || currentRole === 'admin')) {
      return null;
    }

    return (
      <li>
        <a 
          href={`#${id}`} 
          className={`sidebar-link ${currentView === id ? 'sidebar-link-active' : ''}`}
          onClick={handleViewChange(id)}
        >
          {icon}
          {label}
        </a>
      </li>
    );
  };

  const renderNetworkStatus = () => {
    if (loading) {
      return <div className="px-3 py-2 text-gray-400">Loading...</div>;
    }

    if (!networkStatus) {
      return (
        <div className="px-3 py-2 text-red-400 flex items-center gap-1.5">
          <FaExclamationTriangle /> Connection error
        </div>
      );
    }

    return (
      <div className="px-3 py-2">
        {(currentRole === 'admin' || currentRole === 'distributor') && (
          <div className="mb-2 flex items-center">
            <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${networkStatus['distributor-chain']?.mainNode?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-gray-300">Distributor Chain</span>
          </div>
        )}

        {(currentRole === 'admin' || currentRole === 'retailer') && (
          <div className="mb-2 flex items-center">
            <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${networkStatus['retailer-chain']?.mainNode?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-gray-300">Retailer Chain</span>
          </div>
        )}

        {currentRole === 'admin' && (
          <div className="mb-2 flex items-center">
            <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${networkStatus['main-chain']?.mainNode?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-gray-300">Main Chain</span>
          </div>
        )}

        {currentRole !== 'admin' && (
          <div className="mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <FaCircle className="text-xs" /> Access to other chains requires relay
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-sidebar-width h-screen fixed left-0 top-0 bottom-0 bg-sidebar text-white pt-16 flex flex-col">
      <nav className="flex-grow overflow-y-auto">
        <ul className="flex flex-col gap-0.5 py-2">
          {renderNavItem('dashboard', 'Dashboard', <FaChartBar />)}
          {renderNavItem('distributor-inventory', 'Distributor Inventory', <FaBox />, 'distributor')}
          {renderNavItem('retailer-inventory', 'Retailer Inventory', <FaShoppingBag />, 'retailer')}
          {renderNavItem('product-registry', 'Product Registry', <FaBarcode />)}
          {renderNavItem('supply-chain', 'Supply Chain', <FaTruck />)}
          {renderNavItem('network-monitor', 'Network Monitor', <FaNetworkWired />, 'admin')}
          {renderNavItem('cross-chain', 'Cross-Chain View', <FaExchangeAlt />, 'admin')}
        </ul>
      </nav>
      
      <div className="px-3 pt-2 border-t border-gray-700">
        <h6 className="text-xs text-gray-400 uppercase mb-1">Network Status</h6>
        {renderNetworkStatus()}
      </div>
    </aside>
  );
};

export default Sidebar;
