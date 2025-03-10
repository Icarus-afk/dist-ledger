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

  // Load data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use the api object consistently like in the Inventory page
        // Fetch inventory
        const inventoryData = await api.get("/api/distributor/inventory");
        console.log("Inventory data:", inventoryData);
        if (inventoryData.success) {
          setInventory(inventoryData.inventory || []);
        }

        // Fetch retailers
        const retailersData = await api.get("/api/entities/retailer");
        console.log("Retailers data:", retailersData);
        if (retailersData.success) {
          setRetailers(retailersData.entities || []);
        }

        // Use our new fetch function for shipments
        await fetchShipmentsHistory();
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(`Failed to load data: ${err.message || "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    };

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

  // Handle shipment creation
  const handleCreateShipment = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedRetailer || !selectedProduct || serialNumbers.length === 0) {
      setError(
        "Please select a retailer, product, and at least one serial number"
      );
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/api/distributor/shipment/create", {
        retailerId: selectedRetailer,
        productId: selectedProduct,
        serialNumbers: serialNumbers,
        shipmentDetails: shipmentDetails,
      });

      if (response.success) {
        // Show success message
        alert("Shipment created successfully!");

        // Store the shipment data for fallback access
        const newShipment = {
          id: response.shipmentId || `shipment-${Date.now()}`,
          shipmentId: response.shipmentId || `shipment-${Date.now()}`,
          retailerId: selectedRetailer,
          retailerName: retailers.find((r) => r.id === selectedRetailer)?.name,
          productId: selectedProduct,
          productName: inventory.find((p) => p.productId === selectedProduct)
            ?.productName,
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

        // Also refresh inventory
        try {
          const refreshedInventory = await api.get(
            "/api/distributor/inventory"
          );
          if (refreshedInventory.success) {
            setInventory(refreshedInventory.inventory || []);
          }
        } catch (refreshError) {
          console.error("Error refreshing inventory:", refreshError);
        }
      } else {
        setError(response.message || "Failed to create shipment");
      }
    } catch (err) {
      console.error("Error creating shipment:", err);
      setError("Failed to create shipment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch shipments history
  const fetchShipmentsHistory = async () => {
    setLoading(true);

    try {
      // Use the correct endpoint for shipments
      const shipmentsData = await api.get("/api/distributor/shipments");
      console.log("Shipments data:", shipmentsData);

      // FIXED: Check for shipments key, not transactions
      if (shipmentsData?.success && shipmentsData?.shipments) {
        const formattedShipments = shipmentsData.shipments.map((shipment) => ({
          id: shipment.shipmentId || shipment.id,
          shipmentId: shipment.shipmentId || shipment.id,
          retailerId: shipment.retailerId,
          retailerName: retailers.find(r => r.id === shipment.retailerId)?.name || shipment.retailerId,
          productId: shipment.productId,
          productName: inventory.find(p => p.productId === shipment.productId)?.productName || shipment.productId,
          quantity: shipment.quantity || 0,
          status: shipment.status || "shipped",
          timestamp: shipment.timestamp,
          createdAt: shipment.timestamp,
        }));

        console.log(`Found ${formattedShipments.length} shipments`);
        setShipments(formattedShipments);
        setError(null);
        return;
      }

      // If no shipments in API response, check localStorage
      const recentShipment = localStorage.getItem("recentShipment");
      if (recentShipment) {
        const shipment = JSON.parse(recentShipment);
        console.log("Using recent shipment from localStorage:", shipment);
        setShipments([shipment]);
        setError(null);
        return;
      }

      // If still no shipments found, set empty array
      console.log("No shipments found through any source");
      setShipments([]);
      setError(null);
    } catch (err) {
      console.error("Error fetching shipment history:", err);
      // Show a more user-friendly error
      setError(
        "Unable to retrieve shipment history. The system is still processing recent shipments."
      );
      
      // Try to use localStorage as fallback
      const recentShipment = localStorage.getItem("recentShipment");
      if (recentShipment) {
        try {
          const shipment = JSON.parse(recentShipment);
          setShipments([shipment]);
        } catch (e) {
          console.error("Failed to parse localStorage shipment", e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const renderShipmentStatus = (status) => {
    switch (status) {
      case "delivered":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            Delivered
          </span>
        );
      case "in-transit":
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
            In Transit
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            {status || "Processing"}
          </span>
        );
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Distributor Shipments</h1>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="px-3 py-1 bg-gray-500 text-white rounded"
        >
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
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
          <p>Shipments: {shipments?.length || 0}</p>
          <p>Inventory Items: {inventory?.length || 0}</p>
          <p>Retailers: {retailers?.length || 0}</p>
          <p>Selected Serial Numbers: {serialNumbers?.length || 0}</p>
          <div className="mt-2 flex space-x-2">
            <button 
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded"
              onClick={fetchShipmentsHistory}
            >
              Refresh Shipments
            </button>
          </div>
          <details>
            <summary className="cursor-pointer font-semibold text-blue-600">
              Raw Data
            </summary>
            <pre className="mt-2 p-2 bg-gray-800 text-green-400 text-xs overflow-auto max-h-60">
              {JSON.stringify(
                { shipments, inventory, retailers, serialNumbers },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}

      {/* Create Shipment Form */}
      <div className="mb-8 bg-gray-50 p-4 rounded border border-gray-200">
        <h2 className="text-xl font-semibold mb-3">Create New Shipment</h2>
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
        <form onSubmit={handleCreateShipment}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retailer
            </label>
            <select
              value={selectedRetailer}
              onChange={(e) => setSelectedRetailer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              disabled={retailers.length === 0 || loading}
            >
              <option value="">Select a retailer</option>
              {retailers.map((retailer) => (
                <option key={retailer.id} value={retailer.id}>
                  {retailer.name || retailer.id}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              disabled={inventory.length === 0 || loading}
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serial Numbers ({serialNumbers.length} selected)
              </label>
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
                        />
                        <label htmlFor={`serial-${serial}`} className="text-sm">
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

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carrier
            </label>
            <input
              type="text"
              name="carrier"
              value={shipmentDetails.carrier}
              onChange={handleDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter carrier name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tracking Number
            </label>
            <input
              type="text"
              name="trackingNumber"
              value={shipmentDetails.trackingNumber}
              onChange={handleDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter tracking number"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Delivery Date
            </label>
            <input
              type="date"
              name="expectedDelivery"
              value={shipmentDetails.expectedDelivery}
              onChange={handleDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions
            </label>
            <textarea
              name="specialInstructions"
              value={shipmentDetails.specialInstructions}
              onChange={handleDetailsChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
              placeholder="Enter any special instructions"
            />
          </div>

          <button
            type="submit"
            className={`px-4 py-2 rounded text-white ${
              loading ||
              !selectedRetailer ||
              !selectedProduct ||
              serialNumbers.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={
              loading ||
              !selectedRetailer ||
              !selectedProduct ||
              serialNumbers.length === 0
            }
          >
            {loading ? "Processing..." : "Create Shipment"}
          </button>
        </form>
      </div>

      {/* Shipment History Section */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Shipment History</h2>
        {(loading || apiLoading) && (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {!loading && !apiLoading && shipments && shipments.length > 0 ? (
          <div className="overflow-x-auto">
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
                {shipments.map((shipment) => (
                  <tr
                    key={shipment.shipmentId || shipment.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shipment.shipmentId || shipment.id || "N/A"}
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
                      {shipment.createdAt
                        ? new Date(shipment.createdAt).toLocaleDateString()
                        : shipment.timestamp
                        ? new Date(shipment.timestamp).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderShipmentStatus(shipment.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading && !apiLoading ? (
          <div className="text-center py-10 bg-white border rounded text-gray-500">
            No shipments found
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Shipments;