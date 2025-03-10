import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useApi from '../../hooks/useApi';

const Products = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();
  const [products, setProducts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [serialsLoading, setSerialsLoading] = useState(false);

  // Fetch manufacturer's products and transfers on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all transfers
        const transfersData = await api.get('/api/manufacturer/transfers');
        
        if (transfersData.success) {
          setTransfers(transfersData.transfers || []);
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

  const handleCreateTransfer = (productId, distributorId) => {
    // Implement the function to create a transfer
    console.log(`Create transfer for product ${productId} to distributor ${distributorId}`);
    // We would navigate to a transfer form or open a modal here
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
                    <tr key={product.productId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.productId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.quantity || product.serialNumberCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(product.registrationDate).toLocaleDateString()}
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
                      <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                        No transfers found
                      </td>
                    </tr>
                  ) : (
                    transfers.map((transfer) => (
                      <tr key={transfer.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transfer.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {transfer.productName || transfer.productId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transfer.distributorName || transfer.distributorId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transfer.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transfer.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${transfer.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                              transfer.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                              'bg-red-100 text-red-800'}`}>
                            {transfer.status}
                          </span>
                        </td>
                      </tr>
                    ))
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
                  Serial Numbers - Product {selectedProduct}
                </h2>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              
              {serialsLoading ? (
                <div className="text-center py-4">Loading serial numbers...</div>
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