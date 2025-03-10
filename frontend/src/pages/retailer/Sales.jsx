import React, { useState, useEffect } from "react";
import useApi from "../../hooks/useApi"; // Changed to use the API hook for consistency

const RetailerSales = () => {
  const [tabValue, setTabValue] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [salesHistory, setSalesHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSelectingSerials, setIsSelectingSerials] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [selectedSerials, setSelectedSerials] = useState([]);

  // New sale form state
  const [saleData, setSaleData] = useState({
    customerName: "",
    customerContact: "",
    customerAddress: "",
    paymentMethod: "cash",
    saleNotes: "",
  });

  // Daily summary form state
  const [summaryData, setSummaryData] = useState({
    date: new Date().toISOString().split("T")[0],
    totalSales: 0,
    totalRevenue: 0,
    cashRevenue: 0,
    cardRevenue: 0,
    notes: "",
  });

  // Use the API hook instead of direct fetch
  const { api, isLoading: apiLoading, error: apiError } = useApi();

  useEffect(() => {
    fetchInventory();
    fetchSalesHistory();
  }, []);

  // Show API errors if they occur
  useEffect(() => {
    if (apiError) {
      setError(apiError);
    }
  }, [apiError]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = await api.get("/api/retailer/inventory");

      if (data.success && data.inventory) {
        setInventory(data.inventory);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setError("Failed to load inventory. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await api.get("/api/retailer/sales/history");

      if (data.success && data.sales) {
        setSalesHistory(data.sales);
      }
    } catch (error) {
      console.error("Error fetching sales history:", error);
      setError("Failed to load sales history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTabChange = (newValue) => {
    setTabValue(newValue);
  };

  const handleSaleDataChange = (e) => {
    const { name, value } = e.target;
    setSaleData({
      ...saleData,
      [name]: value,
    });
  };

  const handleSummaryDataChange = (e) => {
    const { name, value } = e.target;

    // Convert numeric values to numbers
    const numericFields = [
      "totalSales",
      "totalRevenue",
      "cashRevenue",
      "cardRevenue",
    ];
    const updatedValue = numericFields.includes(name) ? Number(value) : value;

    setSummaryData({
      ...summaryData,
      [name]: updatedValue,
    });
  };

  // Improved handleAddItem function to support serial number selection
  const handleAddItem = (productId) => {
    const product = inventory.find((item) => item.productId === productId);
    if (
      !product ||
      !product.serialNumbers ||
      product.serialNumbers.length === 0
    ) {
      setError("No available units for this product");
      return;
    }

    // Check if we already have this product in our cart
    const alreadySelected = selectedItems.find(
      (item) => item.productId === productId
    );

    // Find which serial numbers are already selected
    const alreadySelectedSerials = alreadySelected
      ? alreadySelected.serialNumbers
      : [];

    // Find available serials (not already in cart)
    const availableSerials = product.serialNumbers.filter(
      (serial) => !alreadySelectedSerials.includes(serial)
    );

    if (availableSerials.length === 0) {
      setError("All units of this product are already in your cart");
      return;
    }

    // If there's only one available, add it directly
    if (availableSerials.length === 1) {
      addProductToCart(productId, [availableSerials[0]]);
    } else {
      // Otherwise, open the selection modal
      setCurrentProduct({ ...product, availableSerials });
      setSelectedSerials([]);
      setIsSelectingSerials(true);
    }
  };

  // Helper function to add products to cart
  const addProductToCart = (productId, serialsToAdd) => {
    if (!serialsToAdd || serialsToAdd.length === 0) return;

    const product = inventory.find((item) => item.productId === productId);
    if (!product) return;

    // Check if we already have this product in our cart
    const alreadySelectedIndex = selectedItems.findIndex(
      (item) => item.productId === productId
    );

    if (alreadySelectedIndex !== -1) {
      // Update existing item in cart
      setSelectedItems((prev) => {
        const updated = [...prev];
        const currentItem = updated[alreadySelectedIndex];

        updated[alreadySelectedIndex] = {
          ...currentItem,
          quantity: currentItem.quantity + serialsToAdd.length,
          serialNumbers: [...currentItem.serialNumbers, ...serialsToAdd],
          price: currentItem.price || 99.99,
        };

        return updated;
      });
    } else {
      // Add as new item to cart
      setSelectedItems((prev) => [
        ...prev,
        {
          productId,
          productName: product.productName || productId,
          price: 99.99, // Default price
          quantity: serialsToAdd.length,
          serialNumbers: serialsToAdd,
        },
      ]);
    }
  };

  // Modal handlers
  const handleSerialSelectionChange = (serial) => {
    setSelectedSerials((prev) => {
      if (prev.includes(serial)) {
        return prev.filter((s) => s !== serial);
      } else {
        return [...prev, serial];
      }
    });
  };

  const handleSelectAllSerials = () => {
    if (!currentProduct || !currentProduct.availableSerials) return;
    setSelectedSerials([...currentProduct.availableSerials]);
  };

  const handleConfirmSelection = () => {
    if (selectedSerials.length === 0) {
      setError("Please select at least one item");
      return;
    }

    addProductToCart(currentProduct.productId, selectedSerials);
    setIsSelectingSerials(false);
    setCurrentProduct(null);
    setSelectedSerials([]);
  };

  const handleCancelSelection = () => {
    setIsSelectingSerials(false);
    setCurrentProduct(null);
    setSelectedSerials([]);
  };

  const handleRemoveItem = (index) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index, change) => {
    setSelectedItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        // Find the product in inventory
        const product = inventory.find(
          (invItem) => invItem.productId === item.productId
        );

        // Calculate new quantity
        let newQuantity = item.quantity + change;

        // Ensure it's at least 1
        if (newQuantity < 1) newQuantity = 1;

        // Ensure we don't exceed available units
        if (product && product.serialNumbers) {
          if (newQuantity > product.serialNumbers.length) {
            newQuantity = product.serialNumbers.length;
            setError("Maximum available units selected");
          }
        }

        // Update serial numbers based on quantity
        const newSerialNumbers =
          product?.serialNumbers?.slice(0, newQuantity) || [];

        return {
          ...item,
          quantity: newQuantity,
          serialNumbers: newSerialNumbers,
        };
      })
    );
  };

  // Fix handleRecordSale function to properly format the request for the backend
  const handleRecordSale = async () => {
    try {
      if (selectedItems.length === 0) {
        setError("Please select at least one product to sell");
        return;
      }

      setLoading(true);

      // Prepare the data in the format expected by the backend
      const saleRequest = {
        customerName: saleData.customerName,
        customerContact: saleData.customerContact,
        customerAddress: saleData.customerAddress,
        paymentMethod: saleData.paymentMethod,
        saleNotes: saleData.saleNotes,

        // Format each item to include serialNumber instead of serialNumbers array
        // for compatibility with the backend API
        items: selectedItems.map((item) => {
          // Extract all serialNumbers - this is critical
          const allSerialNumbers = item.serialNumbers || [];

          // Use proper format expected by the backend
          return {
            productId: item.productId,
            price: item.price,
            serialNumber: allSerialNumbers[0], // For single item compatibility
            serialNumbers: allSerialNumbers, // Keep this for multiple items
            quantity: item.quantity,
          };
        }),

        timestamp: Date.now(),
      };

      console.log("Sending sale request:", saleRequest);

      const response = await api.post(
        "/api/retailer/sales/record",
        saleRequest
      );

      if (response.success) {
        setSuccess(true);
        // Reset the form
        setSaleData({
          customerName: "",
          customerContact: "",
          customerAddress: "",
          paymentMethod: "cash",
          saleNotes: "",
        });
        setSelectedItems([]);
        // Refresh inventory after sale
        fetchInventory();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.message || "Failed to record sale");
      }
    } catch (err) {
      console.error("Error recording sale:", err);
      setError("Failed to record sale. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordDailySummary = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      // Ensure all numeric values are actually numbers
      const formattedSummaryData = {
        ...summaryData,
        totalSales: Number(summaryData.totalSales),
        totalRevenue: Number(summaryData.totalRevenue),
        cashRevenue: Number(summaryData.cashRevenue),
        cardRevenue: Number(summaryData.cardRevenue),
      };

      // Use the API hook to make the request
      const result = await api.post(
        "/api/retailer/sales/daily-summary",
        formattedSummaryData
      );

      if (result.success) {
        setSuccess(true);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);

        // Reset form
        setSummaryData({
          date: new Date().toISOString().split("T")[0],
          totalSales: 0,
          totalRevenue: 0,
          cashRevenue: 0,
          cardRevenue: 0,
          notes: "",
        });
      } else {
        throw new Error(result.message || "Failed to record daily summary");
      }
    } catch (error) {
      console.error("Error recording daily summary:", error);
      setError(error.message || "Failed to record daily summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sales Management</h1>

      {/* Tab Navigation */}
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
            <span className="mr-2">🛒</span> New Sale
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium flex items-center flex-1 justify-center ${
              tabValue === 1
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => handleTabChange(1)}
          >
            <span className="mr-2">📃</span> Sales History
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium flex items-center flex-1 justify-center ${
              tabValue === 2
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => handleTabChange(2)}
          >
            <span className="mr-2">📊</span> Daily Summary
          </button>
        </div>
      </div>

      {/* New Sale Tab */}
      {tabValue === 0 && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-7/12">
            <div className="bg-white shadow rounded p-4 mb-4">
              <h2 className="text-lg font-medium mb-4">Customer Information</h2>
              <form>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      value={saleData.customerName}
                      onChange={handleSaleDataChange}
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
                      value={saleData.customerContact}
                      onChange={handleSaleDataChange}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Address
                  </label>
                  <input
                    type="text"
                    name="customerAddress"
                    value={saleData.customerAddress}
                    onChange={handleSaleDataChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    name="paymentMethod"
                    value={saleData.paymentMethod}
                    onChange={handleSaleDataChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="cash">Cash</option>
                    <option value="credit">Credit Card</option>
                    <option value="debit">Debit Card</option>
                    <option value="mobile">Mobile Payment</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Notes
                  </label>
                  <textarea
                    name="saleNotes"
                    value={saleData.saleNotes}
                    onChange={handleSaleDataChange}
                    rows="2"
                    className="w-full p-2 border border-gray-300 rounded"
                  ></textarea>
                </div>
              </form>
            </div>

            <div className="bg-white shadow rounded p-4">
              <h2 className="text-lg font-medium mb-4">Selected Items</h2>
              {selectedItems.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No items selected. Add products from inventory.
                </p>
              ) : (
                <ul className="divide-y">
                  {selectedItems.map((item, index) => (
                    <li key={`${item.productId}-${index}`} className="py-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">
                            {item.productName || item.productId}
                          </p>
                          <p className="text-sm text-gray-600">
                            {item.serialNumbers?.length} units × $
                            {item.price?.toFixed(2) || "0.00"}
                          </p>
                          <div className="flex flex-col mt-1">
                            <div className="flex items-center mb-1">
                              <button
                                onClick={() => handleUpdateQuantity(index, -1)}
                                className="w-6 h-6 flex items-center justify-center border rounded"
                              >
                                -
                              </button>
                              <span className="mx-2">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(index, 1)}
                                className="w-6 h-6 flex items-center justify-center border rounded"
                              >
                                +
                              </button>
                            </div>
                            <div className="flex flex-wrap mt-1 text-xs text-gray-500">
                              {item.serialNumbers &&
                                item.serialNumbers.length > 0 && (
                                  <span className="mr-1">
                                    Serial #:{" "}
                                    {item.serialNumbers.length > 1
                                      ? `${item.serialNumbers[0]}, ...`
                                      : item.serialNumbers[0]}
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={handleRecordSale}
                disabled={loading || selectedItems.length === 0}
                className={`w-full mt-4 py-2 px-4 rounded flex items-center justify-center ${
                  loading || selectedItems.length === 0
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <>
                    <span className="mr-2">💰</span> Record Sale
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="lg:w-5/12">
            <div className="bg-white shadow rounded p-4">
              <h2 className="text-lg font-medium mb-4">Available Inventory</h2>
              {loading ? (
                <div className="text-center py-4">
                  <svg
                    className="animate-spin h-8 w-8 text-blue-500 mx-auto"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </div>
              ) : inventory.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No products available in inventory.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Product</th>
                        <th className="text-right py-2 px-4">Available</th>
                        <th className="text-right py-2 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((product) => (
                        <tr key={product.productId} className="border-b">
                          <td className="py-2 px-4">
                            {product.productName || product.productId}
                          </td>
                          <td className="py-2 px-4 text-right">
                            {product.quantity}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <button
                              onClick={() => handleAddItem(product.productId)}
                              disabled={product.quantity <= 0}
                              className={`py-1 px-3 text-xs border rounded ${
                                product.quantity <= 0
                                  ? "border-gray-300 text-gray-300 cursor-not-allowed"
                                  : "border-blue-500 text-blue-500 hover:bg-blue-50"
                              }`}
                            >
                              Add
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Serial Selection Modal */}
      {isSelectingSerials && currentProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="border-b px-6 py-3 flex justify-between items-center">
              <h3 className="text-lg font-medium">Select Items</h3>
              <button
                onClick={handleCancelSelection}
                className="text-gray-400 hover:text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="mb-4">
                Select which items of{" "}
                <strong>
                  {currentProduct.productName || currentProduct.productId}
                </strong>{" "}
                to add:
              </p>

              <div className="mb-4 flex justify-between">
                <span className="text-sm text-gray-500">
                  {selectedSerials.length} of{" "}
                  {currentProduct.availableSerials?.length || 0} selected
                </span>
                <button
                  onClick={handleSelectAllSerials}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded">
                {currentProduct.availableSerials &&
                  currentProduct.availableSerials.map((serial) => (
                    <label
                      key={serial}
                      className="flex items-center px-4 py-2 border-b hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSerials.includes(serial)}
                        onChange={() => handleSerialSelectionChange(serial)}
                        className="mr-3"
                      />
                      <div>
                        <p className="text-sm">{serial}</p>
                      </div>
                    </label>
                  ))}
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-2">
              <button
                onClick={handleCancelSelection}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelection}
                disabled={selectedSerials.length === 0}
                className={`px-4 py-2 rounded ${
                  selectedSerials.length === 0
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales History Tab */}
      {tabValue === 1 && (
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-medium mb-4">Sales History</h2>

          {historyLoading ? (
            <div className="flex justify-center p-8">
              <svg
                className="animate-spin h-10 w-10 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          ) : salesHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No sales records found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Sale ID</th>
                    <th className="text-left py-2 px-4">Customer</th>
                    <th className="text-right py-2 px-4">Items</th>
                    <th className="text-right py-2 px-4">Date</th>
                    <th className="text-right py-2 px-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {salesHistory.map((sale) => (
                    <tr key={sale.saleId} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4">{sale.saleId}</td>
                      <td className="py-2 px-4">
                        {sale.customerName || "Anonymous"}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {sale.items?.length || 0}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {new Date(sale.timestamp).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-4 text-right">
                        $
                        {sale.items
                          ?.reduce(
                            (total, item) =>
                              total + (item.price || 0) * (item.quantity || 1),
                            0
                          )
                          .toFixed(2) || "0.00"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Daily Summary Tab */}
      {tabValue === 2 && (
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-medium mb-4">Daily Summary</h2>

          <form onSubmit={handleRecordDailySummary}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={summaryData.date}
                  onChange={handleSummaryDataChange}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Sales
                </label>
                <input
                  type="number"
                  name="totalSales"
                  value={summaryData.totalSales}
                  onChange={handleSummaryDataChange}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Revenue
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-2">$</span>
                  <input
                    type="number"
                    name="totalRevenue"
                    value={summaryData.totalRevenue}
                    onChange={handleSummaryDataChange}
                    className="w-full p-2 pl-6 border border-gray-300 rounded"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cash Revenue
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-2">$</span>
                  <input
                    type="number"
                    name="cashRevenue"
                    value={summaryData.cashRevenue}
                    onChange={handleSummaryDataChange}
                    className="w-full p-2 pl-6 border border-gray-300 rounded"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Revenue
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-2">$</span>
                  <input
                    type="number"
                    name="cardRevenue"
                    value={summaryData.cardRevenue}
                    onChange={handleSummaryDataChange}
                    className="w-full p-2 pl-6 border border-gray-300 rounded"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Summary Notes
              </label>
              <textarea
                name="notes"
                value={summaryData.notes}
                onChange={handleSummaryDataChange}
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
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                <>
                  <span className="mr-2">📊</span> Record Summary
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Success notification */}
      {success && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded shadow-lg flex items-center">
          <span className="mr-2">✅</span>
          {tabValue === 0
            ? "Sale recorded successfully!"
            : tabValue === 2
            ? "Daily summary recorded successfully!"
            : "Operation completed successfully!"}
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

export default RetailerSales;
