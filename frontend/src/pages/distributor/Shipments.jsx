import React, { useState, useEffect } from "react";
import useApi from "../../hooks/useApi";

const Shipments = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();

  // State for data
  const [shipments, setShipments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [verifiedShipmentStatuses, setVerifiedShipmentStatuses] = useState({});
  const [statusRefreshing, setStatusRefreshing] = useState({});

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedRetailer, setSelectedRetailer] = useState("");
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [shipmentDetails, setShipmentDetails] = useState({
    carrier: "",
    trackingNumber: "",
    expectedDelivery: "",
    specialInstructions: "",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Load data when component mounts
  useEffect(() => {
    fetchData();
  }, [api]); // Add api as a dependency

  // Update available serial numbers when product selection changes
  useEffect(() => {
    if (selectedProduct) {
      const product = inventory.find((p) => p.productId === selectedProduct);
      if (product && product.serialNumbers) {
        setAvailableSerials(product.serialNumbers);
      } else {
        setAvailableSerials([]);
      }
    } else {
      setAvailableSerials([]);
    }
    // Reset selected serial numbers
    setSerialNumbers([]);
  }, [selectedProduct, inventory]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

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
      // Fetch all data in parallel for better performance
      const [inventoryData, retailersData, shipmentsData] = await Promise.all([
        api.get("/api/distributor/inventory"),
        api.get("/api/entities/retailer"),
        api.get("/api/distributor/shipments")
      ]);
      
      console.log("Inventory data:", inventoryData);
      if (inventoryData.success) {
        setInventory(inventoryData.inventory || []);
      }
      
      console.log("Retailers data:", retailersData);
      if (retailersData.success) {
        setRetailers(retailersData.entities || []);
      }
      
      console.log("Shipments data:", shipmentsData);
      if (shipmentsData?.success && Array.isArray(shipmentsData.shipments)) {
        await processShipmentData(shipmentsData.shipments);
      } else {
        // If API returns no shipments (but was successful)
        fallbackToLocalStorage();
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(`Failed to load data: ${err.message || "Unknown error"}`);
      fallbackToLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // Fall back to localStorage if API fails
  const fallbackToLocalStorage = () => {
    console.log("Falling back to localStorage for shipment data");
    const recentShipment = localStorage.getItem("recentShipment");
    if (recentShipment) {
      try {
        const shipment = JSON.parse(recentShipment);
        console.log("Using recent shipment from localStorage:", shipment);
        
        // Make sure the shipment has all required fields
        const processedShipment = {
          ...shipment,
          id: shipment.id || shipment.shipmentId || `shipment-${Date.now()}`,
          shipmentId: shipment.shipmentId || shipment.id || `shipment-${Date.now()}`,
          retailerName: getRetailerName(shipment.retailerId),
          productName: getProductName(shipment.productId),
          status: shipment.status || "shipped",
          timestamp: shipment.timestamp || shipment.createdAt || Date.now(),
          createdAt: shipment.createdAt || shipment.timestamp || Date.now(),
        };
        
        setShipments([processedShipment]);
      } catch (e) {
        console.error("Failed to parse localStorage shipment", e);
        setShipments([]);
      }
    } else {
      setShipments([]);
    }
  };

  // Helper functions to get entity names
  const getRetailerName = (retailerId) => {
    if (!retailerId) return "Unknown Retailer";
    const retailer = retailers.find(r => r.id === retailerId);
    return retailer?.name || retailerId;
  };

  const getProductName = (productId) => {
    if (!productId) return "Unknown Product";
    const product = inventory.find(p => p.productId === productId);
    return product?.productName || productId;
  };

  // Handle form input changes
  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setShipmentDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle serial number selection
  const handleSerialToggle = (serial) => {
    setSerialNumbers((prev) => {
      if (prev.includes(serial)) {
        return prev.filter((s) => s !== serial);
      } else {
        return [...prev, serial];
      }
    });
  };

  // Handle select all serial numbers
  const handleSelectAll = () => {
    if (serialNumbers.length === availableSerials.length) {
      setSerialNumbers([]);
    } else {
      setSerialNumbers([...availableSerials]);
    }
  };

  // Handle shipment creation
  const handleCreateShipment = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedRetailer || !selectedProduct || serialNumbers.length === 0) {
      setError(
        "Please select a retailer, product, and at least one serial number"
      );
      return;
    }

    try {
      setFormSubmitting(true);
      const response = await api.post("/api/distributor/shipment/create", {
        retailerId: selectedRetailer,
        productId: selectedProduct,
        serialNumbers: serialNumbers,
        shipmentDetails: shipmentDetails,
      });

      if (response.success) {
        // Show success message
        setSuccessMessage(`Shipment to ${getRetailerName(selectedRetailer)} created successfully!`);

        // Store the shipment data for fallback access
        const newShipment = {
          id: response.shipmentId || `shipment-${Date.now()}`,
          shipmentId: response.shipmentId || `shipment-${Date.now()}`,
          retailerId: selectedRetailer,
          retailerName: getRetailerName(selectedRetailer),
          productId: selectedProduct,
          productName: getProductName(selectedProduct),
          serialNumbers: serialNumbers,
          quantity: serialNumbers.length,
          status: "shipped",
          timestamp: Date.now(),
          createdAt: Date.now(),
        };
        localStorage.setItem("recentShipment", JSON.stringify(newShipment));

        // Reset form
        setSelectedProduct("");
        setSelectedRetailer("");
        setSerialNumbers([]);
        setShipmentDetails({
          carrier: "",
          trackingNumber: "",
          expectedDelivery: "",
          specialInstructions: "",
        });

        // Immediately show the new shipment in the UI without waiting for API refresh
        setShipments((prev) => [newShipment, ...prev]);

        // Refresh data from API
        fetchData();
      } else {
        setError(response.message || "Failed to create shipment");
      }
    } catch (err) {
      console.error("Error creating shipment:", err);
      setError(`Failed to create shipment: ${err.message || "Please try again."}`);
    } finally {
      setFormSubmitting(false);
    }
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

  // Function to refresh the status of a specific shipment
  const refreshShipmentStatus = async (shipmentId) => {
    if (!shipmentId) return;
    
    try {
      setStatusRefreshing(prev => ({ ...prev, [shipmentId]: true }));
      
      // Use the general transactions endpoint to get status updates
      const response = await api.get(`/api/transactions/${shipmentId}/status`);
      
      if (response.success) {
        setVerifiedShipmentStatuses(prev => ({
          ...prev,
          [shipmentId]: response.status || prev[shipmentId] || 'unknown'
        }));
        
        // If status has changed from what we have in state, refresh the full data
        // to make sure we have the most current information
        const currentShipment = shipments.find(s => s.shipmentId === shipmentId || s.id === shipmentId);
        if (currentShipment && response.status && currentShipment.status !== response.status) {
          fetchData();
        }
      }
    } catch (err) {
      console.error(`Failed to refresh status for shipment ${shipmentId}:`, err);
    } finally {
      setStatusRefreshing(prev => ({ ...prev, [shipmentId]: false }));
    }
  };
  
  // Process shipment data and check statuses
  const processShipmentData = async (shipmentsList) => {
    try {
      const formattedShipments = shipmentsList.map((shipment) => ({
        id: shipment.shipmentId || shipment.id || `shipment-${shipment.timestamp || Date.now()}`,
        shipmentId: shipment.shipmentId || shipment.id || `shipment-${shipment.timestamp || Date.now()}`,
        retailerId: shipment.retailerId,
        retailerName: getRetailerName(shipment.retailerId),
        productId: shipment.productId,
        productName: getProductName(shipment.productId),
        quantity: shipment.quantity || shipment.serialNumbers?.length || 0,
        status: shipment.status || "shipped",
        timestamp: shipment.timestamp || shipment.createdAt || Date.now(),
        createdAt: shipment.timestamp || shipment.createdAt || Date.now(),
        serialNumbers: shipment.serialNumbers || [],
      }));
  
      console.log(`Found ${formattedShipments.length} shipments`);
      setShipments(formattedShipments);
      
      // Initialize status checks for each shipment
      const statusChecks = {};
      for (const shipment of formattedShipments) {
        try {
          const shipmentId = shipment.shipmentId || shipment.id;
          // First assume it's the status we have in the record
          statusChecks[shipmentId] = shipment.status || 'shipped';
          
          // Then check with the transaction status API
          const statusResponse = await api.get(`/api/transactions/${shipmentId}/status`);
          if (statusResponse.success && statusResponse.status) {
            statusChecks[shipmentId] = statusResponse.status;
          }
        } catch (err) {
          console.error(`Error checking status for shipment:`, err);
        }
      }
      setVerifiedShipmentStatuses(statusChecks);
      setError(null);
    } catch (err) {
      console.error("Error processing shipment data:", err);
      setError("Error processing shipment data");
      fallbackToLocalStorage();
    }
  };
  
  // Render shipment status with appropriate styling
  const renderShipmentStatus = (status, shipmentId) => {
    // Use verified status if available, otherwise fall back to the provided status
    const currentStatus = verifiedShipmentStatuses[shipmentId] || status || "unknown";
    
    switch (currentStatus.toLowerCase()) {
      case "received":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            Received
          </span>
        );
      case "in-transit":
      case "in_transit":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
            In Transit
          </span>
        );
      case "shipped":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            Shipped
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
            {currentStatus || "Processing"}
          </span>
        );
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Distributor Shipments</h1>
        <div className="flex space-x-2">
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
            disabled={loading || apiLoading || formSubmitting}
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

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-3 mb-4 bg-green-50 border border-green-200 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      {showDebug && (
        <div className="p-3 mb-4 bg-gray-100 border border-gray-200 rounded">
          <h3 className="font-bold mb-2">Debug Information</h3>
          <p>Shipments: {shipments?.length || 0}</p>
          <p>Inventory Items: {inventory?.length || 0}</p>
          <p>Retailers: {retailers?.length || 0}</p>
          <p>Selected Serial Numbers: {serialNumbers?.length || 0}/{availableSerials?.length || 0}</p>
          
          <h4 className="font-semibold mt-2">Shipment Status Values:</h4>
          {Object.keys(verifiedShipmentStatuses).length > 0 ? (
            <ul className="mt-1 text-sm">
              {Object.entries(verifiedShipmentStatuses).map(([id, status]) => (
                <li key={id}>
                  {id.substring(0, 10)}...: <span className="font-medium">{status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No status information available</p>
          )}
          
          <details>
            <summary className="cursor-pointer font-semibold text-blue-600 mt-2">
              Raw Data
            </summary>
            <pre className="mt-2 p-2 bg-gray-800 text-green-400 text-xs overflow-auto max-h-60">
              {JSON.stringify(
                { 
                  shipments, 
                  inventory, 
                  retailers, 
                  serialNumbers,
                  verifiedShipmentStatuses
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}

      {/* Create Shipment Form */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Create New Shipment</h2>
        {retailers.length === 0 && !loading && (
          <div className="p-3 mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded">
            No retailers available. Please ensure retailers are registered in
            the system.
          </div>
        )}
        {inventory.length === 0 && !loading && (
          <div className="p-3 mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded">
            No inventory available. You need product inventory before creating
            shipments.
          </div>
        )}
        <form onSubmit={handleCreateShipment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retailer
            </label>
            <select
              value={selectedRetailer}
              onChange={(e) => setSelectedRetailer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={retailers.length === 0 || loading || formSubmitting}
            >
              <option value="">Select a retailer</option>
              {retailers.map((retailer) => (
                <option key={retailer.id} value={retailer.id}>
                  {retailer.name || retailer.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={inventory.length === 0 || loading || formSubmitting}
            >
              <option value="">Select a product</option>
              {inventory.map((product) => (
                <option key={product.productId} value={product.productId}>
                  {product.productName || product.productId} (
                  {product.serialNumbers?.length || 0} units)
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Serial Numbers ({serialNumbers.length} selected)
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800"
                  disabled={formSubmitting}
                >
                  {serialNumbers.length === availableSerials.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                {availableSerials.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableSerials.map((serial) => (
                      <div key={serial} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`serial-${serial}`}
                          checked={serialNumbers.includes(serial)}
                          onChange={() => handleSerialToggle(serial)}
                          className="mr-2"
                          disabled={formSubmitting}
                        />
                        <label 
                          htmlFor={`serial-${serial}`} 
                          className="text-sm truncate"
                          title={serial}
                        >
                          {serial}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2 text-gray-500">
                    No serial numbers available
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carrier
            </label>
            <input
              type="text"
              name="carrier"
              value={shipmentDetails.carrier}
              onChange={handleDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter carrier name"
              disabled={formSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tracking Number
            </label>
            <input
              type="text"
              name="trackingNumber"
              value={shipmentDetails.trackingNumber}
              onChange={handleDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter tracking number"
              disabled={formSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Delivery Date
            </label>
            <input
              type="date"
              name="expectedDelivery"
              value={shipmentDetails.expectedDelivery}
              onChange={handleDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={formSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions
            </label>
            <textarea
              name="specialInstructions"
              value={shipmentDetails.specialInstructions}
              onChange={handleDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              placeholder="Enter any special instructions"
              disabled={formSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              formSubmitting ||
              !selectedRetailer ||
              !selectedProduct ||
              serialNumbers.length === 0
            }
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {formSubmitting ? "Processing..." : "Create Shipment"}
          </button>
        </form>
      </div>

      {/* Shipment History Section */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Shipment History</h2>
        {(loading || apiLoading) && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading shipments...</p>
          </div>
        )}

        {!loading && !apiLoading && shipments && shipments.length > 0 ? (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shipment ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Retailer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shipping Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shipments.map((shipment) => {
                  const shipmentId = shipment.shipmentId || shipment.id;
                  return (
                    <tr
                      key={shipmentId}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {shipmentId || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {shipment.retailerName || shipment.retailerId || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {shipment.productName || shipment.productId || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {shipment.serialNumbers?.length || shipment.quantity || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(shipment.createdAt || shipment.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col items-start">
                          {renderShipmentStatus(shipment.status, shipmentId)}
                          <button
                            onClick={() => refreshShipmentStatus(shipmentId)}
                            disabled={statusRefreshing[shipmentId]}
                            className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                          >
                            {statusRefreshing[shipmentId] 
                              ? "Refreshing..." 
                              : "Refresh Status"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !loading && !apiLoading ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No shipments found</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Shipments;