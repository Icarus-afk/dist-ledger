import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const API_BASE_URL = 'http://localhost:3000';
  // Initialize auth state from localStorage on app startup
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userId = localStorage.getItem('user_id');
    const userType = localStorage.getItem('user_type');
    
    if (token && userId && userType) {
      setCurrentUser({
        id: userId,
        apiKey: token,
        type: userType,
        role: userType, // Add role for route protection
      });
    }
    
    setLoading(false);
  }, []);

  const login = async (apiKey) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (data.success) {
        setCurrentUser({
          ...data.entity,
          role: data.entity.type // Add role for route protection
        });
        setLoading(false);
        return data;
      } else {
        setError(data.message || 'Login failed');
        setLoading(false);
        return data;
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login');
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_location');
    setCurrentUser(null);
  };

  // Get value properties used by the route protection
  const isAuthenticated = !!currentUser;
  const userRole = currentUser?.role || null;

  const value = {
    currentUser,
    loading,
    error,
    login,
    logout,
    isAuthenticated,
    userRole,
    getAuthHeaders: () => {
      if (!currentUser) return {};
      return {
        'Authorization': `Bearer ${currentUser.apiKey}`
      };
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};