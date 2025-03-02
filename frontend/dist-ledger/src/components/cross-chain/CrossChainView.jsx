import React, { useState } from 'react';
import Card from '../common/Card';
import { FaArrowUp, FaHistory, FaSync } from 'react-icons/fa';
import StatusIndicator from '../common/StatusIndicator';

const CrossChainView = () => {
  const [crossChainData, setCrossChainData] = useState({
    distributor: {
      blockHeight: 124,
      peers: 3,
      outgoing: 15
    },
    main: {
      blockHeight: 156,
      peers: 5
    },
    retailer: {
      blockHeight: 98,
      peers: 2,
      outgoing: 8
    },
    lastSync: '2023-11-01T14:30:00Z',
    operational: true
  });
  
  const [transfers, setTransfers] = useState([
    {
      id: 'txf-123',
      from: 'distributor-chain',
      to: 'main-chain',
      timestamp: '2023-11-01T14:25:00Z',
      productId: 'PROD-1234',
      status: 'completed'
    },
    {
      id: 'txf-124',
      from: 'main-chain',
      to: 'retailer-chain',
      timestamp: '2023-11-01T14:27:30Z',
      productId: 'PROD-1234',
      status: 'completed'
    },
    {
      id: 'txf-125',
      from: 'distributor-chain',
      to: 'main-chain',
      timestamp: '2023-11-01T14:29:45Z',
      productId: 'PROD-5678',
      status: 'pending'
    }
  ]);
  
  const [verifications, setVerifications] = useState([
    {
      id: 'ver-123',
      chain: 'main-chain',
      timestamp: '2023-11-01T14:26:00Z',
      merkleRoot: '0x3f2e1d...',
      blockHeight: 155,
      status: 'verified'
    },
    {
      id: 'ver-124',
      chain: 'distributor-chain',
      timestamp: '2023-11-01T14:28:20Z',
      merkleRoot: '0x7a9b8c...',
      blockHeight: 123,
      status: 'verified'
    },
    {
      id: 'ver-125',
      chain: 'retailer-chain',
      timestamp: '2023-11-01T14:30:15Z',
      merkleRoot: '0x2d3e4f...',
      blockHeight: 97,
      status: 'pending'
    }
  ]);
  
  const [loading, setLoading] = useState(false);
  
  const refreshData = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 border-l-4 border-main pl-3">
        Cross-Chain Data Flow
        <span className="ml-2 inline-block px-2 py-1 text-xs font-bold rounded bg-red-600 text-white">
          Admin Only
        </span>
      </h2>
      
      <Card title="Transaction Relays">
        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
            <div className="md:col-span-4 text-center">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h5 className="font-bold mb-3">Distributor Chain</h5>
                <div className="mb-3">
                  <FaBox className="text-4xl mb-3 text-distributor mx-auto" />
                </div>
                <div className="text-start text-sm space-y-1">
                  <div><span className="font-medium">IP:</span> 127.0.0.1:5000</div>
                  <div><span className="font-medium">Blocks:</span> {crossChainData.distributor.blockHeight}</div>
                  <div><span className="font-medium">Peers:</span> {crossChainData.distributor.peers}</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="inline-block p-2 bg-gray-100 rounded text-sm">
                  <FaArrowUp className="inline mr-1" /> Outgoing: {crossChainData.distributor.outgoing}
                </div>
              </div>
            </div>
            
            <div className="md:col-span-4 text-center">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h5 className="font-bold mb-3">Main Chain</h5>
                <div className="mb-3">
                  <FaHistory className="text-4xl mb-3 text-main mx-auto" />
                </div>
                <div className="text-start text-sm space-y-1">
                  <div><span className="font-medium">IP:</span> 127.0.0.1:6000</div>
                  <div><span className="font-medium">Blocks:</span> {crossChainData.main.blockHeight}</div>
                  <div><span className="font-medium">Peers:</span> {crossChainData.main.peers}</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="p-2 bg-amber-100 rounded text-sm">
                  <FaHistory className="inline mr-1" /> Relay Server
                </div>
              </div>
            </div>
            
            <div className="md:col-span-4 text-center">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h5 className="font-bold mb-3">Retailer Chain</h5>
                <div className="mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-retailer mx-auto">
                    <path d="M5.223 2.25c-.497 0-.974.198-1.325.55l-1.3 1.298A3.75 3.75 0 0 0 7.5 9.75a3.75 3.75 0 0 0 3.75-3.75c0-1.036-.84-1.875-1.875-1.875a1.875 1.875 0 0 1-1.125-3.398l.022-.014c.26-.173.576-.267.91-.267h7.536c.34 0 .663.098.931.279l1.133.765c.33.223.588.542.74.91l1.484 3.571a4.5 4.5 0 0 1-4.302 5.889h-8.054a3 3 0 0 0-2.894 2.197l-.462 1.847a1.5 1.5 0 0 0 1.449 1.846h11.749a1.5 1.5 0 0 0 1.413-.999l1.322-3.967a1.5 1.5 0 0 0-1.416-2.001H9.75a.75.75 0 0 1 0-1.5h8.374a3 3 0 0 1 2.831 4.004l-1.322 3.967a3 3 0 0 1-2.825 1.999H6.045a3 3 0 0 1-2.898-3.695l.463-1.849a1.5 1.5 0 0 1 1.448-1.099h8.054a3 3 0 0 0 2.863-2.111l1.038-2.897a.75.75 0 0 0-.357-.877l-1.134-.765a1.5 1.5 0 0 0-.847-.359H7.5a3.75 3.75 0 0 0-2.977 6.045A3.75 3.75 0 0 0 5.223 2.25Z" />
                  </svg>
                </div>
                <div className="text-start text-sm space-y-1">
                  <div><span className="font-medium">IP:</span> 127.0.0.1:7000</div>
                  <div><span className="font-medium">Blocks:</span> {crossChainData.retailer.blockHeight}</div>
                  <div><span className="font-medium">Peers:</span> {crossChainData.retailer.peers}</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="inline-block p-2 bg-gray-100 rounded text-sm">
                  <FaArrowUp className="inline mr-1" /> Outgoing: {crossChainData.retailer.outgoing}
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center">
              <h6 className="font-medium">Last Sync: <span className="text-gray-600">{new Date(crossChainData.lastSync).toLocaleString()}</span></h6>
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${crossChainData.operational ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <span className={`w-2 h-2 mr-1 rounded-full ${crossChainData.operational ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {crossChainData.operational ? 'Operational' : 'Error'}
                </span>
              </div>
              <button 
                className="btn bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm px-3 py-1"
                onClick={refreshData}
                disabled={loading}
              >
                <FaSync className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Cross-Chain Transfers">
          <div className="max-h-96 overflow-y-auto">
            {transfers.map((transfer) => {
              const fromChain = transfer.from === 'distributor-chain' ? 'bg-distributor' :
                               transfer.from === 'retailer-chain' ? 'bg-retailer' : 'bg-main';
              const toChain = transfer.to === 'distributor-chain' ? 'bg-distributor' :
                             transfer.to === 'retailer-chain' ? 'bg-retailer' : 'bg-main';
              const statusClass = transfer.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
              
              return (
                <div key={transfer.id} className="mb-3 p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${fromChain} mr-2`}></div>
                      <div className="text-sm font-medium">From: {transfer.from}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                      {transfer.status}
                    </span>
                  </div>
                  <div className="my-2 ml-5 border-l-2 border-dashed border-gray-300 pl-4">
                    <div className="text-xs text-gray-500">
                      {new Date(transfer.timestamp).toLocaleString()}
                    </div>
                    <div className="font-mono text-sm my-1">
                      Product: {transfer.productId}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${toChain} mr-2`}></div>
                    <div className="text-sm font-medium">To: {transfer.to}</div>
                  </div>
                </div>
              );
            })}
            
            {transfers.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No transfers found
              </div>
            )}
          </div>
        </Card>
        
        <Card title="Merkle Root Verifications">
          <div className="max-h-96 overflow-y-auto">
            {verifications.map((verification) => {
              const chainClass = verification.chain === 'distributor-chain' ? 'bg-distributor' :
                               verification.chain === 'retailer-chain' ? 'bg-retailer' : 'bg-main';
              const statusClass = verification.status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
              
              return (
                <div key={verification.id} className="mb-3 p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${chainClass} mr-2`}></div>
                      <div className="text-sm font-medium">{verification.chain}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                      {verification.status}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs text-gray-500">
                      {new Date(verification.timestamp).toLocaleString()}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <div className="text-xs text-gray-600">Merkle Root</div>
                        <div className="font-mono text-sm truncate">{verification.merkleRoot}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Block Height</div>
                        <div className="font-mono text-sm">{verification.blockHeight}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {verifications.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No verifications found
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CrossChainView;
