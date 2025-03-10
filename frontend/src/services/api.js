// Base API service for making HTTP requests to the backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to handle HTTP errors
const handleResponse = async (response) => {
  if (!response.ok) {
    // Try to get error message from response
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error ${response.status}`);
    } catch (e) {
      throw new Error(`HTTP error ${response.status}`);
    }
  }
  
  // Check if response is empty
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return response.text();
};


// API service
// Make sure the fetch method is correctly implemented
const apiService = {
  // Base fetch method with auth and error handling
  fetch: async (endpoint, options = {}) => {
    // Use the endpoint directly without modifications
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Get auth token from localStorage if available
    const token = localStorage.getItem('auth_token');
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { 'x-api-key': token } : {})
    };
    
    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };
    
    try {
      const response = await fetch(url, config);
      return await handleResponse(response);
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },
  
  // HTTP method wrappers
  get: (endpoint, options = {}) => {
    return apiService.fetch(endpoint, { ...options, method: 'GET' });
  },
  
  post: (endpoint, data, options = {}) => {
    return apiService.fetch(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  put: (endpoint, data, options = {}) => {
    return apiService.fetch(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  delete: (endpoint, options = {}) => {
    return apiService.fetch(endpoint, { ...options, method: 'DELETE' });
  },
};

export default apiService;