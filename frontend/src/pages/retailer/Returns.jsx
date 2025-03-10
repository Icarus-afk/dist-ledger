import React, { useState, useEffect } from 'react';
import useApi from '../../hooks/useApi';

const RetailerReturns = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();
  
  const [tabValue, setTabValue] = useState(0);
  const [returnData, setReturnData] = useState({
    serialNumber: '',
    productId: '',
    saleId: '',
    reason: '',
    condition: 'good',
    customerName: '',
    customerContact: '',
    notes: ''
  });
  const [returnHistory, setReturnHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [expandedSale, setExpandedSale] = useState(null);

  useEffect(() => {
    // Load return history when component mounts
    fetchReturnHistory();
    
    // Load inventory for the returns processing
    fetchInventory();
    
    // Load sales history to reference for returns
    fetchSalesHistory();
  }, []);

  const handleTabChange = (newValue) => {
    setTabValue(newValue);
  };

  const fetchReturnHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await api.get('/api/retailer/returns/history');
      
      if (response.success) {
        setReturnHistory(response.returns || []);
      } else {
        setError(response.message || 'Failed to load return history');
      }
    } catch (err) {
      console.error('Error fetching return history:', err);
      setError('Failed to load return history. Please try again.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/retailer/inventory');
      
      if (response.success) {
        setInventory(response.inventory || []);
      } else {
        console.error('Error fetching inventory:', response.message);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesHistory = async () => {
    try {
      setSalesLoading(true);
      const response = await api.get('/api/retailer/sales/history');
      
      if (response.success) {
        setSales(response.sales || []);
      } else {
        console.error('Error fetching sales history:', response.message);
      }
    } catch (err) {
      console.error('Error fetching sales history:', err);
    } finally {
      setSalesLoading(false);
    }
  };

  const handleReturnDataChange = (e) => {
    const { name, value } = e.target;
    setReturnData({
      ...returnData,
      [name]: value
    });
  };

  const handleSaleSelection = (saleId) => {
    const selectedSale = sales.find(sale => sale.saleId === saleId);
    
    if (selectedSale) {
      // If there are items in the sale
      if (selectedSale.items && selectedSale.items.length > 0) {
        // For single item sales, fill in all item details automatically
        if (selectedSale.items.length === 1) {
          const item = selectedSale.items[0];
          const serialNumber = item.serialNumbers && item.serialNumbers.length > 0 
            ? item.serialNumbers[0] 
            : (item.serialNumber || '');
            
          setReturnData({
            ...returnData,
            saleId,
            productId: item.productId,
            serialNumber: serialNumber,
            // Pre-fill customer name if available from sales data
            customerName: selectedSale.customerName !== 'Anonymous' ? selectedSale.customerName : returnData.customerName
          });
          setExpandedSale(null); // Close any expanded view
        } else {
          // For multi-item sales, set the sale ID and expand the item list
          setReturnData({
            ...returnData,
            saleId,
            // Pre-fill customer name if available
            customerName: selectedSale.customerName !== 'Anonymous' ? selectedSale.customerName : returnData.customerName
          });
          
          // Toggle the expanded state for this sale
          setExpandedSale(expandedSale === saleId ? null : saleId);
        }
      } else {
        // Just set the sale ID if no items data is available
        setReturnData({
          ...returnData,
          saleId
        });
        setExpandedSale(null);
      }
    }
  };

  const handleProductSelection = (productId, serialNumber) => {
    setReturnData({
      ...returnData,
      productId,
      serialNumber
    });
    
    // Clear any errors
    setError(null);
    
    // Close the expanded view after selection
    setExpandedSale(null);
  };

  const validateReturnData = () => {
    if (!returnData.saleId) return 'Sale ID is required';
    if (!returnData.productId) return 'Product ID is required';
    if (!returnData.serialNumber) return 'Serial number is required';
    if (!returnData.reason) return 'Return reason is required';
    return null;
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    
    const validationError = validateReturnData();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await api.post('/api/retailer/returns/process', {
        saleId: returnData.saleId,
        productId: returnData.productId,
        serialNumber: returnData.serialNumber,
        reason: returnData.reason,
        condition: returnData.condition,
        customerName: returnData.customerName,
        customerContact: returnData.customerContact,
        notes: returnData.notes
      });
      
      if (response.success) {
        setSuccess(true);
        setReturnData({
          serialNumber: '',
          productId: '',
          saleId: '',
          reason: '',
          condition: 'good',
          customerName: '',
          customerContact: '',
          notes: ''
        });
        
        // Refresh the return history
        fetchReturnHistory();
        
        // Refresh inventory since a product has been returned
        fetchInventory();
        
        // Refresh sales history as well
        fetchSalesHistory();
      } else {
        setError(response.message || 'Failed to process return');
      }
    } catch (err) {
      console.error('Error processing return:', err);
      setError('Failed to process return. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const viewReturnDetails = (returnId) => {
    const returnItem = returnHistory.find(item => item.returnId === returnId);
    if (returnItem) {
      setSelectedReturn(returnItem);
      setDetailsOpen(true);
    }
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedReturn(null);
  };

  // Helper function to render product items for multi-item sales
  const renderSaleItems = (sale) => {
    if (!sale.items || sale.items.length === 0) {
      return null;
    }
    
    return (
      <div className="pl-4 pt-2 pb-2 text-sm border-t border-gray-100 bg-blue-50">
        <p className="font-medium text-gray-700 mb-2">Select Item to Return:</p>
        <div className="space-y-2">
          {sale.items.map((item, index) => {
            // Handle both single serialNumber and array of serialNumbers
            const serialNumbers = item.serialNumbers || (item.serialNumber ? [item.serialNumber] : []);
            
            return serialNumbers.map((serial, serialIndex) => (
              <div 
                key={`${item.productId}-${serial}-${serialIndex}`} 
                className="flex justify-between items-center p-2 rounded bg-white border border-blue-100"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-gray-800">
                    {item.productName || `Product ${index + 1}`}
                  </span>
                  <span className="text-xs text-gray-500">
                    ID: {item.productId} | SN: {serial}
                  </span>
                </div>
                <button 
                  onClick={() => handleProductSelection(item.productId, serial)}
                  className="text-xs py-1 px-3 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Select
                </button>
              </div>
            ));
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <span className="mr-2 text-blue-600">↩️</span>
          Returns Management
        </h1>
      </div>

      {/* Tab navigation */}
      <div className="bg-white shadow rounded mb-6">
        <div className="flex border-b">
          <button
            className={`px-4 py-2 text-sm font-medium flex items-center flex-1 justify-center ${
              tabValue === 0 
                ? "border-b-2 border-blue-500 text-blue-600" 
                : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => handleTabChange(0)}
          >
            <span className="mr-2">↩️</span> Process Return
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium flex items-center flex-1 justify-center ${
              tabValue === 1 
                ? "border-b-2 border-blue-500 text-blue-600" 
                : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => handleTabChange(1)}
          >
            <span className="mr-2">📃</span> Returns History
          </button>
        </div>
      </div>

      {/* Process Return Tab */}
      {tabValue === 0 && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-7/12">
            <div className="bg-white shadow rounded p-4 mb-4">
              <h2 className="text-lg font-medium mb-4">Return Details</h2>
              <form onSubmit={handleProcessReturn}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale ID <span className="text-red-500">*</span>
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      name="saleId"
                      value={returnData.saleId}
                      onChange={handleReturnDataChange}
                      className="w-full p-2 border border-gray-300 rounded"
                      required
                    />
                  </div>
                  {returnData.saleId && (
                    <p className="text-xs text-blue-600 mt-1">
                      ✓ Sale selected
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="productId"
                      value={returnData.productId}
                      onChange={handleReturnDataChange}
                      className="w-full p-2 border border-gray-300 rounded"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Serial Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="serialNumber"
                      value={returnData.serialNumber}
                      onChange={handleReturnDataChange}
                      className="w-full p-2 border border-gray-300 rounded"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Return Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="reason"
                    value={returnData.reason}
                    onChange={handleReturnDataChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    required
                  >
                    <option value="">Select a reason</option>
                    <option value="defective">Product Defective</option>
                    <option value="damaged">Product Damaged</option>
                    <option value="wrong_item">Wrong Item Received</option>
                    <option value="not_as_described">Item Not As Described</option>
                    <option value="changed_mind">Customer Changed Mind</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Condition
                  </label>
                  <select
                    name="condition"
                    value={returnData.condition}
                    onChange={handleReturnDataChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="good">Good (Resellable)</option>
                    <option value="damaged">Damaged</option>
                    <option value="defective">Defective</option>
                    <option value="open_box">Open Box</option>
                    <option value="unusable">Unusable</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      value={returnData.customerName}
                      onChange={handleReturnDataChange}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Contact
                    </label>
                    <input
                      type="text"
                      name="customerContact"
                      value={returnData.customerContact}
                      onChange={handleReturnDataChange}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    name="notes"
                    value={returnData.notes}
                    onChange={handleReturnDataChange}
                    rows="3"
                    className="w-full p-2 border border-gray-300 rounded"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded flex items-center justify-center ${
                    loading
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    <>
                      <span className="mr-2">↩️</span> Process Return
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:w-5/12">
            <div className="bg-white shadow rounded p-4">
              <h2 className="text-lg font-medium mb-4">Recent Sales</h2>
              {salesLoading ? (
                <div className="flex justify-center p-8">
                  <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : sales.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No sales records found to process returns from.
                </p>
              ) : (
                <div className="overflow-y-auto max-h-96">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Sale ID</th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Date</th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Items</th>
                        <th className="text-right py-2 px-4 text-xs font-medium text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.slice(0, 10).map((sale) => {
                        // Determine if this sale is selected
                        const isSelected = returnData.saleId === sale.saleId;
                        // Determine if this sale's details are expanded
                        const isExpanded = expandedSale === sale.saleId;
                        // Count items in the sale
                        const itemCount = sale.items ? sale.items.length : 0;
                        
                        return (
                          <React.Fragment key={sale.saleId}>
                            <tr className={`border-b ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                              <td className="py-2 px-4 text-sm">{sale.saleId}</td>
                              <td className="py-2 px-4 text-sm">
                                {new Date(sale.timestamp).toLocaleDateString()}
                              </td>
                              <td className="py-2 px-4 text-sm">
                                {itemCount}
                              </td>
                              <td className="py-2 px-4 text-right">
                                <button
                                  onClick={() => handleSaleSelection(sale.saleId)}
                                  className={`text-xs py-1 px-2 rounded ${
                                    isSelected
                                      ? "bg-blue-600 text-white hover:bg-blue-700"
                                      : "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
                                  }`}
                                >
                                  {isSelected ? 'Selected' : 'Select'}
                                </button>
                              </td>
                            </tr>
                            
                            {/* Show expanded item list when this sale is expanded */}
                            {isExpanded && itemCount > 0 && (
                              <tr>
                                <td colSpan="4" className="p-0">
                                  {renderSaleItems(sale)}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Returns History Tab */}
      {tabValue === 1 && (
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-medium mb-4">Returns History</h2>

          {historyLoading ? (
            <div className="flex justify-center p-8">
              <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : returnHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No returns history found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Return ID</th>
                    <th className="text-left py-2 px-4">Product ID</th>
                    <th className="text-left py-2 px-4">Serial #</th>
                    <th className="text-left py-2 px-4">Reason</th>
                    <th className="text-right py-2 px-4">Date</th>
                    <th className="text-right py-2 px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {returnHistory.map((ret) => (
                    <tr key={ret.returnId} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4">{ret.returnId}</td>
                      <td className="py-2 px-4">{ret.productId}</td>
                      <td className="py-2 px-4">{ret.serialNumber}</td>
                      <td className="py-2 px-4">{ret.reason}</td>
                      <td className="py-2 px-4 text-right">
                        {new Date(ret.timestamp).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <button
                          onClick={() => viewReturnDetails(ret.returnId)}
                          className="text-xs py-1 px-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Return Details Modal */}
      {detailsOpen && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="border-b px-6 py-3 flex justify-between items-center">
              <h3 className="text-lg font-medium">Return Details</h3>
              <button onClick={closeDetails} className="text-gray-400 hover:text-gray-500">
                ✕
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Return ID</p>
                    <p className="font-medium">{selectedReturn.returnId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Sale ID</p>
                    <p className="font-medium">{selectedReturn.saleId}</p>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Product ID</p>
                    <p className="font-medium">{selectedReturn.productId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Serial Number</p>
                    <p className="font-medium">{selectedReturn.serialNumber}</p>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-500">Return Reason</p>
                <p className="font-medium">{selectedReturn.reason}</p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-500">Return Date</p>
                <p className="font-medium">{new Date(selectedReturn.timestamp).toLocaleString()}</p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-500">Status</p>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  {selectedReturn.status || 'Processed'}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end">
              <button 
                onClick={closeDetails}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success notification */}
      {success && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded shadow-lg flex items-center">
          <span className="mr-2">✅</span>
          Return processed successfully!
          <button
            className="ml-4 text-green-600 hover:text-green-800"
            onClick={() => setSuccess(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error notification */}
      {error && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded shadow-lg flex items-center">
          <span className="mr-2">❌</span>
          {error}
          <button
            className="ml-4 text-red-600 hover:text-red-800"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default RetailerReturns;