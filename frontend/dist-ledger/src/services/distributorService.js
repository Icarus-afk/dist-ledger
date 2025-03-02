import { apiRequest } from './api';

export const fetchDistributorInventory = () => 
  apiRequest('/distributor/inventory');

export const addDistributorProduct = (productData) =>
  apiRequest('/distributor/inventory/add', {
    method: 'POST',
    body: JSON.stringify(productData)
  });

export const shipProduct = (shipmentData) =>
  apiRequest('/distributor/ship', {
    method: 'POST',
    body: JSON.stringify(shipmentData)
  });
