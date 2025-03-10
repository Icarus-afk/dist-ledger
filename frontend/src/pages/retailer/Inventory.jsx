import React, { useState, useEffect } from "react";
import useApi from "../../hooks/useApi";

const RetailerInventory = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();

  // State for data
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [pendingShipments, setPendingShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [inventoryStats, setInventoryStats] = useState({
    totalProducts: 0,
    totalQuantity: 0,
    uniqueProducts: 0,
  });
  // Add state for shipment processing and verified statuses
  const [shipmentProcessing, setShipmentProcessing] = useState({});
  const [verifiedShipmentStatuses, setVerifiedShipmentStatuses] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);

  // Derived state for truly pending shipments
  const trulyPendingShipments = pendingShipments.filter((shipment) => {
    const status =
      verifiedShipmentStatuses[shipment.shipmentId]?.toLowerCase() || "unknown";
    return !["received", "processed", "rejected", "cancelled"].includes(status);
  });

  // Load data when component mounts
  useEffect(() => {
    fetchData();
  }, [api]); // Add api as dependency

  // Update filtered inventory when search term or inventory changes
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredInventory(inventory);
    } else {
      const filtered = inventory.filter((item) => {
        return (
          item.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.productName &&
            item.productName.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      });
      setFilteredInventory(filtered);
    }
  }, [searchTerm, inventory]);

  // Clear success message after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Main data fetching function
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch pending shipments first
      // In fetchData function in RetailerInventory.jsx
      const pendingData = await api.get("/api/retailer/pending-shipments");
      console.log("Pending shipments data:", pendingData);

      if (pendingData.success && pendingData.shipments) {
        const normalizedShipments = (pendingData.shipments || []).map(
          (shipment) => ({
            ...shipment,
            shipmentId: shipment.shipmentId || shipment.id,
            createdAt: shipment.createdAt || shipment.timestamp || Date.now(),
            quantity: shipment.serialNumbers?.length || shipment.quantity || 0,
          })
        );
        setPendingShipments(normalizedShipments);

        // Initialize status checks for each shipment
        const statusChecks = {};
        for (const shipment of normalizedShipments) {
          try {
            // First assume it's shipped unless proven otherwise
            statusChecks[shipment.shipmentId] = shipment.status || "shipped";

            // Then check with the transaction status API
            const statusResponse = await api.get(
              `/api/transactions/${shipment.shipmentId}/status`
            );
            if (statusResponse.success) {
              // Only update if we got a valid status
              if (statusResponse.status) {
                statusChecks[shipment.shipmentId] = statusResponse.status;
              }
            }
          } catch (err) {
            console.error(
              `Error checking status for shipment ${shipment.shipmentId}:`,
              err
            );
            // Keep the default status (which is 'shipped')
          }
        }
        setVerifiedShipmentStatuses(statusChecks);
      }

      // Then try to fetch inventory
      try {
        const inventoryData = await api.get("/api/retailer/inventory");
        console.log("Inventory data:", inventoryData);

        if (inventoryData.success && inventoryData.inventory) {
          setInventory(inventoryData.inventory);
          setFilteredInventory(inventoryData.inventory);

          // Calculate inventory statistics
          const stats = {
            totalProducts: inventoryData.inventory.length,
            totalQuantity: inventoryData.inventory.reduce(
              (sum, item) => sum + (item.quantity || 0),
              0
            ),
            uniqueProducts: new Set(
              inventoryData.inventory.map((item) => item.productId)
            ).size,
          };
          setInventoryStats(stats);
        }
      } catch (inventoryError) {
        console.log("Inventory not available yet:", inventoryError);
        // This is expected if no shipments have been received yet
        // Don't set an error for this, just show empty state
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(`Failed to load data: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Function to refresh the status of a specific shipment
  const refreshShipmentStatus = async (shipmentId) => {
    if (!shipmentId) return;

    try {
      // Use the general transactions endpoint to get status updates
      const response = await api.get(`/api/transactions/${shipmentId}/status`);

      if (response.success) {
        setVerifiedShipmentStatuses((prev) => ({
          ...prev,
          [shipmentId]: response.status || prev[shipmentId] || "unknown",
        }));

        // If status has changed to something other than 'shipped', refresh the list
        if (response.status && response.status !== "shipped") {
          fetchData();
        }
      }
    } catch (err) {
      console.error(
        `Failed to refresh status for shipment ${shipmentId}:`,
        err
      );
    }
  };

  // Handle accepting a shipment
  const handleAcceptShipment = async (shipment) => {
    try {
      // Mark this shipment as processing
      setShipmentProcessing((prev) => ({
        ...prev,
        [shipment.shipmentId]: true,
      }));
      setError(null);

      // Prepare shipment acceptance data
      const acceptanceData = {
        shipmentId: shipment.shipmentId,
        distributorId: shipment.distributorId,
        productId: shipment.productId,
        serialNumbers: shipment.serialNumbers,
      };

      console.log("Accepting shipment:", acceptanceData);

      const response = await api.post(
        "/api/retailer/receive-from-distributor",
        acceptanceData
      );

      if (response.success) {
        setSuccessMessage("Shipment received successfully!");

        // Refresh data
        fetchData();
      } else {
        setError(response.message || "Failed to accept shipment");
      }
    } catch (err) {
      console.error("Error accepting shipment:", err);
      setError(`Failed to accept shipment: ${err.message || "Unknown error"}`);
    } finally {
      setShipmentProcessing((prev) => ({
        ...prev,
        [shipment.shipmentId]: false,
      }));
    }
  };

  // Render shipment status with appropriate styling
  const renderShipmentStatus = (status, shipmentId) => {
    const currentStatus =
      verifiedShipmentStatuses[shipmentId] || status || "unknown";

    switch (currentStatus.toLowerCase()) {
      case "received":
        return (
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">
            Received
          </span>
        );
      case "shipped":
        return (
          <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
            Shipped
          </span>
        );
      case "in-transit":
      case "in_transit":
        return (
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800">
            In Transit
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800">
            {currentStatus}
          </span>
        );
    }
  };

  // Format date with better handling
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";

    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (err) {
      console.error("Error formatting date:", err);
      return "Invalid date";
    }
  };

  // View serial numbers
  const handleViewSerialNumbers = (item) => {
    if (!item.serialNumbers || item.serialNumbers.length === 0) {
      alert("No serial numbers available");
      return;
    }

    alert(`Serial Numbers:\n${item.serialNumbers.join("\n")}`);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <span className="mr-2 text-blue-600 text-2xl">📦</span>
          <h1 className="text-2xl font-bold">Retailer Inventory</h1>
        </div>
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
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            {showDebug ? "Hide Debug Info" : "Show Debug Info"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-6">
          {successMessage}
        </div>
      )}

      {showDebug && (
        <div className="p-3 mb-4 bg-gray-100 border border-gray-200 rounded">
          <h3 className="font-bold mb-2">Debug Information</h3>
          <p>All Shipments: {pendingShipments.length}</p>
          <p>Actually Pending: {trulyPendingShipments.length}</p>
          <p>Inventory Items: {inventory.length}</p>
          <p>API Loading: {apiLoading ? "Yes" : "No"}</p>
          <p>API Error: {apiError || "None"}</p>
          <details>
            <summary className="cursor-pointer font-semibold text-blue-600 mt-2">
              Raw Data
            </summary>
            <pre className="mt-2 p-2 bg-gray-800 text-green-400 text-xs overflow-auto max-h-60">
              {JSON.stringify(
                {
                  inventory,
                  pendingShipments,
                  trulyPendingShipments,
                  verifiedShipmentStatuses,
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm mb-1">Total Products</p>
          <p className="text-2xl font-semibold">
            {inventoryStats.totalProducts}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm mb-1">Total Units</p>
          <p className="text-2xl font-semibold">
            {inventoryStats.totalQuantity}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm mb-1">Unique Products</p>
          <p className="text-2xl font-semibold">
            {inventoryStats.uniqueProducts}
          </p>
        </div>
      </div>

      {/* Pending Shipments Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Pending Shipments</h2>
        {loading || apiLoading ? (
          <div className="text-center py-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : trulyPendingShipments.length > 0 ? (
          <div className="overflow-x-auto bg-white rounded shadow">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shipment ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distributor
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
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {trulyPendingShipments.map((shipment) => (
                  <tr key={shipment.shipmentId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {shipment.shipmentId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {shipment.distributorName || shipment.distributorId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {shipment.productName || shipment.productId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {shipment.quantity || shipment.serialNumbers?.length || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatDate(shipment.createdAt || shipment.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col items-start">
                        {renderShipmentStatus(
                          shipment.status,
                          shipment.shipmentId
                        )}
                        <button
                          onClick={() =>
                            refreshShipmentStatus(shipment.shipmentId)
                          }
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          Refresh Status
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleAcceptShipment(shipment)}
                        disabled={
                          shipmentProcessing[shipment.shipmentId] || loading
                        }
                        className="text-green-600 bg-green-100 hover:bg-green-200 px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {shipmentProcessing[shipment.shipmentId]
                          ? "Processing..."
                          : "Accept"}
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
                    Serial Numbers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={item.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.productId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.productName || "Unknown Product"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${
                            item.quantity > 10
                              ? "bg-green-100 text-green-800"
                              : item.quantity > 5
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                      >
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.serialNumbers?.slice(0, 2).join(", ")}
                      {item.serialNumbers?.length > 2 && "..."}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewSerialNumbers(item)}
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
            {searchTerm
              ? "No matching products found"
              : "No products in inventory yet. Accept shipments to add products."}
          </div>
        )}
      </div>
    </div>
  );
};

export default RetailerInventory;
