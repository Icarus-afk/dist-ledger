import fs from 'fs';
import fetch from 'node-fetch';

// Configuration
const API_BASE_URL = 'http://localhost:3005'; // Change to your server's port
const LOG_FILE = 'api-test-results.txt';

// Test data
const testData = {
  merkleroot: {
    sourceChain: 'distributor-chain',
    blockHash: '12345abc'
  },
  verify: {
    sourceChain: 'distributor-chain',
    blockHash: '12345abc',
    transactionId: 'tx123',
    proof: [
      { position: 'right', hash: '1234' },
      { position: 'left', hash: '5678' }
    ]
  },
  distributorTransaction: {
    transactionType: 'SHIPMENT',
    productId: 'PROD-123',
    quantity: 10,
    relatedEntity: 'RETAILER',
    additionalData: { notes: 'Express delivery' }
  },
  retailerTransaction: {
    transactionType: 'SALE',
    productId: 'PROD-123',
    quantity: 2,
    customerId: 'CUST-456',
    storeLocation: 'STORE-NYC'
  },
  transferAsset: {
    sourceChain: 'distributor-chain',
    targetChain: 'retailer-chain',
    assetName: 'product-1',
    quantity: 10,
    metadata: { notes: 'Monthly shipment' }
  },
  setupStreams: {},
  batchTransactions: {
    chain: 'distributor-chain',
    transactions: [
      {
        productId: 'PROD-1',
        transactionType: 'RECEIVE',
        quantity: 100
      },
      {
        productId: 'PROD-2',
        transactionType: 'SHIP',
        quantity: 50
      }
    ]
  },
  registerProduct: {
    productId: 'PROD-123',
    name: 'Test Product',
    manufacturer: 'Test Manufacturer',
    manufacturingDate: 1615000000,
    attributes: { color: 'red', weight: '2kg' }
  },
  recordEvent: {
    productId: 'PROD-123',
    eventType: 'SHIPPED',
    location: 'Warehouse A',
    handler: 'John Doe',
    data: { destination: 'Store 42', carrier: 'FastShip' }
  },
  createRule: {
    ruleName: 'Low Stock Alert',
    description: 'Create alert when inventory is low',
    triggerConditions: [
      { field: 'quantity', operator: '<', value: 10 }
    ],
    actions: [
      { type: 'notifyChain', targetChain: 'main-chain', notificationType: 'LOW_STOCK' }
    ],
    enabled: true
  },
  processRules: {
    event: {
      productId: 'PROD-123',
      quantity: 5,
      price: 50
    }
  },
  syncMerkleRoots: {}
};

// Helper to log to console and file
const logResult = (endpoint, method, result) => {
  const timestamp = new Date().toISOString();
  const logEntry = `\n[${timestamp}] ${method} ${endpoint}\n${'-'.repeat(50)}\n${JSON.stringify(result, null, 2)}\n${'-'.repeat(50)}\n`;
  
  console.log(logEntry);
  fs.appendFileSync(LOG_FILE, logEntry);
};

// Helper to call API endpoints
const callEndpoint = async (endpoint, method = 'GET', data = null) => {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const responseData = await response.json();
    
    return {
      status: response.status,
      data: responseData
    };
  } catch (error) {
    return {
      error: true,
      message: error.message,
      stack: error.stack
    };
  }
};

// Test all endpoints
const testAllEndpoints = async () => {
  // Clear previous log file
  fs.writeFileSync(LOG_FILE, '# API Testing Results\n');
  logResult('START', 'INFO', { message: 'Starting API tests' });
  
  // Test GET endpoints
  const getEndpoints = [
    '/api/chain/main-chain/latest-block',
    '/api/product/PROD-123/history',
    '/api/network/health',
    '/api/dashboard/stats',
    '/api/supply-chain/product/PROD-123/history',
    '/api/transfer/TRANSFER-1234567890-1234/status' // Added test for transfer status
  ];
  
  for (const endpoint of getEndpoints) {
    const result = await callEndpoint(endpoint);
    logResult(endpoint, 'GET', result);
  }
  
  // Test POST endpoints
  const postEndpoints = [
    { url: '/api/relay/merkleroot', data: testData.merkleroot },
    { url: '/api/relay/verify', data: testData.verify },
    { url: '/api/distributor/transaction', data: testData.distributorTransaction },
    { url: '/api/retailer/transaction', data: testData.retailerTransaction },
    { url: '/api/batch/transactions', data: testData.batchTransactions },
    { url: '/api/transfer/asset', data: testData.transferAsset },
    { url: '/api/sync/merkle-roots', data: testData.syncMerkleRoots },
    { url: '/api/automation/block-verification', data: { action: 'start', intervalMinutes: 10 } },
    { url: '/api/supply-chain/register-product', data: testData.registerProduct },
    { url: '/api/supply-chain/record-event', data: testData.recordEvent },
    { url: '/api/rules/create', data: testData.createRule },
    { url: '/api/rules/process', data: testData.processRules },
    { url: '/api/admin/setup-streams', data: testData.setupStreams }
  ];
  
  for (const { url, data } of postEndpoints) {
    const result = await callEndpoint(url, 'POST', data);
    logResult(url, 'POST', result);
  }
  
  logResult('END', 'INFO', { message: 'API tests completed' });
};

// Run the tests
testAllEndpoints()
  .then(() => console.log(`\nTests completed! Results saved to ${LOG_FILE}`))
  .catch(error => console.error('Error running tests:', error));