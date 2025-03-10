import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import NotificationsPanel from '../../components/NotificationsPanel';

const RegisterProduct = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();
  const [distributors, setDistributors] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: 1,
    unitPrice: 0,
    manufacturingCost: 0,
    productionFacility: '',
    specifications: {},
    distributorId: '' // Selected distributor
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('form'); // 'form' or 'transfers'

  // Fetch distributors on component mount
  useEffect(() => {
    const fetchDistributors = async () => {
      try {
        const data = await api.get('/api/entities/distributor');
        
        if (data.success) {
          setDistributors(data.entities || []);
        } else {
          setError(data.message || 'Failed to load distributors');
        }
      } catch (err) {
        console.error('Error fetching distributors:', err);
        setError('Failed to load distributors');
      }
    };

    fetchDistributors();
  }, [api]);

  // Update error state when apiError changes
  useEffect(() => {
    if (apiError) {
      setError(apiError);
    }
  }, [apiError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSpecificationChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      specifications: {
        ...formData.specifications,
        [name]: value
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const payload = {
        ...formData,
        quantity: parseInt(formData.quantity),
        unitPrice: parseFloat(formData.unitPrice),
        manufacturingCost: parseFloat(formData.manufacturingCost),
        // Only include distributorId if one was selected
        ...(formData.distributorId && { distributorId: formData.distributorId })
      };

      const data = await api.post('/api/products/register', payload);

      if (data.success) {
        setSuccess({
          message: 'Product registered successfully!',
          productId: data.productId,
          serialNumberCount: data.serialNumberCount
        });
        
        // Reset form after successful submission
        setFormData({
          name: '',
          description: '',
          category: '',
          quantity: 1,
          unitPrice: 0,
          manufacturingCost: 0,
          productionFacility: '',
          specifications: {},
          distributorId: '' 
        });
        
        // Refresh transfers after a successful registration
        fetchTransfers();
      } else {
        setError(data.message || 'Failed to register product');
      }
    } catch (err) {
      console.error('Error registering product:', err);
      setError('An error occurred while registering the product');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      setTransfersLoading(true);
      const data = await api.get('/api/manufacturer/transfers');
      
      if (data.success) {
        // Process transfers to ensure all required fields exist
        const processedTransfers = (data.transfers || []).map(transfer => ({
          ...transfer,
          // Ensure transferId exists (fall back to id if needed)
          transferId: transfer.transferId || transfer.id || `transfer-${Date.now()}`,
          // Ensure timestamp is valid
          timestamp: transfer.timestamp || Date.now(),
          // Ensure distributorName exists
          distributorName: transfer.distributorName || 
                          (transfer.distributorId ? `Distributor ${transfer.distributorId.substring(0, 6)}` : 'Unknown')
        }));
        
        console.log('Processed transfers:', processedTransfers);
        setTransfers(processedTransfers);
      } else {
        console.error('Failed to fetch transfers:', data.message);
      }
    } catch (err) {
      console.error('Error fetching transfers:', err);
    } finally {
      setTransfersLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [api]);
  
  const checkTransferStatus = async (transferId) => {
    if (!transferId) {
      console.error('Transfer ID is undefined');
      alert('Error: Cannot check status for undefined transfer ID');
      return;
    }
    
    try {
      console.log(`Checking status for transfer: ${transferId}`);
      const response = await api.get(`/api/manufacturer/transfers/${transferId}/status`);
      
      if (response.success) {
        let statusDate = 'Unknown date';
        try {
          if (response.statusTimestamp) {
            statusDate = new Date(response.statusTimestamp).toLocaleString();
          }
        } catch (dateError) {
          console.error('Error formatting date:', dateError);
        }
        
        alert(`Status: ${response.currentStatus || 'Unknown'}\nTimestamp: ${statusDate}`);
      } else {
        alert(`Error: ${response.message || 'Could not retrieve status'}`);
      }
    } catch (err) {
      console.error('Error checking transfer status:', err);
      alert(`Failed to check transfer status: ${err.message}`);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      return new Date(timestamp).toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Product Management</h1>
        <div className="flex space-x-2">
          <button 
            onClick={() => setActiveTab('form')} 
            className={`px-4 py-2 rounded ${activeTab === 'form' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Register New Product
          </button>
          <button 
            onClick={() => setActiveTab('transfers')} 
            className={`px-4 py-2 rounded ${activeTab === 'transfers' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Transfers & Notifications
          </button>
        </div>
      </div>
      
      {activeTab === 'form' ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">Register New Product</h2>
          
          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-3 mb-4 bg-green-50 border border-green-200 text-green-700 rounded">
              <p className="font-medium">{success.message}</p>
              <p>Product ID: {success.productId}</p>
              <p>Serial Numbers Generated: {success.serialNumberCount}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product Name:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description:</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Category:</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity:</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  required
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Unit Price ($):</label>
                <input
                  type="number"
                  name="unitPrice"
                  value={formData.unitPrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Manufacturing Cost ($):</label>
                <input
                  type="number"
                  name="manufacturingCost"
                  value={formData.manufacturingCost}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Production Facility:</label>
              <input
                type="text"
                name="productionFacility"
                value={formData.productionFacility}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Assign to Distributor:</label>
              <select
                name="distributorId"
                value={formData.distributorId}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="">-- Select a distributor (optional) --</option>
                {distributors.map(distributor => (
                  <option key={distributor.id} value={distributor.id}>
                    {distributor.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                If selected, this distributor will be notified about the new product.
              </p>
            </div>
            
            <div>
              <h3 className="text-md font-medium mb-2">Product Specifications</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-3 rounded">
                <div>
                  <label className="block text-sm font-medium mb-1">Weight:</label>
                  <input
                    type="text"
                    name="weight"
                    value={formData.specifications.weight || ''}
                    onChange={handleSpecificationChange}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., 500g"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Dimensions:</label>
                  <input
                    type="text"
                    name="dimensions"
                    value={formData.specifications.dimensions || ''}
                    onChange={handleSpecificationChange}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., 10cm x 5cm x 2cm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Color:</label>
                  <input
                    type="text"
                    name="color"
                    value={formData.specifications.color || ''}
                    onChange={handleSpecificationChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Material:</label>
                  <input
                    type="text"
                    name="material"
                    value={formData.specifications.material || ''}
                    onChange={handleSpecificationChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || apiLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loading || apiLoading ? 'Registering...' : 'Register Product'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold mb-4">Recent Transfers</h2>
            {transfersLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading transfers...</p>
              </div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No recent transfers</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-2 px-3">ID</th>
                      <th className="text-left py-2 px-3">Distributor</th>
                      <th className="text-left py-2 px-3">Product</th>
                      <th className="text-left py-2 px-3">Date</th>
                      <th className="text-left py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((transfer, index) => (
                      <tr key={transfer.transferId || index} className="border-t">
                        <td className="py-2 px-3 text-sm">
                          {transfer.transferId ? 
                            `${transfer.transferId.substring(0, 8)}...` : 
                            'N/A'}
                        </td>
                        <td className="py-2 px-3">
                          {transfer.distributorName || 
                           (transfer.distributorId && `ID: ${transfer.distributorId.substring(0, 8)}...`) || 
                           'Unknown'}
                        </td>
                        <td className="py-2 px-3 text-sm">
                          {transfer.productName || 
                           (transfer.productId && `${transfer.productId.substring(0, 8)}...`) || 
                           'Unknown'}
                        </td>
                        <td className="py-2 px-3 text-sm">{formatDate(transfer.timestamp)}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => checkTransferStatus(transfer.transferId)}
                            className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs hover:bg-blue-100"
                          >
                            Check Status
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex justify-between items-center">
                  <button 
                    onClick={fetchTransfers}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center"
                  >
                    <span className="mr-1">🔄</span> Refresh Transfers
                  </button>
                  <span className="text-sm text-gray-500">
                    {transfers.length} transfer{transfers.length !== 1 ? 's' : ''} found
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-white p-4 rounded shadow">
            <NotificationsPanel maxNotifications={5} />
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterProduct;