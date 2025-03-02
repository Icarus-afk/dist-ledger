import { apiRequest } from './api';

export const recordEvent = (eventData) =>
  apiRequest('/supply-chain/events', {
    method: 'POST',
    body: JSON.stringify(eventData)
  });

export const getProductJourney = (productId) =>
  apiRequest(`/supply-chain/journey/${productId}`);

export const getRecentEvents = (limit = 10) =>
  apiRequest(`/supply-chain/events?limit=${limit}`);
