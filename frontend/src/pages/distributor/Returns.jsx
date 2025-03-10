import React, { useState, useEffect } from "react";
import useApi from "../../hooks/useApi";

const Returns = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();
  
  // State for data
  const [returnedProducts, setReturnedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showReturnDetails, setShowReturnDetails] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    timeframe: "all"
  });
  

  // Load data when component mounts
  useEffect(() => {
    fetchData();
  }, [api]); // Add api as a dependency

  // Show API errors
  useEffect(() => {
    if (apiError) {
      setError(apiError);
    }
  }, [apiError]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
  
    try {
      // Fetch returns data from the API
      const returnsResponse = await api.get("/api/distributor/returned-products");
      
      console.log("Returned products data:", returnsResponse);
      if (returnsResponse?.success && Array.isArray(returnsResponse.returnedProducts)) {
        processReturnedProducts(returnsResponse.returnedProducts);
      } else {
        // If API returns no data (but was successful)
        setReturnedProducts([]);
      }
    } catch (err) {
      console.error("Error fetching returned products data:", err);
      setError(`Failed to load returned products: ${err.message || "Unknown error"}`);
      setReturnedProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Process returned products data
  const processReturnedProducts = (productsData) => {
    try {
      const formattedProducts = productsData.map((item) => ({
        ...item,
        returnId: item.returnId || `return-${item.timestamp || Date.now()}`,
        status: item.status || "processing", 
        timestamp: item.timestamp || Date.now(),
        serialNumbers: item.serialNumbers || [],
        value: item.value || 0,
        defectDescription: item.defectDescription || null,
        replacement: item.replacement || false
      }));
  
      console.log(`Found ${formattedProducts.length} returned products`);
      setReturnedProducts(formattedProducts);
      setError(null);
    } catch (err) {
      console.error("Error processing returned products data:", err);
      setError("Error processing returned products data");
    }
  };
  
  // Handle viewing return details
  const handleViewDetails = (returnItem) => {
    setSelectedReturn(returnItem);
    setShowReturnDetails(true);
  };
  
  // Format date with better error handling
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      return new Date(timestamp).toLocaleDateString();
    } catch (err) {
      console.error("Error formatting date:", err);
      return "Invalid Date";
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(value || 0);
  };

  // Render return status with appropriate styling
  const renderReturnStatus = (status) => {
    switch ((status || "").toLowerCase()) {
      case "processed":
      case "completed":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            Processed
          </span>
        );
      case "processing":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
            Processing
          </span>
        );
      case "inspection":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
            Inspection
          </span>
        );
      case "awaiting replacement":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            Awaiting Replacement
          </span>
        );
      case "refunded":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
            Refunded
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
            {status || "Unknown"}
          </span>
        );
    }
  };

  // Apply filters to the returned products list
  const getFilteredProducts = () => {
    return returnedProducts.filter(item => {
      // Status filter
      if (filters.status !== "all" && item.status !== filters.status) {
        return false;
      }
      
      // Timeframe filter
      if (filters.timeframe !== "all") {
        const now = new Date();
        const itemDate = new Date(item.timestamp);
        const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
        
        if (filters.timeframe === "week" && daysDiff > 7) {
          return false;
        } else if (filters.timeframe === "month" && daysDiff > 30) {
          return false;
        } else if (filters.timeframe === "quarter" && daysDiff > 90) {
          return false;
        }
      }
      
      return true;
    });
  };
  
  const filteredProducts = getFilteredProducts();
  
  // Calculate totals for statistics
  const totalValue = filteredProducts.reduce((sum, item) => sum + (item.value || 0), 0);
  const totalCount = filteredProducts.length;
  const defectiveCount = filteredProducts.filter(item => item.defective === true).length;
  const replacementCount = filteredProducts.filter(item => item.replacement === true).length;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Returned Products</h1>
        <div className="flex space-x-2">
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
            disabled={loading || apiLoading}
          >
            {loading || apiLoading ? "Refreshing..." : "🔄 Refresh"}
          </button>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-3 py-1 bg-gray-500 text-white rounded"
          >
            {showDebug ? "Hide Debug Info" : "Show Debug Info"}
          </button>
        </div>
      </div>

      {/* Return Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total Returns</p>
          <p className="text-xl font-bold">{totalCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Defective Products</p>
          <p className="text-xl font-bold">{defectiveCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Replacements Sent</p>
          <p className="text-xl font-bold">{replacementCount}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {showDebug && (
        <div className="p-3 mb-4 bg-gray-100 border border-gray-200 rounded">
          <h3 className="font-bold mb-2">Debug Information</h3>
          <p>Returned Products: {returnedProducts?.length || 0}</p>
          <p>Filtered Products: {filteredProducts?.length || 0}</p>
          
          <details>
            <summary className="cursor-pointer font-semibold text-blue-600 mt-2">
              Raw Data
            </summary>
            <pre className="mt-2 p-2 bg-gray-800 text-green-400 text-xs overflow-auto max-h-60">
              {JSON.stringify(
                { 
                  returnedProducts,
                  filters 
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="all">All Statuses</option>
              <option value="processing">Processing</option>
              <option value="inspection">Inspection</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
              <option value="awaiting replacement">Awaiting Replacement</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
              value={filters.timeframe}
              onChange={(e) => setFilters({...filters, timeframe: e.target.value})}
            >
              <option value="all">All Time</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Returned Products List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Returned Products</h2>
        {(loading || apiLoading) && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading returned products...</p>
          </div>
        )}

        {!loading && !apiLoading && filteredProducts && filteredProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Return ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Retailer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((returnItem) => (
                  <tr
                    key={returnItem.returnId}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {returnItem.returnId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(returnItem.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {returnItem.retailerName || returnItem.retailerId || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {returnItem.productName || returnItem.productId || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(returnItem.value)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {returnItem.reason 
                        ? (returnItem.reason.length > 20 
                            ? returnItem.reason.substring(0, 20) + '...' 
                            : returnItem.reason)
                        : "Not specified"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderReturnStatus(returnItem.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleViewDetails(returnItem)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading && !apiLoading ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No returned products found</p>
          </div>
        ) : null}
      </div>

      {/* Return Details Modal */}
      {showReturnDetails && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Returned Product Details</h2>
                <button 
                  onClick={() => setShowReturnDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Return ID</p>
                  <p className="font-medium">{selectedReturn.returnId}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Date Returned</p>
                  <p className="font-medium">{formatDate(selectedReturn.timestamp)}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="mt-1">
                    {renderReturnStatus(selectedReturn.status)}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Value</p>
                  <p className="font-medium">{formatCurrency(selectedReturn.value)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Retailer</p>
                  <p className="font-medium">{selectedReturn.retailerName || selectedReturn.retailerId || "N/A"}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Need Replacement</p>
                  <p className="font-medium">{selectedReturn.replacement ? "Yes" : "No"}</p>
                </div>
                
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Product</p>
                  <p className="font-medium">{selectedReturn.productName || selectedReturn.productId}</p>
                  <p className="text-xs text-gray-500">Product ID: {selectedReturn.productId}</p>
                </div>
                
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Serial Numbers</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedReturn.serialNumbers && selectedReturn.serialNumbers.length > 0 ? (
                      selectedReturn.serialNumbers.map((serial, index) => (
                        <span 
                          key={index} 
                          className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded"
                        >
                          {serial}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No serial numbers provided</p>
                    )}
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Return Reason</p>
                  <p className="font-medium">{selectedReturn.reason || "Not specified"}</p>
                </div>
                
                {selectedReturn.defectDescription && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500">Defect Description</p>
                    <p className="font-medium">{selectedReturn.defectDescription}</p>
                  </div>
                )}
                
                {selectedReturn.inspectionResult && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500">Inspection Result</p>
                    <p className="font-medium">{selectedReturn.inspectionResult}</p>
                  </div>
                )}

                {selectedReturn.merkleVerified !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500">Merkle Verification</p>
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                      selectedReturn.merkleVerified
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {selectedReturn.merkleVerified ? "Verified" : "Not Verified"}
                    </span>
                  </div>
                )}
              </div>

              {selectedReturn.actionHistory && selectedReturn.actionHistory.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Action History</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedReturn.actionHistory.map((action, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {formatDate(action.timestamp)}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">
                              {action.action}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {action.user}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {action.note || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setShowReturnDetails(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;