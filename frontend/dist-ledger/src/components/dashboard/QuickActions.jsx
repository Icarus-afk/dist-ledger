import { FaPlusCircle, FaCalendarAlt, FaSearch } from 'react-icons/fa';

const QuickActions = ({ setCurrentView }) => {
  const handleAction = (action) => {
    switch(action) {
      case 'register-product':
        setCurrentView('product-registry');
        break;
      case 'record-event':
        setCurrentView('supply-chain');
        break;
      case 'lookup-product':
        setCurrentView('product-registry');
        // Focus will be handled in the component's useEffect
        break;
      default:
        break;
    }
  };

  return (
    <div className="card">
      <div className="card-header">Quick Actions</div>
      <div className="card-body">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button 
            className="btn btn-distributor" 
            onClick={() => handleAction('register-product')}
          >
            <FaPlusCircle /> Register New Product
          </button>
          
          <button 
            className="btn btn-retailer" 
            onClick={() => handleAction('record-event')}
          >
            <FaCalendarAlt /> Record Supply Chain Event
          </button>
          
          <button 
            className="btn btn-main" 
            onClick={() => handleAction('lookup-product')}
          >
            <FaSearch /> Look Up Product
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
