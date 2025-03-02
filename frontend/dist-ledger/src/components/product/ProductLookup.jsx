import { useState } from 'react';
import { FaSearch, FaBarcode } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';

const ProductLookup = () => {
  const [productId, setProductId] = useState('');
  const [productInfo, setProductInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async () => {
    if (!productId.trim()) return;
    
    setLoading(true);
    setError('');
    setProductInfo(null);
    
    try {
      // Simulating API call
      setTimeout(() => {
        // Mock data for demonstration
        if (productId === '123456') {
          setProductInfo({
            id: '123456',
            name: 'Smartphone XYZ',
            manufacturer: 'Tech Corp',
            registeredOn: '2023-10-15T12:30:00Z',
            attributes: {
              origin: 'China',
              category: 'Electronics',
              weight: '180g',
              dimensions: '15x7x0.8cm'
            },
            events: [
              { type: 'MANUFACTURED', date: '2023-09-01', location: 'Factory A' },
              { type: 'SHIPPED', date: '2023-09-15', location: 'Distribution Center' },
              { type: 'RETAILER_RECEIVED', date: '2023-09-30', location: 'Retail Store #123' }
            ]
          });
        } else {
          setError('Product not found');
        }
        setLoading(false);
      }, 1000);
    } catch (error) {
      setError(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  const renderProductInfo = () => {
    if (loading) return <LoadingSpinner />;
    
    if (error) {
      return (
        <div className="text-center p-6 bg-red-50 text-red-700 rounded-lg">
          <span className="block text-4xl mb-2">😕</span>
          {error}
        </div>
      );
    }
    
    if (!productInfo) {
      return (
        <div className="text-center text-gray-500 p-6">
          <FaBarcode className="text-5xl mb-2 mx-auto" />
          <p>Enter a product ID to view details</p>
        </div>
      );
    }
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-xl font-bold mb-3">{productInfo.name}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 font-medium text-gray-600">Product ID:</td>
                  <td>{productInfo.id}</td>
                </tr>
                <tr>
                  <td className="py-1 font-medium text-gray-600">Manufacturer:</td>
                  <td>{productInfo.manufacturer}</td>
                </tr>
                <tr>
                  <td className="py-1 font-medium text-gray-600">Registered:</td>
                  <td>{new Date(productInfo.registeredOn).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div>
            <h4 className="text-sm font-bold mb-1 text-gray-600">Attributes:</h4>
            <div className="bg-gray-100 p-2 rounded text-xs font-mono">
              {JSON.stringify(productInfo.attributes, null, 2)}
            </div>
          </div>
        </div>
        
        <h4 className="font-bold mb-2 text-gray-700">Product Journey</h4>
        <div className="space-y-2">
          {productInfo.events.map((event, index) => (
            <div 
              key={index}
              className="flex items-center p-2 bg-gray-50 border-l-4 border-main"
            >
              <div className="mr-4 bg-main text-white rounded-full w-8 h-8 flex items-center justify-center">
                {index + 1}
              </div>
              <div>
                <div className="font-medium">{event.type}</div>
                <div className="text-sm text-gray-600">
                  {event.location} • {new Date(event.date).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex mb-4">
        <input
          type="text"
          className="form-input rounded-r-none flex-grow"
          placeholder="Enter Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
        <button 
          className="btn bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-l-none"
          onClick={handleLookup}
        >
          <FaSearch /> Lookup
        </button>
      </div>
      
      <div className="mt-4">
        {renderProductInfo()}
      </div>
    </div>
  );
};

export default ProductLookup;
