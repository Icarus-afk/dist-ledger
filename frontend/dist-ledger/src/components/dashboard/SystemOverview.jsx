import { FaArrowRight, FaArrowDown } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';

const SystemOverview = ({ stats, currentRole, loading }) => {
  // Initialize with default values if stats is undefined
  const statsData = {
    distributor: stats?.distributor || { productCount: '--', transactionCount: '--' },
    retailer: stats?.retailer || { productCount: '--', salesCount: '--' },
    main: stats?.main || { verifiedProducts: '--', eventsCount: '--' }
  };
  
  // Format display data based on role access
  const distributorData = {
    products: currentRole === 'distributor' || currentRole === 'admin' 
      ? statsData.distributor.productCount 
      : '-- (No Access)',
    transactions: currentRole === 'distributor' || currentRole === 'admin'
      ? statsData.distributor.transactionCount
      : '-- (No Access)'
  };
  
  const retailerData = {
    products: currentRole === 'retailer' || currentRole === 'admin'
      ? statsData.retailer.productCount
      : '-- (No Access)',
    sales: currentRole === 'retailer' || currentRole === 'admin'
      ? statsData.retailer.salesCount
      : '-- (No Access)'
  };
  
  if (loading) {
    return (
      <div className="card">
        <div className="card-header flex justify-between">
          <span>System Overview</span>
          <span className="text-gray-500">Loading data...</span>
        </div>
        <div className="card-body">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex justify-between">
        <span>System Overview</span>
        <span className="text-gray-500">Real-time data</span>
      </div>
      <div className="card-body">
        <div className="bg-gray-100 p-6 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <div className="bg-distributor text-white p-4 rounded-lg text-center">
                <h5 className="font-bold mb-2">Distributor Chain</h5>
                <div>Products: <span>{distributorData.products}</span></div>
                <div>Transactions: <span>{distributorData.transactions}</span></div>
              </div>
            </div>
            
            <div className="md:col-span-2 flex items-center justify-center">
              <div className="text-center">
                <FaArrowRight className="text-2xl mx-auto text-gray-500" />
                <div className="text-sm text-gray-600">Relay</div>
              </div>
            </div>
            
            <div className="md:col-span-5">
              <div className="bg-retailer text-white p-4 rounded-lg text-center">
                <h5 className="font-bold mb-2">Retailer Chain</h5>
                <div>Products: <span>{retailerData.products}</span></div>
                <div>Sales: <span>{retailerData.sales}</span></div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center my-4">
            <FaArrowDown className="text-2xl text-gray-500" />
          </div>
          
          <div className="bg-main text-white p-4 rounded-lg text-center">
            <h5 className="font-bold mb-2">Main Ledger</h5>
            <div>Verified Products: <span>{statsData.main.verifiedProducts}</span></div>
            <div>Supply Chain Events: <span>{statsData.main.eventsCount}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemOverview;