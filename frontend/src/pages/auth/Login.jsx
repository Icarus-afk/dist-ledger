import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

const Login = () => {
  const [credentials, setCredentials] = useState({
    apiKey: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!credentials.apiKey) {
      setErrorMessage('Key is required');
      return;
    }
    
    try {
      const result = await login(credentials.apiKey);
      
      if (result.success) {
        // Store authentication data in localStorage
        localStorage.setItem('auth_token', result.entity.apiKey);
        localStorage.setItem('user_id', result.entity.id);
        localStorage.setItem('user_type', result.entity.type);
        localStorage.setItem('user_name', result.entity.name);
        localStorage.setItem('user_location', result.entity.location || '');
        
        console.log('Login successful, stored token:', result.entity.apiKey);
        
        // Redirect based on user role
        const roleRoutes = {
          manufacturer: '/manufacturer/dashboard',
          distributor: '/distributor/dashboard',
          retailer: '/retailer/dashboard'
        };
        
        navigate(roleRoutes[result.entity.type] || '/dashboard', { replace: true });
      } else {
        setErrorMessage(result.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage(err.message || error || 'An error occurred during login');
    }
  };

  return (
    <Card className="w-full">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-neutral-800 mb-1">Login to DistLedger</h2>
        <p className="text-sm text-neutral-600">
          Enter your key to access your dashboard
        </p>
      </div>
      
      {errorMessage && (
        <div className="mb-4 p-3 bg-accent-50 text-accent-700 rounded border border-accent-200 text-sm">
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Key"
          type="text"
          id="apiKey"
          name="apiKey"
          value={credentials.apiKey}
          onChange={handleChange}
          placeholder="Your Key"
          required
          fullWidth
        />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
            />
            <label htmlFor="remember" className="ml-2 block text-sm text-neutral-700">
              Remember me
            </label>
          </div>
        </div>
        
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={loading}
          disabled={loading}
        >
          Sign In
        </Button>
      </form>
      
      <div className="mt-4 text-center">
        <p className="text-sm text-neutral-600">
          Don't have an account?{' '}
          <Link to="/auth/register" className="font-medium text-primary-600 hover:text-primary-500">
            Register
          </Link>
        </p>
      </div>
      
      <div className="mt-4 pt-4 border-t border-neutral-200 text-center">
        <Link to="/verification/product" className="text-sm text-highlight-600 hover:text-highlight-700">
          Verify a product
        </Link>
      </div>
    </Card>
  );
};

export default Login;