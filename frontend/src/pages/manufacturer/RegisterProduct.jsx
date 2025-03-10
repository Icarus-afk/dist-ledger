import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';

const RegisterProduct = () => {
  const { api, isLoading: apiLoading, error: apiError } = useApi();
  const [distributors, setDistributors] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: 1,
    unitPrice: 0,
    manufacturingCost: 0,
    productionFacility: '',
    specifications: {},
    distributorId: '' // Selected distributor
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch distributors on component mount
  useEffect(() => {
    const fetchDistributors = async () => {
      try {
        const data = await api.get('/api/entities/distributor');
        
        if (data.success) {
          setDistributors(data.entities || []);
        } else {
          setError(data.message || 'Failed to load distributors');
        }
      } catch (err) {
        console.error('Error fetching distributors:', err);
        setError('Failed to load distributors');
      }
    };

    fetchDistributors();
  }, [api]);

  // Update error state when apiError changes
  useEffect(() => {
    if (apiError) {
      setError(apiError);
    }
  }, [apiError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSpecificationChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      specifications: {
        ...formData.specifications,
        [name]: value
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const payload = {
        ...formData,
        quantity: parseInt(formData.quantity),
        unitPrice: parseFloat(formData.unitPrice),
        manufacturingCost: parseFloat(formData.manufacturingCost),
        // Only include distributorId if one was selected
        ...(formData.distributorId && { distributorId: formData.distributorId })
      };

      const data = await api.post('/api/products/register', payload);

      if (data.success) {
        setSuccess({
          message: 'Product registered successfully!',
          productId: data.productId,
          serialNumberCount: data.serialNumberCount
        });
        
        // Reset form after successful submission
        setFormData({
          name: '',
          description: '',
          category: '',
          quantity: 1,
          unitPrice: 0,
          manufacturingCost: 0,
          productionFacility: '',
          specifications: {},
          distributorId: '' 
        });
      } else {
        setError(data.message || 'Failed to register product');
      }
    } catch (err) {
      console.error('Error registering product:', err);
      setError('An error occurred while registering the product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Register New Product</h1>
      
      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-3 mb-4 bg-green-50 border border-green-200 text-green-700 rounded">
          <p className="font-medium">{success.message}</p>
          <p>Product ID: {success.productId}</p>
          <p>Serial Numbers Generated: {success.serialNumberCount}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Product Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Description:</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Category:</label>
          <input
            type="text"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Quantity:</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              min="1"
              required
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Unit Price ($):</label>
            <input
              type="number"
              name="unitPrice"
              value={formData.unitPrice}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Manufacturing Cost ($):</label>
            <input
              type="number"
              name="manufacturingCost"
              value={formData.manufacturingCost}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Production Facility:</label>
          <input
            type="text"
            name="productionFacility"
            value={formData.productionFacility}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Assign to Distributor:</label>
          <select
            name="distributorId"
            value={formData.distributorId}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          >
            <option value="">-- Select a distributor (optional) --</option>
            {distributors.map(distributor => (
              <option key={distributor.id} value={distributor.id}>
                {distributor.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            If selected, this distributor will be notified about the new product.
          </p>
        </div>
        
        <div>
          <h3 className="text-md font-medium mb-2">Product Specifications</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-3 rounded">
            <div>
              <label className="block text-sm font-medium mb-1">Weight:</label>
              <input
                type="text"
                name="weight"
                value={formData.specifications.weight || ''}
                onChange={handleSpecificationChange}
                className="w-full p-2 border rounded"
                placeholder="e.g., 500g"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Dimensions:</label>
              <input
                type="text"
                name="dimensions"
                value={formData.specifications.dimensions || ''}
                onChange={handleSpecificationChange}
                className="w-full p-2 border rounded"
                placeholder="e.g., 10cm x 5cm x 2cm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Color:</label>
              <input
                type="text"
                name="color"
                value={formData.specifications.color || ''}
                onChange={handleSpecificationChange}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Material:</label>
              <input
                type="text"
                name="material"
                value={formData.specifications.material || ''}
                onChange={handleSpecificationChange}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
        </div>
        
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || apiLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading || apiLoading ? 'Registering...' : 'Register Product'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterProduct;