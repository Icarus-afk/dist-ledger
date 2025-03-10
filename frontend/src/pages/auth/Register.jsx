import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Select from '../../components/common/Select';
import Alert from '../../components/common/Alert';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    entityType: 'manufacturer',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    location: ''
  });
  const API_BASE_URL = 'http://localhost:3000';
  const [registrationResult, setRegistrationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmSaved, setConfirmSaved] = useState(false);
  
  const navigate = useNavigate();

  const entityTypes = [
    { value: 'manufacturer', label: 'Manufacturer' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'retailer', label: 'Retailer' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setRegistrationResult(null);
    
    try {
      // Prepare the data for registration
      const registrationData = {
        name: formData.name,
        contactInfo: {
          person: formData.contactPerson,
          email: formData.email,
          phone: formData.phone
        },
        location: formData.location,
        address: formData.address
      };
      
      // Make API call to register entity
      const response = await fetch(`${API_BASE_URL}/api/register/${formData.entityType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Store the registration result to show the user
        setRegistrationResult({
          id: data.id,
          apiKey: data.apiKey,
          entityType: data.entityType,
          name: data.name
        });
      } else {
        setErrorMessage(data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setErrorMessage(err.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSaved = () => {
    setConfirmSaved(true);
  };

  const handleProceedToLogin = () => {
    // Store info in localStorage to pre-fill the login form
    if (registrationResult) {
      localStorage.setItem('auth_token', registrationResult.apiKey);
      localStorage.setItem('user_id', registrationResult.id);
      localStorage.setItem('user_type', registrationResult.entityType);
      localStorage.setItem('user_name', registrationResult.name);
    }
    
    navigate('/auth/login');
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <Card className="w-full">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-neutral-800 mb-1">Register for DistLedger</h2>
        <p className="text-sm text-neutral-600">
          Create an account to join the supply chain network
        </p>
      </div>
      
      {errorMessage && (
        <div className="mb-4 p-3 bg-accent-50 text-accent-700 rounded border border-accent-200 text-sm">
          {errorMessage}
        </div>
      )}
      
      {registrationResult ? (
        <div className="space-y-6">
          <Alert 
            type="success" 
            title="Registration Successful!" 
            message="Your account has been created. Please save your API Key and Entity ID - you'll need these to log in." 
          />
          
          <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
            <h3 className="font-medium text-neutral-900 mb-2">Your Credentials</h3>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-neutral-500">Entity ID</p>
                <div className="flex items-center mt-1">
                  <code className="flex-1 bg-white p-2 text-sm rounded border border-neutral-300">
                    {registrationResult.id}
                  </code>
                  <button 
                    onClick={() => handleCopyToClipboard(registrationResult.id)}
                    className="ml-2 p-1 text-neutral-600 hover:text-primary-600"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-neutral-500">API Key</p>
                <div className="flex items-center mt-1">
                  <code className="flex-1 bg-white p-2 text-sm rounded border border-neutral-300 overflow-x-auto">
                    {registrationResult.apiKey}
                  </code>
                  <button 
                    onClick={() => handleCopyToClipboard(registrationResult.apiKey)}
                    className="ml-2 p-1 text-neutral-600 hover:text-primary-600"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex items-center">
              <input
                id="confirm-saved"
                name="confirm-saved"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                checked={confirmSaved}
                onChange={() => setConfirmSaved(!confirmSaved)}
              />
              <label htmlFor="confirm-saved" className="ml-2 block text-sm text-neutral-700">
                I have saved these credentials in a secure location
              </label>
            </div>
          </div>
          
          <div className="flex flex-col space-y-3">
            <Button
              type="button"
              variant="primary"
              fullWidth
              disabled={!confirmSaved}
              onClick={handleProceedToLogin}
            >
              Proceed to Login
            </Button>
            
            {!confirmSaved && (
              <p className="text-sm text-accent-600 text-center">
                Please confirm you've saved your credentials before proceeding
              </p>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Entity Type"
            id="entityType"
            name="entityType"
            value={formData.entityType}
            onChange={handleChange}
            options={entityTypes}
            required
            fullWidth
          />
          
          <Input
            label="Entity Name"
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your company name"
            required
            fullWidth
          />
          
          <Input
            label="Contact Person"
            type="text"
            id="contactPerson"
            name="contactPerson"
            value={formData.contactPerson}
            onChange={handleChange}
            placeholder="Full name"
            required
            fullWidth
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="contact@example.com"
              required
              fullWidth
            />
            
            <Input
              label="Phone"
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1 (555) 123-4567"
              fullWidth
            />
          </div>
          
          <Input
            label="Address"
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Street address"
            fullWidth
          />
          
          <Input
            label="Location"
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="City, Country"
            fullWidth
          />
          
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            disabled={loading}
          >
            Register
          </Button>
        </form>
      )}
      
      <div className="mt-4 text-center">
        <p className="text-sm text-neutral-600">
          Already have an account?{' '}
          <Link to="/auth/login" className="font-medium text-primary-600 hover:text-primary-500">
            Sign In
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

export default Register;