import axios from 'axios';
import fs from 'fs/promises';
import crypto from 'crypto';

// Configuration
const BASE_URL = 'http://localhost:3000';
const LOG_FILE = './merkle-verification-fix.log';

// Helper for logging
const log = async (message, isError = false) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${isError ? '❌ ERROR: ' : '✅ '} ${message}`;
  console.log(logMessage);
  await fs.appendFile(LOG_FILE, logMessage + '\n');
};

// Helper for API requests with logging
const apiRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
      method,
      url,
      headers,
      ...(data && { data })
    };
    
    await log(`API ${method.toUpperCase()}: ${endpoint}`);
    const response = await axios(config);
    await log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    await log(`Failed API ${method.toUpperCase()}: ${endpoint} - ${errorMessage}`, true);
    throw error;
  }
};

// Helper function to hash data in the same way as the server
const hashData = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

// Helper function to manually create a Merkle tree for verification
const generateMerkleTree = (items) => {
  // Convert items to leaf nodes
  const leaves = items.map(item => hashData(item));
  
  // If there's only one leaf, it's also the root
  if (leaves.length === 1) {
    return { root: leaves[0], levels: [leaves] };
  }
  
  // Build the tree levels
  const levels = [leaves];
  let currentLevel = leaves;
  
  // Continue until we reach the root
  while (currentLevel.length > 1) {
    const nextLevel = [];
    
    // Process pairs of nodes
    for (let i = 0; i < currentLevel.length; i += 2) {
      // If there's an odd number of nodes, duplicate the last one
      const rightNode = i + 1 < currentLevel.length ? currentLevel[i + 1] : currentLevel[i];
      
      // Hash the pair
      const combinedHash = hashData(currentLevel[i] + rightNode);
      nextLevel.push(combinedHash);
    }
    
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }
  
  return { root: currentLevel[0], levels };
};

// Main test function
const runFixedMerkleTest = async () => {
  try {
    // Initialize log file
    await fs.writeFile(LOG_FILE, `=== FIXED MERKLE VERIFICATION TEST (${new Date().toISOString()}) ===\n\n`);
    await log('Starting Merkle verification test with diagnosis for root mismatch...');
    
    // Step 1: Register manufacturer
    await log('STEP 1: REGISTERING TEST MANUFACTURER');
    
    const manufacturerData = await apiRequest('post', '/api/register/manufacturer', {
      name: 'Merkle Fix Test Inc.',
      contactInfo: {
        email: 'merklefix@example.com',
        phone: '555-333-4444'
      },
      location: 'Test Location'
    });
    
    const manufacturerId = manufacturerData.entity.id;
    const manufacturerApiKey = manufacturerData.entity.apiKey;
    await log(`Registered manufacturer with ID ${manufacturerId}`);
    
    // Step 2: Register product with specific quantity
    await log('\nSTEP 2: REGISTERING TEST PRODUCT');
    
    const productResponse = await apiRequest('post', '/api/products/register', 
      {
        name: 'Merkle Fix Test Product',
        description: 'Product for testing Merkle verification fixes',
        category: 'Test',
        specifications: { feature: 'merkle-test' },
        quantity: 5 // Small batch for easier diagnosis
      }, 
      { 'x-api-key': manufacturerApiKey }
    );
    
    const productId = productResponse.productId;
    const registeredMerkleRoot = productResponse.merkleRoot;
    
    await log(`Registered product with ID ${productId}`);
    await log(`Product registered with Merkle root: ${registeredMerkleRoot}`);
    
    // Step 3: Retrieve serial numbers
    await log('\nSTEP 3: RETRIEVING SERIAL NUMBERS');
    
    let serialsResponse;
    try {
      serialsResponse = await apiRequest('get', `/api/products/${productId}/serial-numbers`, 
        null, 
        { 'x-api-key': manufacturerApiKey }
      );
      
      if (!serialsResponse.success || !serialsResponse.serialNumbers || serialsResponse.serialNumbers.length === 0) {
        await log('No serial numbers found. Trying alternate endpoint...', true);
        throw new Error('No serial numbers found');
      }
    } catch (error) {
      try {
        serialsResponse = await apiRequest('get', `/api/manufacturer/products/${productId}/serials`,
          null,
          { 'x-api-key': manufacturerApiKey }
        );
      } catch (altError) {
        await log('Failed to retrieve serial numbers through both endpoints', true);
        return;
      }
    }
    
    const serialNumbers = serialsResponse.serialNumbers;
    await log(`Retrieved ${serialNumbers.length} serial numbers`);
    
    // Step 4: Diagnostic check - Manually generate Merkle tree from serials
    await log('\nSTEP 4: DIAGNOSTIC - MANUALLY RECREATING MERKLE TREE');
    
    // Create items in the same format as the server would
    const serialItems = serialNumbers.map((serial, index) => ({
      serialNumber: serial,
      productId,
      index
    }));
    
    const manualMerkleTree = generateMerkleTree(serialItems);
    await log(`Manually calculated Merkle root: ${manualMerkleTree.root}`);
    await log(`Original registered Merkle root: ${registeredMerkleRoot}`);
    await log(`Manual root matches registered root: ${manualMerkleTree.root === registeredMerkleRoot}`);
    
    // Step 5: Test verification with the API
    await log('\nSTEP 5: VERIFYING MERKLE PROOFS WITH API');
    
    let successCount = 0;
    let rootMatchCount = 0;
    
    for (const serialNumber of serialNumbers) {
      const merkleProofResponse = await apiRequest('get', `/api/verify/product/${serialNumber}/merkle-proof`);
      
      if (merkleProofResponse.success && merkleProofResponse.verified) {
        successCount++;
        await log(`Serial ${serialNumber} verification: ${merkleProofResponse.verified ? 'SUCCESS' : 'FAILED'}`);
        await log(`API calculated root: ${merkleProofResponse.merkleRoot}`);
        await log(`API registered root: ${merkleProofResponse.registeredRoot}`);
        await log(`API roots match: ${merkleProofResponse.rootsMatch}`);
        
        // Compare with our manual calculation
        await log(`Our manual root matches API calculated: ${merkleProofResponse.merkleRoot === manualMerkleTree.root}`);
        
        if (merkleProofResponse.rootsMatch) {
          rootMatchCount++;
        }
        
        await log('------------------------------');
      } else {
        await log(`Serial ${serialNumber} failed verification`, true);
      }
    }
    
    // Step 6: Check product data directly from blockchain
    await log('\nSTEP 6: DIRECTLY CHECKING PRODUCT DATA IN BLOCKCHAIN');
    
    try {
      // We'll need to create a direct API endpoint for this diagnostic check
      const productCheckResponse = await apiRequest('get', `/api/system/diagnostic/product/${productId}`);
      
      if (productCheckResponse.success) {
        await log(`Product blockchain data: ${JSON.stringify(productCheckResponse.productData, null, 2)}`);
        await log(`Stored Merkle root in product data: ${productCheckResponse.productData.serialNumbersMerkleRoot || 'NOT FOUND'}`);
        
        if (productCheckResponse.productData.serialNumbersMerkleRoot) {
          await log(`Stored root matches manually calculated: ${productCheckResponse.productData.serialNumbersMerkleRoot === manualMerkleTree.root}`);
        }
      }
    } catch (error) {
      await log('Could not directly access product blockchain data. Endpoint may not exist yet.', true);
    }
    
    // Summary
    await log('\nTEST SUMMARY:');
    await log(`Total serial numbers tested: ${serialNumbers.length}`);
    await log(`Successful verifications: ${successCount}`);
    await log(`Merkle root matches in API: ${rootMatchCount}`);
    
    if (manualMerkleTree.root === registeredMerkleRoot) {
      await log('DIAGNOSIS: Manual root calculation matches registered root. Issue is likely in the verification endpoint.');
    } else {
      await log('DIAGNOSIS: Manual root calculation does NOT match registered root. Issue is likely in the original Merkle tree calculation or storage.');
    }
    
    // Conclusion
    await log('\nCONCLUSION:');
    if (manualMerkleTree.root !== registeredMerkleRoot) {
      await log('The root mismatch appears to be due to differences in how the Merkle tree is being generated at registration vs. verification time.');
      await log('RECOMMENDATION: Ensure consistent serialization and hashing of data in both places.');
    } else if (successCount === serialNumbers.length && rootMatchCount === 0) {
      await log('The verification process works but root comparison is failing despite matching roots.');
      await log('RECOMMENDATION: Check string vs binary comparison or formatting differences in the comparison logic.');
    } else {
      await log('Complex issue - see diagnostic data above to compare roots and hashing mechanisms.');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    await log(`Test failed with error: ${error.message}`, true);
  }
};


// Run the test
(async () => {
  await runFixedMerkleTest();
})();