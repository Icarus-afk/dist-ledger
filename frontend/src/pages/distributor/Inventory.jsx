import React, { useState, useEffect } from "react";
import useApi from "../../hooks/useApi";

const Inventory = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();

  // State for data
  const [inventory, setInventory] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [selectedManufacturer, setSelectedManufacturer] = useState("");
  const [productId, setProductId] = useState("");
  const [serialNumbersInput, setSerialNumbersInput] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  // UI states
  const [successMessage, setSuccessMessage] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [transferProcessing, setTransferProcessing] = useState({});
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState(null);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [verifiedTransferStatuses, setVerifiedTransferStatuses] = useState({});

  // Fetch data function that can be called to refresh
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all data in parallel for better performance
      const [inventoryData, pendingData, manufacturersData] = await Promise.all([
        api.get('/api/distributor/inventory'),
        api.get('/api/distributor/pending-transfers'),
        api.get('/api/entities/manufacturer')
      ]);
      
      console.log('Inventory data:', inventoryData);
      if (inventoryData.success) {
        setInventory(inventoryData.inventory || []);
      }
      
      console.log('Pending transfers data:', pendingData);
      if (pendingData.success) {
        // The API now only returns truly pending transfers with current statuses
        const normalizedTransfers = (pendingData.transfers || []).map(transfer => ({
          ...transfer,
          id: transfer.id || transfer.transferId,
          createdAt: transfer.createdAt || transfer.timestamp || Date.now(),
          quantity: transfer.serialNumbers?.length || transfer.quantity || 0,
          status: transfer.currentStatus || 'pending' // Already filtered by API
        }));
        
        setPendingTransfers(normalizedTransfers);
        
        // Set initial status for each transfer
        const statusChecks = {};
        normalizedTransfers.forEach(transfer => {
          statusChecks[transfer.id] = transfer.currentStatus || 'pending';
        });
        
        setVerifiedTransferStatuses(statusChecks);
      }
      
      console.log('Manufacturers data:', manufacturersData);
      if (manufacturersData.success) {
        setManufacturers(manufacturersData.entities || []);
      }
    } catch (err) {
      console.error('Error fetching inventory data:', err);
      setError('Failed to load inventory data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

// Add a function to refresh the status of a specific transfer
const refreshTransferStatus = async (transferId) => {
  if (!transferId) return;
  
  try {
    // Use the general transactions endpoint to get status updates
    const response = await api.get(`/api/transactions/${transferId}/status`);
    
    if (response.success) {
      setVerifiedTransferStatuses(prev => ({
        ...prev,
        [transferId]: response.status || prev[transferId] || 'unknown'
      }));
    }
  } catch (err) {
    console.error(`Failed to refresh status for transfer ${transferId}:`, err);
  }
};

  const trulyPendingTransfers = pendingTransfers.filter(
    (transfer) =>
      verifiedTransferStatuses[transfer.id] === "pending" ||
      verifiedTransferStatuses[transfer.id] === "unknown"
  );

  // Load data when component mounts
  useEffect(() => {
    fetchData();
  }, [api]);

  // Update error state when apiError changes
  useEffect(() => {
    if (apiError) {
      setError(apiError);
    }
  }, [apiError]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle receiving products from manufacturer
  const handleReceiveProducts = async (e) => {
    e.preventDefault();
    setError(null);
    setFormSubmitting(true);

    if (!selectedManufacturer || !productId || !serialNumbersInput) {
      setError("Please fill in all fields");
      setFormSubmitting(false);
      return;
    }

    const serialNumbers = serialNumbersInput
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s !== "");

    if (serialNumbers.length === 0) {
      setError("Please enter at least one serial number");
      setFormSubmitting(false);
      return;
    }

    // Check for duplicates
    const uniqueSerials = new Set(serialNumbers);
    if (uniqueSerials.size !== serialNumbers.length) {
      setError("Duplicate serial numbers detected. Please check your input.");
      setFormSubmitting(false);
      return;
    }

    try {
      const response = await api.post(
        "/api/distributor/receive-from-manufacturer",
        {
          manufacturerId: selectedManufacturer,
          productId,
          serialNumbers,
        }
      );

      if (response.success) {
        setSuccessMessage(
          `Successfully received ${serialNumbers.length} product${
            serialNumbers.length > 1 ? "s" : ""
          }`
        );

        // Reset form
        setSelectedManufacturer("");
        setProductId("");
        setSerialNumbersInput("");

        // Refresh data
        fetchData();
      } else {
        setError(response.message || "Failed to receive products");
      }
    } catch (err) {
      console.error("Error receiving products:", err);
      setError(`Error: ${err.message || "Failed to receive products"}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle accepting transfer
  const handleAcceptTransfer = async (transfer) => {
    if (!transfer || !transfer.id) {
      setError("Invalid transfer data");
      return;
    }

    // Confirm before proceeding
    if (
      !window.confirm(
        `Accept transfer of ${transfer.quantity} product(s) from ${
          transfer.manufacturerName || "manufacturer"
        }?`
      )
    ) {
      return;
    }

    setTransferProcessing((prev) => ({ ...prev, [transfer.id]: true }));
    setError(null);

    try {
      const response = await api.post(
        "/api/distributor/receive-from-manufacturer",
        {
          manufacturerId: transfer.manufacturerId,
          productId: transfer.productId,
          serialNumbers: transfer.serialNumbers || [],
          transferId: transfer.id, // Include the transfer ID for tracking
        }
      );

      if (response.success) {
        setSuccessMessage("Transfer accepted successfully!");
        fetchData(); // Refresh data
      } else {
        setError(response.message || "Failed to accept transfer");
      }
    } catch (err) {
      console.error("Error accepting transfer:", err);
      setError(`Error: ${err.message || "Failed to accept transfer"}`);
    } finally {
      setTransferProcessing((prev) => ({ ...prev, [transfer.id]: false }));
    }
  };

  // View serial numbers
  const handleViewSerialNumbers = (item) => {
    setSelectedSerialNumbers(item.serialNumbers || []);
    setSelectedProductName(item.productName || "Product");
  };

  // Close serial numbers modal
  const closeSerialNumbersModal = () => {
    setSelectedSerialNumbers(null);
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

  // Truncate long IDs
  const truncateId = (id, length = 8) => {
    if (!id) return "N/A";
    if (id.length <= length) return id;
    return `${id.substring(0, length)}...`;
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Distributor Inventory</h1>
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
          <p>All Transfers: {pendingTransfers.length}</p>
          <p>Actually Pending: {trulyPendingTransfers.length}</p>
          <p>Inventory Items: {inventory.length}</p>
          <p>Manufacturers: {manufacturers.length}</p>
          <details>
            <summary className="cursor-pointer font-semibold text-blue-600">
              Raw Data
            </summary>
            <pre className="mt-2 p-2 bg-gray-800 text-green-400 text-xs overflow-auto">
              {JSON.stringify(
                {
                  inventory,
                  pendingTransfers,
                  trulyPendingTransfers,
                  verifiedTransferStatuses,
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}

      {/* Pending Transfers Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Pending Transfers</h2>
        {loading || apiLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading transfers...</p>
          </div>
        ) : trulyPendingTransfers.length > 0 ? (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
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
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trulyPendingTransfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span title={transfer.id}>{truncateId(transfer.id)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transfer.manufacturerName || (
                        <span title={transfer.manufacturerId}>
                          {truncateId(transfer.manufacturerId)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transfer.productDetails?.name || (
                        <span title={transfer.productId}>
                          {truncateId(transfer.productId)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transfer.quantity}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      title={formatDate(transfer.createdAt)}
                    >
                      {formatDate(transfer.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full ${
                          verifiedTransferStatuses[transfer.id] === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {verifiedTransferStatuses[transfer.id] || "unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleAcceptTransfer(transfer)}
                        disabled={transferProcessing[transfer.id]}
                        className="text-green-600 hover:text-green-900 bg-green-100 px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {transferProcessing[transfer.id]
                          ? "Processing..."
                          : "Accept"}
                      </button>
                    </td>
                    {/* Status refresh button in the status cell */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col items-start">
                        <span
                          className={`px-2 py-1 mb-1 rounded-full ${
                            verifiedTransferStatuses[transfer.id] === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {verifiedTransferStatuses[transfer.id] || "unknown"}
                        </span>
                        <button
                          onClick={() => refreshTransferStatus(transfer.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Refresh Status
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No pending transfers</p>
          </div>
        )}
      </div>

      {/* Receive Products Form */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">
          Receive Products Manually
        </h2>
        <form onSubmit={handleReceiveProducts} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manufacturer
            </label>
            <select
              value={selectedManufacturer}
              onChange={(e) => setSelectedManufacturer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={formSubmitting}
            >
              <option value="">Select a manufacturer</option>
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.id}>
                  {manufacturer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product ID
            </label>
            <input
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter full product ID"
              required
              disabled={formSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serial Numbers (one per line)
            </label>
            <textarea
              value={serialNumbersInput}
              onChange={(e) => setSerialNumbersInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              rows="5"
              placeholder="Enter serial numbers, one per line"
              required
              disabled={formSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              {
                serialNumbersInput.split("\n").filter((s) => s.trim() !== "")
                  .length
              }{" "}
              serial numbers entered
            </p>
          </div>

          <button
            type="submit"
            disabled={formSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {formSubmitting ? "Processing..." : "Receive Products"}
          </button>
        </form>
      </div>

      {/* Current Inventory Section */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Current Inventory</h2>
        {loading || apiLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading inventory...</p>
          </div>
        ) : inventory.length > 0 ? (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
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
                  <tr key={item.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span title={item.productId}>
                        {truncateId(item.productId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.productName || "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.serialNumbers?.length || item.quantity || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewSerialNumbers(item)}
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
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No inventory items found</p>
          </div>
        )}
      </div>

      {/* Serial Numbers Modal */}
      {selectedSerialNumbers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-screen overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">
                Serial Numbers for {selectedProductName}
              </h3>
              <button
                onClick={closeSerialNumbersModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {selectedSerialNumbers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedSerialNumbers.map((serialNumber, index) => (
                    <div
                      key={index}
                      className="p-2 border rounded text-sm bg-gray-50"
                    >
                      {serialNumber}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No serial numbers found
                </p>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {selectedSerialNumbers.length} serial number
                  {selectedSerialNumbers.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={closeSerialNumbersModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
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

export default Inventory;
