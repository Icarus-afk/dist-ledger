import React, { useState, useEffect } from 'react';
import useApi from '../../hooks/useApi';

const Inventory = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();
  
  // State for data
  const [inventory, setInventory] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form state
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [productId, setProductId] = useState('');
  const [serialNumbersInput, setSerialNumbersInput] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  
  // Load data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch inventory
        const inventoryData = await api.get('/api/distributor/inventory');
        console.log('Inventory data:', inventoryData);
        if (inventoryData.success) {
          setInventory(inventoryData.inventory || []);
        }
        
        // Fetch pending transfers
        const pendingData = await api.get('/api/distributor/pending-transfers');
        console.log('Pending transfers data:', pendingData);
        if (pendingData.success) {
          setPendingTransfers(pendingData.transfers || []);
        }
        
        // Fetch manufacturers for the form
        const manufacturersData = await api.get('/api/entities/manufacturer');
        console.log('Manufacturers data:', manufacturersData);
        if (manufacturersData.success) {
          setManufacturers(manufacturersData.entities || []);
        }
      } catch (err) {
        console.error('Error fetching inventory data:', err);
        setError('Failed to load inventory data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [api]);
  
  // Update error state when apiError changes
  useEffect(() => {
    if (apiError) {
      setError(apiError);
    }
  }, [apiError]);
  
  // Handle receiving products from manufacturer
  const handleReceiveProducts = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedManufacturer || !productId || !serialNumbersInput) {
      setError('Please fill in all fields');
      return;
    }
    
    const serialNumbers = serialNumbersInput
      .split('\n')
      .map(s => s.trim())
      .filter(s => s !== '');
    
    if (serialNumbers.length === 0) {
      setError('Please enter at least one serial number');
      return;
    }
    
    try {
      const response = await api.post('/api/distributor/receive-from-manufacturer', {
        manufacturerId: selectedManufacturer,
        productId,
        serialNumbers
      });
      
      if (response.success) {
        alert('Products received successfully!');
        setSelectedManufacturer('');
        setProductId('');
        setSerialNumbersInput('');
        
        // Refresh inventory data
        const inventoryData = await api.get('/api/distributor/inventory');
        if (inventoryData.success) {
          setInventory(inventoryData.inventory || []);
        }
      } else {
        setError(response.message || 'Failed to receive products');
      }
    } catch (err) {
      console.error('Error receiving products:', err);
      setError('Failed to receive products');
    }
  };
  
  // Handle accepting transfer
  const handleAcceptTransfer = async (transfer) => {
    try {
      const response = await api.post('/api/distributor/receive-from-manufacturer', {
        manufacturerId: transfer.manufacturerId,
        productId: transfer.productId,
        serialNumbers: transfer.serialNumbers
      });
      
      if (response.success) {
        alert('Transfer accepted successfully!');
        
        // Refresh data
        const [inventoryData, pendingData] = await Promise.all([
          api.get('/api/distributor/inventory'),
          api.get('/api/distributor/pending-transfers')
        ]);
        
        if (inventoryData.success) {
          setInventory(inventoryData.inventory || []);
        }
        
        if (pendingData.success) {
          setPendingTransfers(pendingData.transfers || []);
        }
      } else {
        setError(response.message || 'Failed to accept transfer');
      }
    } catch (err) {
      console.error('Error accepting transfer:', err);
      setError('Failed to accept transfer');
    }
  };
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Distributor Inventory</h1>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="px-3 py-1 bg-gray-500 text-white rounded"
        >
          {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
        </button>
      </div>
      
      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {showDebug && (
        <div className="p-3 mb-4 bg-gray-100 border border-gray-200 rounded">
          <h3 className="font-bold mb-2">Debug Information</h3>
          <p>Pending Transfers: {pendingTransfers.length}</p>
          <p>Inventory Items: {inventory.length}</p>
          <p>Manufacturers: {manufacturers.length}</p>
          <details>
            <summary className="cursor-pointer font-semibold text-blue-600">Raw Data</summary>
            <pre className="mt-2 p-2 bg-gray-800 text-green-400 text-xs overflow-auto">
              {JSON.stringify({ inventory, pendingTransfers, manufacturers }, null, 2)}
            </pre>
          </details>
        </div>
      )}
      
      {/* Pending Transfers Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Pending Transfers</h2>
        {loading || apiLoading ? (
          <div className="text-center py-4">Loading transfers...</div>
        ) : pendingTransfers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transfer ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Manufacturer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingTransfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transfer.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transfer.manufacturerName || transfer.manufacturerId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transfer.productDetails?.name || transfer.productId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transfer.serialNumbers?.length || transfer.quantity || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transfer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleAcceptTransfer(transfer)}
                        className="text-green-600 hover:text-green-900 bg-green-100 px-3 py-1 rounded"
                      >
                        Accept
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">No pending transfers</div>
        )}
      </div>
      
      {/* Receive Products Form */}
      <div className="mb-8 bg-gray-50 p-4 rounded border border-gray-200">
        <h2 className="text-xl font-semibold mb-3">Receive Products Manually</h2>
        <form onSubmit={handleReceiveProducts}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manufacturer
            </label>
            <select
              value={selectedManufacturer}
              onChange={(e) => setSelectedManufacturer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">Select a manufacturer</option>
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.id}>
                  {manufacturer.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product ID
            </label>
            <input
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter product ID"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serial Numbers (one per line)
            </label>
            <textarea
              value={serialNumbersInput}
              onChange={(e) => setSerialNumbersInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="5"
              placeholder="Enter serial numbers, one per line"
              required
            />
          </div>
          
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Receive Products
          </button>
        </form>
      </div>
      
      {/* Current Inventory Section */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Current Inventory</h2>
        {loading || apiLoading ? (
          <div className="text-center py-4">Loading inventory...</div>
        ) : inventory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventory.map((item) => (
                  <tr key={item.productId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.productId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.productName || "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.serialNumbers?.length || item.quantity || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => alert(`Serial Numbers: ${item.serialNumbers?.join(", ") || "None"}`)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Serial Numbers
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">No inventory items found</div>
        )}
      </div>
    </div>
  );
};

export default Inventory;