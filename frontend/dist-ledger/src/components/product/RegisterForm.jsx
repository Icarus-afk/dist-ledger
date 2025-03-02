import { useState } from 'react';
import { FaPlusCircle } from 'react-icons/fa';

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    productId: '',
    name: '',
    manufacturer: '',
    attributes: '{"origin": "USA", "category": "Electronics"}'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData({ ...formData, [id]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      // Validate JSON
      const attributes = JSON.parse(formData.attributes);
      
      // Call API (placeholder for now)
      setTimeout(() => {
        // Simulating API success
        setMessage({ 
          text: 'Product registered successfully!', 
          type: 'success' 
        });
        setFormData({
          productId: '',
          name: '',
          manufacturer: '',
          attributes: '{"origin": "USA", "category": "Electronics"}'
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      setMessage({ 
        text: `Error: ${error.message || 'Failed to register product'}`, 
        type: 'error' 
      });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="productId" className="block text-gray-700 mb-1">Product ID</label>
        <input 
          type="text" 
          id="productId" 
          className="form-input" 
          value={formData.productId}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="name" className="block text-gray-700 mb-1">Name</label>
        <input 
          type="text" 
          id="name" 
          className="form-input" 
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="manufacturer" className="block text-gray-700 mb-1">Manufacturer</label>
        <input 
          type="text" 
          id="manufacturer" 
          className="form-input" 
          value={formData.manufacturer}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="attributes" className="block text-gray-700 mb-1">Attributes (JSON)</label>
        <textarea 
          id="attributes" 
          className="form-input" 
          rows="4"
          value={formData.attributes}
          onChange={handleChange}
          required
        />
      </div>
      
      {message.text && (
        <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}
      
      <button 
        type="submit" 
        className="btn btn-main"
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            Processing...
          </>
        ) : (
          <>
            <FaPlusCircle /> Register Product
          </>
        )}
      </button>
    </form>
  );
};

export default RegisterForm;
