import React, { useState } from "react";
import useApi from "../../hooks/useApi";

const VerifyProduct = () => {
  const { api } = useApi();
  const [productData, setProductData] = useState({
    serialNumber: "",
  });
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inconsistencyDetected, setInconsistencyDetected] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProductData({
      ...productData,
      [name]: value,
    });
  };

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!productData.serialNumber) {
      setError("Serial Number is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setVerificationResult(null);
      setInconsistencyDetected(false);

      // Get verification from API
      const response = await api.get(
        `/api/verify/product/${productData.serialNumber}`
      );

      // Check for potential inconsistencies in location data
      // For example, if it's "sold" but still shows at distributor
      if (
        response.currentLocation?.type === "distributor" &&
        response.currentLocation?.status === "in_stock"
      ) {
        try {
          // Double-check with retailer transactions to see if this is actually at a retailer or sold
          const retailerCheck = await api.get(`/api/retailer/inventory`);

          if (retailerCheck.success && retailerCheck.inventory) {
            // Check if any retailer has this product in inventory
            const foundInRetailerInventory = retailerCheck.inventory.some(
              (item) =>
                item.serialNumbers &&
                item.serialNumbers.includes(productData.serialNumber)
            );

            if (foundInRetailerInventory) {
              setInconsistencyDetected(true);
              // API response is incorrect - fix the location data
              response.currentLocation = {
                type: "retailer",
                status: "in_stock",
                entityId: "retailer-id", // We don't know which retailer, but we know it's at a retailer
              };
            }
          }
        } catch (err) {
          // Failed to verify with retailer data, use the original response
          console.warn("Failed to verify retailer data:", err);
        }
      }

      setVerificationResult(response);
    } catch (err) {
      console.error("Verification error:", err);
      setError(
        "Failed to verify product. Please check the serial number and try again."
      );
      setVerificationResult(null);
    } finally {
      setLoading(false);
    }
  };

  const renderVerificationStatus = () => {
    if (!verificationResult) return null;

    if (!verificationResult.success) {
      return (
        <div className="p-6 bg-red-50 rounded-lg border border-red-200 text-center">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-800 mt-4">
            Verification Failed
          </h3>
          <p className="text-red-700 mt-2">
            {verificationResult.message || "Product not verified"}
          </p>
        </div>
      );
    }

    // Extract data from the response structure
    const {
      productInfo,
      currentLocation,
      authenticity,
      serialNumber,
      productId,
    } = verificationResult;

    // Safely handle potentially missing fields
    const manufacturer = productInfo?.manufacturer || {};

    // Update the getStatusText function to better interpret results from the API

    const getStatusText = (status, location, transactionHistory) => {
      if (status === "removed_from_inventory") {
        if (
          transactionHistory &&
          transactionHistory.length >= 2 &&
          transactionHistory[0].status === "remove" &&
          transactionHistory[1].status === "sold"
        ) {
          return "Sold";
        }
      }

      //  status mapping
      switch (status) {
        case "in_stock":
          return "In Stock";
        case "sold":
          return "Sold";
        case "returned":
          return "Returned";
        case "shipping":
          return "In Transit";
        case "removed_from_inventory":
          return "Removed from Inventory";
        default:
          return status || "Unknown";
      }
    };

    const getStatusColor = (status, location, transactionHistory) => {
      if (status === "removed_from_inventory") {
        if (
          transactionHistory &&
          transactionHistory.length >= 2 &&
          transactionHistory[0].status === "remove" &&
          transactionHistory[1].status === "sold"
        ) {
          return "bg-purple-100 text-purple-800"; // Same color as "sold"
        }
      }

      // Regular color mapping
      switch (status) {
        case "in_stock":
          return "bg-blue-100 text-blue-800";
        case "sold":
          return "bg-purple-100 text-purple-800";
        case "returned":
          return "bg-red-100 text-red-800";
        case "shipping":
          return "bg-yellow-100 text-yellow-800";
        default:
          return "bg-gray-100 text-gray-800";
      }
    };

    const getEntityTypeColor = (type) => {
      switch (type) {
        case "manufacturer":
          return "bg-blue-500";
        case "distributor":
          return "bg-yellow-500";
        case "retailer":
          return "bg-green-500";
        case "customer":
          return "bg-purple-500";
        case "in_transit":
          return "bg-orange-500";
        default:
          return "bg-gray-500";
      }
    };

    return (
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="p-6 bg-green-50 text-center border-b border-green-100">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-green-800 mt-4">
            Product Verified
          </h3>
          <p className="text-green-700">
            This product is authentic and registered in our system
          </p>
        </div>

        {inconsistencyDetected && (
          <div className="p-3 bg-amber-50 text-amber-800 border-b border-amber-100 text-sm">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 mr-2 text-amber-600 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="font-medium">
                  Location data inconsistency detected
                </p>
                <p>
                  We've detected that this product's location information may
                  have been updated more recently than shown in the blockchain
                  records. The information displayed has been corrected.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          <h4 className="text-lg font-medium mb-4">Product Information</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Product ID</p>
              <p className="font-medium">{productId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Serial Number</p>
              <p className="font-medium">{serialNumber}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Manufacturer</p>
              <p className="font-medium">{manufacturer.name || "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{productInfo.name || "Unknown"}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Category</p>
              <p className="font-medium">{productInfo.category || "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Status</p>
              <span
                className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                  currentLocation.status,
                  currentLocation,
                  verificationResult.transactionHistory
                )}`}
              >
                {getStatusText(
                  currentLocation.status,
                  currentLocation,
                  verificationResult.transactionHistory
                )}
              </span>
            </div>
          </div>

          {productInfo.description && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Description</p>
              <p className="text-sm">{productInfo.description}</p>
            </div>
          )}

          <div className="mt-6">
            <h4 className="text-lg font-medium mb-4">Current Location</h4>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center mb-2">
                <span
                  className={`w-3 h-3 rounded-full mr-2 ${getEntityTypeColor(
                    currentLocation.type
                  )}`}
                ></span>
                <span className="font-medium capitalize">
                  {currentLocation.type || "Unknown"}
                </span>
                {currentLocation.entityId && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({currentLocation.entityId})
                  </span>
                )}
              </div>

              {currentLocation.type === "in_transit" && (
                <div className="mt-2 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium mr-2">From:</span>
                    <span>{currentLocation.from || "Unknown"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-2">To:</span>
                    <span>{currentLocation.to || "Unknown"}</span>
                  </div>
                </div>
              )}

              {currentLocation.status === "removed_from_inventory" &&
                verificationResult.transactionHistory &&
                verificationResult.transactionHistory.length >= 2 &&
                verificationResult.transactionHistory[0].status === "remove" &&
                verificationResult.transactionHistory[1].status === "sold" && (
                  <p className="text-xs mt-1">
                    Sale ID:{" "}
                    <span className="font-mono text-gray-700">
                      {verificationResult.transactionHistory[1].transactionId}
                    </span>
                  </p>
                )}

              <p className="text-xs mt-1 capitalize">
                Status:{" "}
                <span className="font-medium">
                  {getStatusText(
                    currentLocation.status,
                    currentLocation,
                    verificationResult.transactionHistory
                  )}
                </span>
              </p>

              {currentLocation.saleId && (
                <p className="text-xs mt-1">
                  Sale ID:{" "}
                  <span className="font-mono text-gray-700">
                    {currentLocation.saleId}
                  </span>
                </p>
              )}

              {currentLocation.returnId && (
                <p className="text-xs mt-1">
                  Return ID:{" "}
                  <span className="font-mono text-gray-700">
                    {currentLocation.returnId}
                  </span>
                </p>
              )}

              {verificationResult.verificationTimestamp && (
                <p className="text-xs text-gray-500 mt-1">
                  Verified:{" "}
                  {new Date(
                    verificationResult.verificationTimestamp
                  ).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {authenticity && (
            <div className="mt-6">
              <h4 className="text-lg font-medium mb-2">Verification Details</h4>
              <div className="bg-gray-50 p-4 rounded">
                <p className="mb-2 flex items-center">
                  <span
                    className={
                      authenticity.isAuthentic
                        ? "text-green-500 mr-2"
                        : "text-red-500 mr-2"
                    }
                  >
                    {authenticity.isAuthentic ? "✓" : "✗"}
                  </span>
                  <span className="font-medium">
                    {authenticity.isAuthentic
                      ? "Product is authentic"
                      : "Authentication failed"}
                  </span>
                </p>

                {authenticity.rootMatchesRegistration !== undefined && (
                  <p className="flex items-center text-sm mb-2">
                    <span
                      className={
                        authenticity.rootMatchesRegistration
                          ? "text-green-500 mr-2"
                          : "text-red-500 mr-2"
                      }
                    >
                      {authenticity.rootMatchesRegistration ? "✓" : "✗"}
                    </span>
                    <span>
                      Blockchain record{" "}
                      {authenticity.rootMatchesRegistration
                        ? "matches"
                        : "does not match"}{" "}
                      product registration
                    </span>
                  </p>
                )}

                {authenticity.merkleRoot && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Merkle Root:</p>
                    <p className="text-xs font-mono bg-gray-100 p-2 rounded overflow-x-auto break-all">
                      {authenticity.merkleRoot}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <span className="mr-2 text-blue-600">🔍</span>
          Verify Product Authenticity
        </h1>
        <p className="text-gray-600 mt-1">
          Enter the product serial number to verify if the product is authentic
          and registered in our system.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="bg-white shadow rounded p-6">
            <h2 className="text-lg font-medium mb-4">Enter Product Details</h2>

            <form onSubmit={handleVerify}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serial Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="serialNumber"
                  value={productData.serialNumber}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. PROD-8b26c00-00001"
                  required
                />
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
                    Verifying...
                  </span>
                ) : (
                  <>
                    <span className="mr-2">🔍</span> Verify Product
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
                <p className="flex items-center">
                  <span className="mr-2">❌</span> {error}
                </p>
              </div>
            )}

            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                How to find your serial number
              </h3>
              <p className="text-sm text-gray-600">
                The serial number can typically be found:
              </p>
              <ul className="list-disc ml-5 text-sm text-gray-600 mt-1 space-y-1">
                <li>On the product packaging</li>
                <li>On a label attached to the product</li>
                <li>In the accompanying documentation</li>
                <li>Sometimes engraved or printed directly on the product</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          {loading ? (
            <div className="bg-white shadow rounded p-12 flex flex-col items-center justify-center">
              <svg
                className="animate-spin h-12 w-12 text-blue-500 mb-4"
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
              <p className="text-gray-500">Verifying product authenticity...</p>
            </div>
          ) : verificationResult ? (
            renderVerificationStatus()
          ) : (
            <div className="bg-white shadow rounded p-6 flex items-center justify-center h-full">
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    ></path>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-800">
                  Ready to Verify Product
                </h3>
                <p className="text-gray-600 mt-2">
                  Enter the product's serial number to check its authenticity
                  and view its supply chain journey.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyProduct;
