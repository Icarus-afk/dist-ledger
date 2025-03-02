import { useState } from 'react';
import Card from '../common/Card';
import EventForm from './EventForm';
import { FaMap } from 'react-icons/fa';

const SupplyChain = () => {
  const [showAllChains, setShowAllChains] = useState(true);
  const [events, setEvents] = useState([
    {
      id: '123',
      productId: 'PROD-1234',
      type: 'MANUFACTURED',
      location: 'Factory A, China',
      timestamp: '2023-10-01T08:30:00Z',
      handler: 'John Smith',
      chain: 'distributor-chain'
    },
    {
      id: '124',
      productId: 'PROD-1234',
      type: 'SHIPPED',
      location: 'Distribution Center, NY',
      timestamp: '2023-10-05T14:20:00Z',
      handler: 'Logistics Team',
      chain: 'distributor-chain'
    },
    {
      id: '125',
      productId: 'PROD-1234',
      type: 'RETAILER_RECEIVED',
      location: 'Store #123',
      timestamp: '2023-10-08T09:45:00Z',
      handler: 'Jane Doe',
      chain: 'retailer-chain'
    },
    {
      id: '126',
      productId: 'PROD-5678',
      type: 'SOLD',
      location: 'Store #123',
      timestamp: '2023-10-10T16:35:00Z',
      handler: 'Cashier #3',
      chain: 'retailer-chain'
    }
  ]);

  // Dummy switch action
  const handleToggleChains = () => {
    setShowAllChains(!showAllChains);
  };

  // Render chain events with filtering capability
  const renderEvents = () => {
    if (events.length === 0) {
      return (
        <div className="text-center text-gray-500 py-6">
          No events found
        </div>
      );
    }

    let filteredEvents = events;
    // Demo of filtering - in real app would be based on currentRole
    if (!showAllChains) {
      // Just showing how filtering would work
      filteredEvents = events.filter(event => event.chain === 'retailer-chain');
    }

    return (
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {filteredEvents.map(event => {
          const time = new Date(event.timestamp).toLocaleString();
          const chainClass = event.chain.includes('distributor') 
            ? 'border-distributor' 
            : event.chain.includes('retailer') 
              ? 'border-retailer' 
              : 'border-main';
              
          return (
            <div key={event.id} className={`border-l-4 ${chainClass} bg-white p-3 rounded shadow-sm`}>
              <div className="flex justify-between text-sm">
                <span className="font-bold">{event.type}</span>
                <span className="text-gray-500">{time}</span>
              </div>
              <div>Product: <span className="font-mono">{event.productId}</span></div>
              <div className="text-gray-700">
                <span>{event.location}</span>
                <span className="mx-2">•</span>
                <span>Handler: {event.handler}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Supply Chain Management</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <Card title="Record Supply Chain Event">
            <EventForm />
          </Card>
        </div>
        
        <div className="lg:col-span-7">
          <Card 
            title="Recent Supply Chain Events"
            actions={
              <div className="flex items-center">
                <div className="form-check form-switch">
                  <input 
                    className="mr-2 mt-[0.3rem] h-3.5 w-8 appearance-none rounded-[0.4375rem] bg-neutral-300 before:pointer-events-none before:absolute before:h-3.5 before:w-3.5 before:rounded-full before:bg-transparent before:content-[''] after:absolute after:z-[2] after:-mt-[0.1875rem] after:h-5 after:w-5 after:rounded-full after:border-none after:bg-neutral-100 after:shadow-[0_0px_3px_0_rgb(0_0_0_/_7%),_0_2px_2px_0_rgb(0_0_0_/_4%)] after:transition-[background-color_0.2s,transform_0.2s] after:content-[''] checked:bg-primary checked:after:absolute checked:after:z-[2] checked:after:-mt-[3px] checked:after:ml-[1.0625rem] checked:after:h-5 checked:after:w-5 checked:after:rounded-full checked:after:border-none checked:after:bg-primary checked:after:shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),_0_2px_2px_0_rgba(0,0,0,0.14),_0_1px_5px_0_rgba(0,0,0,0.12)] checked:after:transition-[background-color_0.2s,transform_0.2s] checked:after:content-[''] hover:cursor-pointer focus:outline-none focus:ring-0 focus:before:scale-100 focus:before:opacity-[0.12] focus:before:shadow-[3px_-1px_0px_13px_rgba(0,0,0,0.6)] focus:before:transition-[box-shadow_0.2s,transform_0.2s] focus:after:absolute focus:after:z-[1] focus:after:block focus:after:h-5 focus:after:w-5 focus:after:rounded-full focus:after:content-[''] checked:focus:border-primary checked:focus:bg-primary checked:focus:before:ml-[1.0625rem] checked:focus:before:scale-100 checked:focus:before:shadow-[3px_-1px_0px_13px_#3b71ca] checked:focus:before:transition-[box-shadow_0.2s,transform_0.2s]"
                    type="checkbox" 
                    role="switch"
                    id="showAllChainsSwitch"
                    checked={showAllChains}
                    onChange={handleToggleChains}
                  />
                  <label 
                    className="inline-block pl-[0.15rem] hover:cursor-pointer"
                    htmlFor="showAllChainsSwitch"
                  >
                    Show all chains
                  </label>
                </div>
              </div>
            }
          >
            {renderEvents()}
          </Card>
          
          <Card title="Product Journey Visualization">
            <div className="flex mb-4">
              <input
                type="text"
                className="form-input rounded-r-none flex-grow"
                placeholder="Enter Product ID"
              />
              <button 
                className="btn bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-l-none"
              >
                <FaMap /> View Journey
              </button>
            </div>
            
            <div className="text-center text-gray-500 py-8">
              <FaMap className="text-5xl mb-4 mx-auto opacity-25" />
              <p>Enter a product ID to view its journey</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SupplyChain;
