import React, { useState, useEffect } from 'react';
import useApi from '../../hooks/useApi';

const RetailerInventory = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();
  
  // State for data
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [pendingShipments, setPendingShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [inventoryStats, setInventoryStats] = useState({
    totalProducts: 0,
    totalQuantity: 0,
    uniqueProducts: 0
  });

  // Load data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch pending shipments first (this should work)
        const pendingData = await api.get('/api/retailer/pending-shipments');
        console.log('Pending shipments data:', pendingData);
        
        if (pendingData.success && pendingData.shipments) {
          setPendingShipments(pendingData.shipments || []);
        }

        // Then try to fetch inventory (may return 404 if stream doesn't exist yet)
        try {
          const inventoryData = await api.get('/api/retailer/inventory');
          console.log('Inventory data:', inventoryData);
          
          if (inventoryData.success && inventoryData.inventory) {
            setInventory(inventoryData.inventory);
            setFilteredInventory(inventoryData.inventory);
            
            // Calculate inventory statistics
            const stats = {
              totalProducts: inventoryData.inventory.length,
              totalQuantity: inventoryData.inventory.reduce((sum, item) => sum + (item.quantity || 0), 0),
              uniqueProducts: new Set(inventoryData.inventory.map(item => item.productId)).size
            };
            setInventoryStats(stats);
          }
        } catch (inventoryError) {
          console.log('Inventory not available yet:', inventoryError);
          // This is expected if no shipments have been received yet
          // Don't set an error for this, just show empty state
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(`Failed to load data: ${err.message || "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [api]); // Add api as dependency

  // Update filtered inventory when search term or inventory changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredInventory(inventory);
    } else {
      const filtered = inventory.filter(item => {
        return (
          item.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.productName && item.productName.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      });
      setFilteredInventory(filtered);
    }
  }, [searchTerm, inventory]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Handle accepting a shipment
  const handleAcceptShipment = async (shipment) => {
    try {
      setLoading(true);
      
      // Prepare shipment acceptance data
      const acceptanceData = {
        shipmentId: shipment.shipmentId,
        distributorId: shipment.distributorId,
        productId: shipment.productId,
        serialNumbers: shipment.serialNumbers
      };
      
      console.log('Accepting shipment:', acceptanceData);
      
      const response = await api.post('/api/retailer/receive-from-distributor', acceptanceData);
      
      if (response.success) {
        alert('Shipment received successfully!');
        
        // Refresh pending shipments list
        const pendingData = await api.get('/api/retailer/pending-shipments');
        if (pendingData.success) {
          setPendingShipments(pendingData.shipments || []);
        }
        
        // Refresh inventory
        try {
          const inventoryData = await api.get('/api/retailer/inventory');
          if (inventoryData.success) {
            setInventory(inventoryData.inventory || []);
            setFilteredInventory(inventoryData.inventory || []);
            
            // Update stats
            const stats = {
              totalProducts: inventoryData.inventory.length,
              totalQuantity: inventoryData.inventory.reduce((sum, item) => sum + (item.quantity || 0), 0),
              uniqueProducts: new Set(inventoryData.inventory.map(item => item.productId)).size
            };
            setInventoryStats(stats);
          }
        } catch (inventoryError) {
          console.error('Error refreshing inventory:', inventoryError);
        }
      } else {
        setError(response.message || 'Failed to accept shipment');
      }
    } catch (err) {
      console.error('Error accepting shipment:', err);
      setError(`Failed to accept shipment: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const getRetailerInventoryForProduct = async (retailerId, productId) => {
  try {
    // Find the retailer entity to get its stream names
    const entity = config.entityStore.retailers[retailerId];

    if (!entity || !entity.streams || !entity.streams.inventory) {
      throw new Error(`Cannot find inventory stream for retailer ${retailerId}`);
    }

    // Get the inventory stream name from entity config
    const streamName = entity.streams.inventory;

    // Stream key for this product - ensure consistent format
    const streamKey = `${productId}-${retailerId}`;

    console.log(`Looking up inventory for retailer ${retailerId}, product ${productId} with key ${streamKey}`);

    // Get inventory records from the retailer chain
    const inventoryData = await executeCommand(
      'retailer-chain',
      `liststreamkeyitems ${streamName} ${streamKey}`
    );

    const inventoryItems = JSON.parse(inventoryData);
    console.log(`Found ${inventoryItems.length} inventory records for ${streamKey}`);

    // Process the inventory items to get current state
    const serialNumbersInStock = new Set();

    for (const item of inventoryItems) {
      try {
        const inventoryUpdate = JSON.parse(Buffer.from(item.data, 'hex').toString());
        console.log(`Processing inventory update: ${JSON.stringify(inventoryUpdate)}`);

        if (inventoryUpdate.operation === 'add') {
          // Add serial numbers to stock
          inventoryUpdate.serialNumbers.forEach(serial => {
            serialNumbersInStock.add(serial);
            console.log(`Added serial ${serial} to inventory`);
          });
        } else if (inventoryUpdate.operation === 'remove') {
          // Remove serial numbers from stock
          inventoryUpdate.serialNumbers.forEach(serial => {
            serialNumbersInStock.delete(serial);
            console.log(`Removed serial ${serial} from inventory`);
          });
        }
      } catch (parseError) {
        console.error(`Error parsing inventory item: ${parseError.message}`);
      }
    }

    const serialNumbers = Array.from(serialNumbersInStock);
    console.log(`Final inventory for ${productId}: ${serialNumbers.length} items in stock`);

    return {
      productId,
      retailerId,
      quantity: serialNumbers.length,
      serialNumbers
    };
  } catch (error) {
    console.error(`Failed to get retailer inventory for ${productId}:`, error);
    throw error;
  }
};

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <span className="mr-2 text-blue-600 text-2xl">📦</span>
          <h1 className="text-2xl font-bold">Retailer Inventory</h1>
        </div>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="px-3 py-1 bg-gray-500 text-white rounded"
        >
          {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {showDebug && (
        <div className="p-3 mb-4 bg-gray-100 border border-gray-200 rounded">
          <h3 className="font-bold mb-2">Debug Information</h3>
          <p>Pending Shipments: {pendingShipments.length}</p>
          <p>Inventory Items: {inventory.length}</p>
          <p>API Loading: {apiLoading ? 'Yes' : 'No'}</p>
          <p>API Error: {apiError || 'None'}</p>
          <button 
            onClick={async () => {
              try {
                setLoading(true);
                const pendingData = await api.get('/api/retailer/pending-shipments');
                setPendingShipments(pendingData.shipments || []);
                alert(`Refreshed: found ${pendingData.shipments?.length || 0} pending shipments`);
              } catch (e) {
                console.error(e);
                alert(`Error: ${e.message}`);
              } finally {
                setLoading(false);
              }
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm mt-2"
          >
            Refresh Pending Shipments
          </button>
          <details>
            <summary className="cursor-pointer font-semibold text-blue-600 mt-2">Raw Data</summary>
            <pre className="mt-2 p-2 bg-gray-800 text-green-400 text-xs overflow-auto max-h-60">
              {JSON.stringify({ inventory, pendingShipments }, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm mb-1">Total Products</p>
          <p className="text-2xl font-semibold">{inventoryStats.totalProducts}</p>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm mb-1">Total Units</p>
          <p className="text-2xl font-semibold">{inventoryStats.totalQuantity}</p>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm mb-1">Unique Products</p>
          <p className="text-2xl font-semibold">{inventoryStats.uniqueProducts}</p>
        </div>
      </div>

      {/* Pending Shipments Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Pending Shipments</h2>
        {loading || apiLoading ? (
          <div className="text-center py-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : pendingShipments.length > 0 ? (
          <div className="overflow-x-auto bg-white rounded shadow">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipment ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distributor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pendingShipments.map((shipment) => (
                  <tr key={shipment.shipmentId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{shipment.shipmentId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{shipment.distributorName || shipment.distributorId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{shipment.productName || shipment.productId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{shipment.quantity || shipment.serialNumbers?.length || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(shipment.createdAt || shipment.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleAcceptShipment(shipment)}
                        disabled={loading}
                        className={`text-green-600 ${loading ? 'bg-green-50' : 'bg-green-100 hover:bg-green-200'} px-3 py-1 rounded text-xs`}
                      >
                        {loading ? 'Processing...' : 'Accept Shipment'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 bg-white rounded shadow text-gray-500">
            No pending shipments
          </div>
        )}
      </div>

      <div className="mb-6 relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          🔍
        </span>
        <input
          type="text"
          placeholder="Search Products"
          className="w-full p-2 pl-10 border border-gray-300 rounded"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>

      {/* Current Inventory Section */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Current Inventory</h2>
        {loading || apiLoading ? (
          <div className="text-center py-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredInventory.length > 0 ? (
          <div className="bg-white rounded shadow overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial Numbers</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={item.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{item.productId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{item.productName || "Unknown Product"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${item.quantity > 10 
                            ? "bg-green-100 text-green-800" 
                            : item.quantity > 5 
                              ? "bg-yellow-100 text-yellow-800" 
                              : "bg-red-100 text-red-800"}`}
                      >
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.serialNumbers?.slice(0, 2).join(', ')}
                      {item.serialNumbers?.length > 2 && '...'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button 
                        onClick={() => alert(`Serial Numbers: ${item.serialNumbers?.join(", ") || "None"}`)}
                        className="text-blue-600 border border-blue-600 px-3 py-1 rounded text-xs"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 bg-white border rounded text-gray-500">
            {searchTerm ? "No matching products found" : "No products in inventory yet. Accept shipments to add products."}
          </div>
        )}
      </div>
    </div>
  );
};

export default RetailerInventory;