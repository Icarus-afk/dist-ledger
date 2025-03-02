import React, { useState } from 'react';
import Card from '../common/Card';
import BlockExplorer from './BlockExplorer';
import { FaDatabase, FaBox, FaSync, FaCheckSquare } from 'react-icons/fa';
import StatusIndicator from '../common/StatusIndicator';

const NetworkMonitor = () => {
  const [nodes, setNodes] = useState({
    "distributor-chain": {
      mainNode: { status: "online", blocks: 124, peers: 3 },
      secondaryNodes: [
        { id: "node-d1", status: "online", blocks: 124, address: "192.168.1.101:5001" },
        { id: "node-d2", status: "online", blocks: 124, address: "192.168.1.102:5001" }
      ]
    },
    "retailer-chain": {
      mainNode: { status: "online", blocks: 98, peers: 2 },
      secondaryNodes: [
        { id: "node-r1", status: "online", blocks: 98, address: "192.168.1.201:5002" }
      ]
    },
    "main-chain": {
      mainNode: { status: "online", blocks: 156, peers: 5 },
      secondaryNodes: [
        { id: "node-m1", status: "online", blocks: 156, address: "192.168.1.10:5000" },
        { id: "node-m2", status: "online", blocks: 156, address: "192.168.1.11:5000" }
      ]
    }
  });
  
  const [isLoading, setIsLoading] = useState({
    setupStreams: false,
    forceBlocks: false,
    syncRoots: false,
    checkPeers: false
  });
  
  const [logs, setLogs] = useState([
    { time: "2023-11-01T14:30:00Z", level: "info", message: "Blockchain networks initialized" },
    { time: "2023-11-01T14:31:12Z", level: "info", message: "Streams synchronized across chains" },
    { time: "2023-11-01T14:32:45Z", level: "warning", message: "Retailer node r2 disconnected" },
    { time: "2023-11-01T14:33:20Z", level: "error", message: "Failed to process transaction tx123abc" }
  ]);
  
  const handleAdminAction = (action) => {
    const loadingKey = {
      'setupStreams': 'setupStreams',
      'forceBlocks': 'forceBlocks', 
      'syncRoots': 'syncRoots',
      'checkPeers': 'checkPeers'
    }[action];
    
    setIsLoading(prev => ({ ...prev, [loadingKey]: true }));
    
    // Simulate API call
    setTimeout(() => {
      // Add a log entry showing the action was performed
      const newLog = {
        time: new Date().toISOString(),
        level: "info",
        message: `Admin action performed: ${action}`
      };
      
      setLogs(logs => [newLog, ...logs]);
      setIsLoading(prev => ({ ...prev, [loadingKey]: false }));
    }, 1500);
  };
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 border-l-4 border-main pl-3">
        Network Monitor
        <span className="ml-2 inline-block px-2 py-1 text-xs font-bold rounded bg-red-600 text-white">
          Admin Only
        </span>
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
          <Card title="Node Status">
            <div className="space-y-6">
              {Object.entries(nodes).map(([chainName, chainData]) => (
                <div key={chainName} className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-bold mb-3 text-lg">
                    {chainName === 'distributor-chain' ? 'Distributor Chain' : 
                     chainName === 'retailer-chain' ? 'Retailer Chain' : 'Main Chain'}
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4 mb-3 p-2 bg-white rounded border border-gray-200">
                    <div>
                      <div className="font-medium text-gray-600 text-sm">Main Node</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <StatusIndicator status={chainData.mainNode.status === "online"} />
                        <span>{chainData.mainNode.status}</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-600 text-sm">Blocks</div>
                      <div>{chainData.mainNode.blocks}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-600 text-sm">Peers</div>
                      <div>{chainData.mainNode.peers}</div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-1">Secondary Nodes</div>
                  <div className="space-y-2">
                    {chainData.secondaryNodes.map(node => (
                      <div key={node.id} className="grid grid-cols-3 gap-4 p-2 bg-white rounded border border-gray-200">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <StatusIndicator status={node.status === "online"} />
                            <span className="font-mono text-xs">{node.address}</span>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-600 text-xs">Blocks</div>
                          <div>{node.blocks}</div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-600 text-xs">Status</div>
                          <div>{node.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
          <Card title="Admin Actions">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button 
                className="btn bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => handleAdminAction('setupStreams')}
                disabled={isLoading.setupStreams}
              >
                {isLoading.setupStreams ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                ) : (
                  <FaDatabase className="mr-1" />
                )}
                Setup Required Streams
              </button>
              
              <button 
                className="btn bg-green-600 text-white hover:bg-green-700"
                onClick={() => handleAdminAction('forceBlocks')}
                disabled={isLoading.forceBlocks}
              >
                {isLoading.forceBlocks ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                ) : (
                  <FaBox className="mr-1" />
                )}
                Force Mine Blocks
              </button>
              
              <button 
                className="btn bg-purple-600 text-white hover:bg-purple-700"
                onClick={() => handleAdminAction('syncRoots')}
                disabled={isLoading.syncRoots}
              >
                {isLoading.syncRoots ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                ) : (
                  <FaSync className="mr-1" />
                )}
                Sync Merkle Roots
              </button>
              
              <button 
                className="btn bg-red-600 text-white hover:bg-red-700"
                onClick={() => handleAdminAction('checkPeers')}
                disabled={isLoading.checkPeers}
              >
                {isLoading.checkPeers ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                ) : (
                  <FaCheckSquare className="mr-1" />
                )}
                Check Peer Connections
              </button>
            </div>
            
            <div className="p-3 bg-blue-50 text-blue-800 rounded">
              <div className="flex items-center gap-1 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Admin actions affect the underlying blockchain network configurations.</span>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="lg:col-span-6">
          <Card title="Block Explorer">
            <BlockExplorer />
          </Card>
          
          <Card title="System Logs">
            <div className="max-h-80 overflow-y-auto font-mono text-sm bg-gray-900 text-gray-200 p-3 rounded">
              {logs.map((log, index) => {
                const time = new Date(log.time).toLocaleTimeString();
                const levelClass = 
                  log.level === "info" ? "text-blue-400" :
                  log.level === "warning" ? "text-yellow-400" :
                  "text-red-400";
                
                return (
                  <div key={index} className="mb-1">
                    <span className="text-gray-500">[{time}]</span>
                    <span className={`ml-1 ${levelClass}`}>[{log.level.toUpperCase()}]</span>
                    <span className="ml-1">{log.message}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NetworkMonitor;
