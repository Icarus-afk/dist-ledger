import { useState, useEffect } from 'react';
import { fetchBlockExplorer } from '../../services/networkService';
import LoadingSpinner from '../common/LoadingSpinner';

const BlockExplorer = () => {
  const [chain, setChain] = useState('main-chain');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const loadBlocks = async () => {
    setLoading(true);
    setError('');
    try {
      // Simulated API call
      setTimeout(() => {
        // Mock data
        setBlocks([
          { 
            hash: '000a1c4b2e4e3d5f6...', 
            height: 124, 
            timestamp: '2023-11-01T14:32:00Z',
            txCount: 5,
            miner: 'Node1',
            size: '2.3 KB'
          },
          { 
            hash: '000b2d5c3f4e5g6h7...', 
            height: 123, 
            timestamp: '2023-11-01T14:31:00Z',
            txCount: 3,
            miner: 'Node2',
            size: '1.8 KB'
          },
          { 
            hash: '000c3e6d4f5g6h7i8...', 
            height: 122, 
            timestamp: '2023-11-01T14:30:00Z',
            txCount: 7,
            miner: 'Node1', 
            size: '3.1 KB'
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      setError(`Failed to load blocks: ${error.message}`);
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadBlocks();
  }, [chain]);
  
  const handleChainChange = (e) => {
    setChain(e.target.value);
  };
  
  const handleRefresh = () => {
    loadBlocks();
  };
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return (
      <div className="text-center text-red-600 p-4 bg-red-50 rounded">
        {error}
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-4">
        <div className="flex gap-2">
          <select
            className="form-input"
            value={chain}
            onChange={handleChainChange}
          >
            <option value="main-chain">Main Chain</option>
            <option value="distributor-chain">Distributor Chain</option>
            <option value="retailer-chain">Retailer Chain</option>
          </select>
          <button 
            className="btn bg-gray-200 hover:bg-gray-300 text-gray-800"
            onClick={handleRefresh}
          >
            ↻
          </button>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-3 overflow-auto">
        {blocks.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No blocks found
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block, index) => (
              <div 
                key={index}
                className="bg-white border border-gray-200 rounded p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-center">
                  <div className="font-mono text-sm truncate max-w-[200px]">
                    {block.hash}
                  </div>
                  <div className="text-sm">
                    <span className="bg-gray-200 rounded px-2 py-1">
                      #{block.height}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-600">
                  <div>
                    <div className="font-medium">Time</div>
                    <div>{new Date(block.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <div>
                    <div className="font-medium">Transactions</div>
                    <div>{block.txCount}</div>
                  </div>
                  <div>
                    <div className="font-medium">Size</div>
                    <div>{block.size}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockExplorer;
