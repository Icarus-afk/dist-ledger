import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useApi from '../../hooks/useApi';

const Products = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();
  const [products, setProducts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [transferStatuses, setTransferStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState({});

  // Fetch manufacturer's products and transfers on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all transfers
        const transfersData = await api.get('/api/manufacturer/transfers');
        
        if (transfersData.success) {
          // Process transfers to normalize data
          const processedTransfers = (transfersData.transfers || []).map(transfer => ({
            ...transfer,
            id: transfer.id || transfer.transferId,
            transferId: transfer.transferId || transfer.id,
            createdAt: transfer.createdAt || transfer.timestamp || Date.now(),
            status: transfer.status || 'pending',
            quantity: transfer.quantity || transfer.serialNumbers?.length || 0
          }));
          
          setTransfers(processedTransfers);
          
          // Fetch status for each transfer
          for (const transfer of processedTransfers) {
            fetchTransferStatus(transfer.transferId || transfer.id);
          }
        }

        // Fetch all products in the system
        const productsData = await api.get('/api/manufacturer/products');
        
        if (productsData.success) {
          setProducts(productsData.products || []);
        } else {
          setError(productsData.message || 'Failed to load products');
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load products data');
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

  const fetchTransferStatus = async (transferId) => {
    if (!transferId) return;
    
    try {
      setStatusLoading(prev => ({ ...prev, [transferId]: true }));
      
      console.log(`Fetching status for transfer: ${transferId}`);
      const response = await api.get(`/api/manufacturer/transfers/${transferId}/status`);
      
      if (response.success) {
        setTransferStatuses(prev => ({
          ...prev,
          [transferId]: {
            currentStatus: response.currentStatus || 'pending',
            timestamp: response.statusTimestamp || Date.now()
          }
        }));
      }
    } catch (err) {
      console.error(`Error fetching status for transfer ${transferId}:`, err);
    } finally {
      setStatusLoading(prev => ({ ...prev, [transferId]: false }));
    }
  };

  const fetchSerialNumbers = async (productId) => {
    if (!productId) return;
    
    setSerialsLoading(true);
    setError(null);
    
    try {
      const data = await api.get(`/api/manufacturer/products/${productId}/serials`);
      
      if (data.success) {
        setSerialNumbers(data.serialNumbers || []);
        setSelectedProduct(productId);
      } else {
        setError(data.message || 'Failed to fetch serial numbers');
      }
    } catch (err) {
      console.error('Error fetching serial numbers:', err);
      setError('Failed to load serial numbers');
    } finally {
      setSerialsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Invalid date';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'shipped':
        return 'bg-blue-100 text-blue-800';
      case 'received':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Products</h1>
        <Link 
          to="/manufacturer/register-product" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Register New Product
        </Link>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading || apiLoading ? (
        <div className="text-center py-4">Loading products...</div>
      ) : (
        <div className="space-y-6">
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
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                      No products registered yet
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.productId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.productId ? 
                          <span title={product.productId}>{product.productId.substring(0, 8)}...</span> : 
                          'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.name || 'Unnamed Product'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.category || 'Uncategorized'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.quantity || product.serialNumberCount || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(product.registrationDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => fetchSerialNumbers(product.productId)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View Serials
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Transfers Section */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Product Transfers</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transfer ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Distributor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                        No transfers found
                      </td>
                    </tr>
                  ) : (
                    transfers.map((transfer) => {
                      const transferId = transfer.transferId || transfer.id;
                      const status = transferStatuses[transferId]?.currentStatus || transfer.status || 'pending';
                      
                      return (
                        <tr key={transferId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {transferId ? 
                              <span title={transferId}>{transferId.substring(0, 8)}...</span> : 
                              'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {transfer.productName || 
                              (transfer.productId && <span title={transfer.productId}>{transfer.productId.substring(0, 8)}...</span>) || 
                              'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {transfer.distributorName || 
                              (transfer.distributorId && <span title={transfer.distributorId}>{transfer.distributorId.substring(0, 8)}...</span>) || 
                              'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {transfer.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(transfer.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${getStatusBadgeClass(status)}`}>
                              {status}
                            </span>
                            {transferStatuses[transferId] && (
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(transferStatuses[transferId].timestamp)}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Serial Numbers Modal/Section */}
          {selectedProduct && (
            <div className="mt-8 p-4 border rounded-lg bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  Serial Numbers - Product {selectedProduct.substring(0, 8)}...
                </h2>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              
              {serialsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Loading serial numbers...</p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  {serialNumbers.length === 0 ? (
                    <p className="text-sm text-gray-500">No serial numbers found</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {serialNumbers.map((serial, index) => (
                        <div key={index} className="p-2 border rounded text-sm bg-white">
                          {serial}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Products;