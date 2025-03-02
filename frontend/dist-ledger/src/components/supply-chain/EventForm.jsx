import { useState } from 'react';
import { FaCalendarPlus } from 'react-icons/fa';

const EventForm = () => {
  const [formData, setFormData] = useState({
    productId: '',
    eventType: 'MANUFACTURED',
    location: '',
    handler: '',
    eventData: '{}'
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
      JSON.parse(formData.eventData);
      
      // Call API (placeholder for now)
      setTimeout(() => {
        // Simulating API success
        setMessage({ 
          text: 'Event recorded successfully!', 
          type: 'success' 
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      setMessage({ 
        text: `Error: ${error.message || 'Failed to record event'}`, 
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
        <label htmlFor="eventType" className="block text-gray-700 mb-1">Event Type</label>
        <select 
          id="eventType" 
          className="form-input" 
          value={formData.eventType}
          onChange={handleChange}
        >
          <option value="MANUFACTURED">Manufactured</option>
          <option value="PACKAGED">Packaged</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DISTRIBUTOR_RECEIVED">Distributor Received</option>
          <option value="RETAILER_RECEIVED">Retailer Received</option>
          <option value="SHELVED">Placed on Shelf</option>
          <option value="SOLD">Sold</option>
          <option value="RETURNED">Returned</option>
        </select>
      </div>
      
      <div className="mb-4">
        <label htmlFor="location" className="block text-gray-700 mb-1">Location</label>
        <input 
          type="text" 
          id="location" 
          className="form-input" 
          value={formData.location}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="handler" className="block text-gray-700 mb-1">Handler</label>
        <input 
          type="text" 
          id="handler" 
          className="form-input" 
          value={formData.handler}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="eventData" className="block text-gray-700 mb-1">Additional Data (JSON)</label>
        <textarea 
          id="eventData" 
          className="form-input" 
          rows="3"
          value={formData.eventData}
          onChange={handleChange}
        />
      </div>
      
      {message.text && (
        <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}
      
      <button 
        type="submit" 
        className="btn btn-primary"
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            Processing...
          </>
        ) : (
          <>
            <FaCalendarPlus /> Record Event
          </>
        )}
      </button>
    </form>
  );
};

export default EventForm;
