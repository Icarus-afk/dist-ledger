import { useState, useCallback, useMemo } from 'react';
import apiService from '../services/api';

const useApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Memoize the callApi function
// In useApi.js
  const callApi = useCallback(async (apiCall, ...params) => {
    console.log('API call triggered:', params);
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await apiCall(...params);
      return result;
    } catch (err) {
      console.error('API error:', err);
      setError(err.message || 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
}, []);
  // Memoize the API methods to prevent recreating them on every render
  const api = useMemo(() => {
    // Create the base methods
    const get = (endpoint) => callApi(apiService.get, endpoint);
    const post = (endpoint, data) => callApi(apiService.post, endpoint, data);
    const put = (endpoint, data) => callApi(apiService.put, endpoint, data);
    const del = (endpoint) => callApi(apiService.delete, endpoint);

    return {
      get,
      post,
      put,
      delete: del,
    };
  }, [callApi]);

  return { api, isLoading, error };
};

export default useApi;