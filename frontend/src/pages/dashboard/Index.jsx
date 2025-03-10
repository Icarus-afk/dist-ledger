import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';

// Component for showing activity items
const ActivityItem = ({ item, type = "default" }) => {
  // Different item rendering based on dashboard type
  if (type === "manufacturer") {
    return (
      <div className="flex items-start pb-3 border-b last:border-0 last:pb-0">
        <div className="flex-shrink-0 w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center text-primary-600 mr-3">
          {item.action === 'registered' ? '📦' : '🔄'}
        </div>
        <div>
          <h4 className="font-medium">
            {item.action === 'registered' ? 'Product Registered' : 'Product Transferred'}
          </h4>
          <p className="text-sm text-neutral-500">
            {item.productName} ({item.productId})
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {new Date(item.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant={item.status === 'active' ? 'success' : 'neutral'}>
            {item.status}
          </Badge>
        </div>
      </div>
    );
  } else if (type === "distributor") {
    return (
      <div className="flex items-start pb-3 border-b last:border-0 last:pb-0">
        <div className="flex-shrink-0 w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center text-primary-600 mr-3">
          {item.action === 'received' ? '📦' : '🚚'}
        </div>
        <div>
          <h4 className="font-medium">
            {item.action === 'received' ? 'Product Received' : 'Product Shipped'}
          </h4>
          <p className="text-sm text-neutral-500">
            {item.productName} ({item.productId})
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {new Date(item.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="ml-auto">
          <Badge 
            variant={item.status === 'in stock' ? 'success' : item.status === 'shipped' ? 'info' : 'neutral'}
          >
            {item.status}
          </Badge>
        </div>
      </div>
    );
  } else if (type === "retailer") {
    return (
      <div className="flex items-start pb-3 border-b last:border-0 last:pb-0">
        <div className="flex-shrink-0 w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center text-primary-600 mr-3">
          {item.type === 'sale' ? '💰' : '↩️'}
        </div>
        <div>
          <h4 className="font-medium">
            {item.type === 'sale' ? 'Product Sold' : 'Product Returned'}
          </h4>
          <p className="text-sm text-neutral-500">
            {item.productName} ({item.productId})
          </p>
          <p className="text-xs text-neutral-500">
            {item.type === 'sale' ? 'Sold to: ' : 'Returned by: '}{item.customerName}
          </p>
          {item.type === 'return' && item.reason && (
            <p className="text-xs text-neutral-500">Reason: {item.reason}</p>
          )}
          <p className="text-xs text-neutral-400 mt-1">
            {new Date(item.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="ml-auto">
          {item.amount && (
            <span className={`font-medium ${item.type === 'sale' ? 'text-green-600' : 'text-accent-600'}`}>
              {item.type === 'sale' ? '+' : '-'}${item.amount.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    );
  } else if (type === "admin") {
    return (
      <div className="flex items-start pb-3 border-b last:border-0 last:pb-0">
        <div className="flex-shrink-0 w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center text-primary-600 mr-3">
          {item.type === 'user' ? '👤' : item.type === 'transaction' ? '🔄' : '🔧'}
        </div>
        <div>
          <h4 className="font-medium">{item.description}</h4>
          <p className="text-sm text-neutral-500">Actor: {item.actor}</p>
          <p className="text-xs text-neutral-400 mt-1">
            {new Date(item.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="ml-auto">
          <Badge
            variant={item.type === 'user' ? 'info' : item.type === 'transaction' ? 'success' : 'neutral'}
          >
            {item.type}
          </Badge>
        </div>
      </div>
    );
  }
};

// Component for showing alerts
const AlertsList = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="py-8 text-center text-neutral-400">
        <p>No alerts at this time</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {alerts.map((alert, index) => (
        <div
          key={index}
          className={`p-3 rounded-md ${
            alert.priority === 'high'
              ? 'bg-accent-50 border border-accent-200 text-accent-800'
              : alert.priority === 'medium'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-neutral-50 border border-neutral-200'
          }`}
        >
          <h4 className="font-medium text-sm">{alert.title}</h4>
          <p className="text-xs mt-1">{alert.message}</p>
          <p className="text-xs mt-2 text-neutral-500">
            {new Date(alert.timestamp).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
};

// Main dashboard component
const DashboardIndex = () => {
  const { userRole, currentUser } = useAuth();
  const { api } = useApi();
  const [data, setData] = useState({
    stats: {},
    recentItems: [],
    alerts: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Try to get data from dashboard API
        const response = await api.get('/api/dashboard/metrics');
        
        if (response.success && response.metrics) {
          setData({
            stats: response.metrics.stats || {},
            recentItems: response.metrics.recentActivity || [],
            alerts: response.metrics.alerts || []
          });
        } else {
          // Fallback to simple entity-specific calls
          let entityData = {};
          
          switch (userRole) {
            case 'manufacturer':
              { const productRes = await api.get('/api/manufacturer/products');
              if (productRes.success) {
                const products = productRes.products || [];
                
                // Calculate total serial numbers correctly
                let totalSerials = 0;
                products.forEach(product => {
                  // Check different possible field names for serial numbers
                  if (product.serialNumberCount !== undefined) {
                    totalSerials += product.serialNumberCount;
                  } else if (product.serialNumbers && Array.isArray(product.serialNumbers)) {
                    totalSerials += product.serialNumbers.length;
                  } else if (product.quantityWithSerials !== undefined) {
                    totalSerials += product.quantityWithSerials;
                  } else if (product.quantity !== undefined) {
                    // If no specific serial number field exists, use quantity as fallback
                    totalSerials += product.quantity;
                  }
                });
                
                entityData = {
                  stats: {
                    totalProducts: products.length,
                    activeProducts: products.filter(p => !p.discontinued).length,
                    totalSerialNumbers: totalSerials, // Use our calculated value
                    completedTransfers: 0,
                    pendingTransfers: 0,
                    productionStatus: 'Normal'
                  },
                  recentItems: products.slice(0, 5).map(p => ({
                    productId: p.productId,
                    productName: p.name,
                    action: 'registered',
                    status: p.discontinued ? 'discontinued' : 'active',
                    timestamp: p.registrationDate || Date.now()
                  })),
                  alerts: []
                };
              }
              break; }
              
            case 'distributor':
              { const invRes = await api.get('/api/distributor/inventory');
              if (invRes.success) {
                const inventory = invRes.inventory || [];
                entityData = {
                  stats: {
                    inventoryCount: inventory.reduce((sum, item) => sum + (item.quantity || 0), 0),
                    lowStockItems: inventory.filter(item => (item.quantity || 0) < 5).length,
                    pendingShipments: 0,
                    completedShipments: 0,
                    incomingTransfers: 0,
                    recentlyReceivedTransfers: 0
                  },
                  recentItems: inventory.slice(0, 5).map(item => ({
                    productId: item.productId,
                    productName: item.productName || `Product ${item.productId?.substring(0, 8)}...`,
                    action: 'received',
                    status: 'in stock',
                    timestamp: item.receivedDate || Date.now()
                  })),
                  alerts: []
                };
              }
              break; }
              
            case 'retailer':
              { const salesRes = await api.get('/api/retailer/sales/history');
              if (salesRes.success) {
                const sales = salesRes.sales || [];
                entityData = {
                  stats: {
                    totalSales: sales.reduce((sum, sale) => sum + (sale.price || 0), 0),
                    salesCount: sales.length,
                    inventoryCount: 0,
                    pendingReceiving: 0,
                    pendingReturns: 0,
                    processedReturns: 0
                  },
                  recentItems: sales.slice(0, 5).map(sale => ({
                    productId: sale.productId,
                    productName: sale.productName || `Product ${sale.productId?.substring(0, 8)}...`,
                    type: 'sale',
                    customerName: sale.customerName || `Customer ${sale.customerId || ''}`,
                    amount: sale.price,
                    timestamp: sale.saleDate || sale.timestamp || Date.now()
                  })),
                  alerts: []
                };
              }
              break; }
              
            case 'admin':
              entityData = {
                stats: {
                  manufacturerCount: 5,
                  distributorCount: 10,
                  retailerCount: 15,
                  productCount: 500,
                  newProducts: 25,
                  nodeCount: 8,
                  networkStatus: 'healthy',
                  blockHeight: 5824,
                  lastUpdated: Date.now()
                },
                recentItems: [],
                alerts: []
              };
              break;
          }
          
          setData(entityData);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Couldn't load dashboard data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [api, userRole]);

  // Manufacturer specific dashboard
  const ManufacturerDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-neutral-500">Total Products</h3>
          <p className="text-2xl font-semibold mt-1">{data.stats.totalProducts || 0}</p>
          <p className="text-xs text-neutral-500 mt-1">
            {data.stats.activeProducts || 0} active products
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-neutral-500">Total Serial Numbers</h3>
          <p className="text-2xl font-semibold mt-1">{data.stats.totalSerialNumbers || 0}</p>
          <p className="text-xs text-neutral-500 mt-1">Across all products</p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-neutral-500">Product Transfers</h3>
          <p className="text-2xl font-semibold mt-1">{data.stats.completedTransfers || 0}</p>
          <p className="text-xs text-neutral-500 mt-1">
            {data.stats.pendingTransfers || 0} pending transfers
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-neutral-500">Production Status</h3>
          <div className="flex items-center mt-2">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            <p className="font-medium">{data.stats.productionStatus || 'Normal'}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="p-4 border-b">
              <h2 className="text-lg font-medium">Recent Activity</h2>
            </div>
            <div className="p-4">
              {data.recentItems && data.recentItems.length > 0 ? (
                <div className="space-y-4">
                  {data.recentItems.map((item, index) => (
                    <ActivityItem key={index} item={item} type="manufacturer" />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-400">
                  <p>No recent activity to display</p>
                </div>
              )}
            </div>
            <div className="p-3 border-t bg-neutral-50">
              <Link to="/manufacturer/products" className="text-sm text-primary-600 hover:text-primary-800">
                View all products →
              </Link>
            </div>
          </Card>
        </div>

        <div>
          <Card>
            <div className="p-4 border-b">
              <h2 className="text-lg font-medium">Alerts & Notifications</h2>
            </div>
            <div className="p-4">
              <AlertsList alerts={data.alerts} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  // Simple dashboard renderer based on role
  const renderDashboard = () => {
    switch (userRole) {
      case 'manufacturer':
        return <ManufacturerDashboard />;
      // You can add other role-specific dashboards as needed
      default:
        return (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Welcome to TechChain Supply Network</h2>
            <p className="mb-4">
              Your dashboard is currently being set up based on your role: <strong>{userRole}</strong>
            </p>
            <div className="flex space-x-4 mt-6">
              <Link to="/login">
                <Button variant="outline">Switch Account</Button>
              </Link>
            </div>
          </Card>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-800">Dashboard</h1>
        <div className="text-sm text-neutral-500">
          Welcome back, <span className="font-medium">{currentUser?.name || currentUser?.username || 'User'}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-accent-50 border border-accent-200 text-accent-700 rounded-md">
          {error}
        </div>
      ) : (
        renderDashboard()
      )}
    </div>
  );
};

export default DashboardIndex;