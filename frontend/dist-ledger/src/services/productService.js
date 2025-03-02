import { apiRequest } from './api';

export const registerProduct = (productData) =>
  apiRequest('/products/register', {
    method: 'POST',
    body: JSON.stringify(productData)
  });

export const getProduct = (productId) =>
  apiRequest(`/products/${productId}`);

export const getAllProducts = () =>
  apiRequest('/products');
