import React, { useState, useEffect } from 'react';
import useApi from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

const NotificationsPanel = ({ maxNotifications = 5 }) => {
  const { api } = useApi();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      let fetchedNotifications = [];
      
      // Different endpoints based on entity type
      if (user?.type === 'manufacturer') {
        // For manufacturers - get recent transfers and their statuses
        const response = await api.get('/api/manufacturer/transfers');
        if (response.success && response.transfers) {
          // Only take the 10 most recent transfers to avoid too many requests
          const recentTransfers = response.transfers.slice(0, 10);
          
          for (const transfer of recentTransfers) {
            try {
              // For each transfer, check its current status
              const statusResponse = await api.get(`/api/manufacturer/transfers/${transfer.transferId}/status`);
              
              if (statusResponse.success) {
                fetchedNotifications.push({
                  id: transfer.transferId,
                  type: 'manufacturer_transfer',
                  status: statusResponse.currentStatus || 'pending',
                  timestamp: statusResponse.statusTimestamp || transfer.timestamp,
                  details: {
                    productId: transfer.productId,
                    distributorId: transfer.distributorId,
                    distributorName: transfer.distributorName
                  }
                });
              }
            } catch (err) {
              console.error(`Error checking status for transfer ${transfer.transferId}:`, err);
            }
          }
        }
      } 
      else if (user?.type === 'distributor') {
        // For distributors - get recent shipments and check their statuses
        const response = await api.get('/api/distributor/shipments');
        if (response.success && response.shipments) {
          const recentShipments = response.shipments.slice(0, 10);
          
          for (const shipment of recentShipments) {
            try {
              const statusResponse = await api.get(`/api/distributor/shipments/${shipment.shipmentId}/status`);
              
              if (statusResponse.success) {
                fetchedNotifications.push({
                  id: shipment.shipmentId,
                  type: 'distributor_shipment',
                  status: statusResponse.currentStatus || 'shipped',
                  timestamp: statusResponse.statusTimestamp || shipment.timestamp,
                  details: {
                    productId: shipment.productId,
                    retailerId: shipment.retailerId,
                    retailerName: shipment.retailerName || 'Retailer'
                  }
                });
              }
            } catch (err) {
              console.error(`Error checking status for shipment:`, err);
            }
          }
        }
      } 
      else if (user?.type === 'retailer') {
        // For retailers - use the returns history since it contains status information
        const response = await api.get('/api/retailer/returns/history');
        
        if (response.success && response.returns) {
          fetchedNotifications = response.returns.slice(0, 10).map(ret => ({
            id: ret.returnId,
            type: 'product_return',
            status: ret.status || 'returned',
            timestamp: ret.timestamp,
            details: {
              productId: ret.productId,
              serialNumber: ret.serialNumber,
              reason: ret.reason
            }
          }));
        }
      }
      
      // Sort by timestamp (newest first)
      fetchedNotifications.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(fetchedNotifications);
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications data:', err);
      setError('Could not load notifications');
    } finally {
      setLoading(false);
    }
  };

  // Fetch notifications on initial load
  useEffect(() => {
    if (user?.type) {
      fetchNotifications();
      
      // Poll for new status updates every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.type]);

  // Format notification message based on type and status
  const formatNotificationMessage = (notification) => {
    const { type, status, details } = notification;
    
    switch (type) {
      case 'manufacturer_transfer':
        return `Transfer ${status}: ${details.distributorName || details.distributorId || 'Distributor'}`;
      case 'distributor_shipment':
        return `Shipment ${status}: ${details.retailerName || details.retailerId || 'Retailer'}`;
      case 'product_return':
        return `Return ${status}: ${details.serialNumber || 'Item'} - ${details.reason || 'No reason provided'}`;
      default:
        return `Update: ${status}`;
    }
  };

  // Format notification timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // If today, show time only
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString();
    }
    
    // Otherwise show date and time
    return date.toLocaleString();
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'shipped':
        return 'bg-blue-100 text-blue-800';
      case 'received':
        return 'bg-purple-100 text-purple-800';
      case 'returned':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user?.type) {
    return null; // Don't render anything if user is not logged in
  }

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Recent Updates</h3>
        <div className="flex items-center">
          <button
            onClick={fetchNotifications}
            className="p-1 text-gray-500 hover:text-gray-700 mr-2"
            title="Refresh notifications"
          >
            🔄
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title={expanded ? "Show less" : "Show more"}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {loading && notifications.length === 0 ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-sm p-2">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="text-gray-500 text-sm p-4 text-center bg-gray-50 rounded-lg">
          No recent updates
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-64 border rounded-lg p-2 bg-white">
          {notifications
            .slice(0, expanded ? notifications.length : maxNotifications)
            .map((notification, index) => (
              <div key={index} className="p-2 border rounded-lg hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(notification.status)}`}>
                    {notification.status || 'unknown'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(notification.timestamp)}
                  </span>
                </div>
                <p className="text-sm mt-1">{formatNotificationMessage(notification)}</p>
              </div>
            ))}
          
          {!expanded && notifications.length > maxNotifications && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 p-1"
            >
              Show {notifications.length - maxNotifications} more...
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;