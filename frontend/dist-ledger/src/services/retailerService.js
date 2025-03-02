import { apiRequest } from './api';

export const fetchRetailerInventory = () => 
  apiRequest('/retailer/inventory');

export const recordSale = (saleData) =>
  apiRequest('/retailer/sales/record', {
    method: 'POST',
    body: JSON.stringify(saleData)
  });

export const receiveShipment = (shipmentData) =>
  apiRequest('/retailer/receive', {
    method: 'POST',
    body: JSON.stringify(shipmentData)
  });
