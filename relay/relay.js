/**
 * TechChain Supply Network Relay Service
 * 
 * This relay connects the main chain, distributor chain, and retailer chain,
 * providing cross-chain communication and API endpoints for the supply chain network.
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { fileURLToPath } from 'url';



const exec = promisify(execCallback);

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENTITY_STORAGE_PATH = path.join(__dirname, '../data/entities.json');
const dataDir = path.join(__dirname, '..', 'data');

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());  // Use bodyParser as an object
app.use(bodyParser.urlencoded({ extended: true }));


// Configuration for chain connections
const config = {
  chains: {
    'main-chain': {
      rpcPort: 7744,
      networkPort: 7745,
      dataDir: path.join(__dirname, '../data/main-chain')
    },
    'distributor-chain': {
      rpcPort: 7740,
      networkPort: 7741,
      dataDir: path.join(__dirname, '../data/distributor-chain')
    },
    'retailer-chain': {
      rpcPort: 7742,
      networkPort: 7743,
      dataDir: path.join(__dirname, '../data/retailer-chain')
    }
  },
  rpcUser: 'multichainrpc',
  rpcPassword: '23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7',
  apiPort: 3000,
  // Storage for entity data (in a real system would be a database)
  entityStore: {
    manufacturers: {},
    distributors: {},
    retailers: {}
  },
  systemSecret: process.env.SYSTEM_SECRET || 'cFpdAhr3LYa2vrAG'
}

const saveEntitiesToDisk = async () => {
  try {
    // Make sure the data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Convert entities to a string before writing
    const entitiesJson = JSON.stringify(config.entityStore, null, 2);

    // Use fs.promises for ES modules compatibility
    await fs.promises.writeFile(
      ENTITY_STORAGE_PATH,
      entitiesJson,
      'utf8'
    );

    console.log('Entities saved to disk successfully');
    return true;
  } catch (error) {
    console.error('Error saving entities to disk:', error);
    return false;
  }
};

const loadEntitiesFromDisk = async () => {
  try {
    // Check if file exists
    try {
      await fs.promises.access(ENTITY_STORAGE_PATH);
    } catch (e) {
      console.log('No existing entities file found, using default empty config');
      return false;
    }

    // Read and parse the file
    const data = await fs.promises.readFile(ENTITY_STORAGE_PATH, 'utf8');
    const entities = JSON.parse(data);

    // Update the config
    config.entityStore = entities;
    console.log('Entities loaded from disk successfully');
    return true;
  } catch (error) {
    console.error('Failed to load entities from disk:', error);
    return false;
  }
};


// Helper function to execute MultiChain commands via CLI
const executeCommand = async (chain, command) => {
  try {
    const { stdout, stderr } = await exec(
      `multichain-cli -datadir=${config.chains[chain].dataDir} -rpcuser=${config.rpcUser} -rpcpassword=${config.rpcPassword} ${chain} ${command}`
    );

    if (stderr && !stderr.includes('Rescanning')) {
      console.warn(`Warning executing command on ${chain}: ${stderr}`);
    }

    return stdout.trim();
  } catch (error) {
    console.error(`Error executing command on ${chain}: ${error.message}`);
    throw error;
  }
};

// Helper function for HTTP-based RPC calls (alternative to CLI)
const rpcCall = async (chain, method, params = []) => {
  const url = `http://localhost:${config.chains[chain].rpcPort}`;

  try {
    const response = await axios.post(url, {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    }, {
      auth: {
        username: config.rpcUser,
        password: config.rpcPassword
      }
    });

    if (response.data.error) {
      throw new Error(`RPC Error: ${JSON.stringify(response.data.error)}`);
    }

    return response.data.result;
  } catch (error) {
    console.error(`RPC call failed for ${chain}.${method}: ${error.message}`);
    throw error;
  }
};

// Update the verifyStreams function to include all required streams
const verifyStreams = async (chainName, requiredStreams) => {
  try {
    const streamsData = await executeCommand(chainName, 'liststreams');
    const streams = JSON.parse(streamsData);

    // Check each required stream
    for (const streamName of requiredStreams) {
      const streamExists = streams.some(s => s.name === streamName);

      if (!streamExists) {
        console.warn(`Stream '${streamName}' does not exist on ${chainName}`);

        // Try to create the stream if it doesn't exist
        try {
          await executeCommand(
            chainName,
            `create stream ${streamName} '{"restrict":"write"}' || true`
          );
          console.log(`Created stream '${streamName}' on ${chainName}`);

          // Subscribe to the stream
          await executeCommand(chainName, `subscribe ${streamName}`);
          console.log(`Subscribed to stream '${streamName}' on ${chainName}`);
        } catch (error) {
          console.error(`Failed to create stream '${streamName}': ${error.message}`);
        }
      } else {
        console.log(`✓ Stream '${streamName}' exists on ${chainName}`);
      }
    }
  } catch (error) {
    console.error(`Failed to verify streams on ${chainName}: ${error.message}`);
    throw error;
  }
};

// Update the initializeChains function to include the missing streams
const initializeChains = async () => {
  console.log('Initializing connections to blockchain networks...');

  const results = {};

  for (const [chainName, chainConfig] of Object.entries(config.chains)) {
    try {
      // Check if chain is accessible
      const info = await executeCommand(chainName, 'getinfo');
      console.log(`✓ Connected to ${chainName}`);

      // Parse chain info
      const infoObj = JSON.parse(info);
      results[chainName] = {
        connected: true,
        blocks: infoObj.blocks,
        version: infoObj.version
      };

      // Verify streams exist
      if (chainName === 'main-chain') {
        await verifyStreams(chainName, [
          'sidechain_merkle_roots',
          'cross_chain_verifications',
          'transaction_requests',
          'transaction_proofs',
          'products',                // Add this missing stream
          'product_serial_numbers'   // Add this missing stream
        ]);
      } else if (chainName === 'distributor-chain') {
        await verifyStreams(chainName, [
          'distributor_transactions',
          'merkle_roots',
          'transaction_proofs'
        ]);
      } else if (chainName === 'retailer-chain') {
        await verifyStreams(chainName, [
          'retailer_transactions',
          'merkle_roots',
          'transaction_proofs'
        ]);
      }

    } catch (error) {
      console.error(`Failed to connect to ${chainName}: ${error.message}`);
      results[chainName] = {
        connected: false,
        error: error.message
      };
    }
  }

  return results;
};

// Update the safeStreamName function to be more strict
const safeStreamName = (name) => {
  // First make the name lowercase
  let safeName = name.toLowerCase();

  // Remove any timestamp component if it exists
  safeName = safeName.replace(/\d{13}-/, '');

  // Keep only alphanumeric, underscore, and hyphen characters
  safeName = safeName.replace(/[^a-z0-9_-]/g, '_');

  // Ensure name is not too long (MultiChain has limits)
  if (safeName.length > 32) {
    safeName = safeName.substring(0, 32);
  }

  return safeName;
};

const startup = async () => {
  try {
    console.log('Starting relay service...');

    // Ensure data directory exists
    try {
      await fs.promises.mkdir(dataDir, { recursive: true });
      console.log(`Ensured data directory exists: ${dataDir}`);
    } catch (dirError) {
      console.error('Error creating data directory:', dirError);
    }

    // Load entities from disk first - make sure this completes before proceeding
    const entitiesLoaded = await loadEntitiesFromDisk();
    console.log(`Entities loaded from disk: ${entitiesLoaded ? 'success' : 'failed or no data'}`);

    // Print loaded entity stats
    const mfgCount = Object.keys(config.entityStore.manufacturers || {}).length;
    const distCount = Object.keys(config.entityStore.distributors || {}).length;
    const retailCount = Object.keys(config.entityStore.retailers || {}).length;
    console.log(`Loaded ${mfgCount} manufacturers, ${distCount} distributors, ${retailCount} retailers`);

    // Initialize connections to chains
    const chainStatus = await initializeChains();

    // Check if all chains are connected
    const allConnected = Object.values(chainStatus).every(status => status.connected);
    if (!allConnected) {
      console.error('Not all blockchain networks are accessible. Check connections and try again.');
    }

    console.log('Relay service initialized successfully');
    console.log('Chain status:', JSON.stringify(chainStatus, null, 2));
    return chainStatus;
  } catch (error) {
    console.error('Failed to initialize relay service:', error);
    throw error;
  }
};

// Basic health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const chainStatus = await Promise.all(
      Object.keys(config.chains).map(async (chain) => {
        try {
          const info = await executeCommand(chain, 'getinfo');
          const infoObj = JSON.parse(info);

          return {
            chain,
            connected: true,
            blocks: infoObj.blocks,
            version: infoObj.version
          };
        } catch (error) {
          return {
            chain,
            connected: false,
            error: error.message
          };
        }
      })
    );

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      chains: chainStatus
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Start the API server
app.listen(config.apiPort, () => {
  console.log(`Relay API server running on port ${config.apiPort}`);

  // Initialize everything
  startup().catch(error => {
    console.error('Startup failed:', error);
  });
});




// ===== Merkle Tree Functions =====

/**
 * Generates a Merkle tree from an array of transactions or data items
 * @param {Array} items - Array of items to include in the Merkle tree
 * @returns {Object} - Merkle tree object with root and levels
 */
const generateMerkleTree = (items) => {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Cannot generate Merkle tree from empty or non-array input');
    }

    // Hash each item using the consistent hashData function
    const leaves = items.map(item => {
      if (typeof item === 'string' && item.match(/^[0-9a-f]{64}$/i)) {
        // Item is already a hash
        return item;
      } else {
        // Use the updated hashData function
        return hashData(item);
      }
    });

    // If only one leaf, return it as the root
    if (leaves.length === 1) {
      return {
        root: leaves[0],
        levels: [leaves]
      };
    }

    // Build the tree
    const tree = buildMerkleTreeLevels(leaves);
    return tree;
  } catch (error) {
    console.error('Error generating Merkle tree:', error);
    throw error;
  }
};

/**
 * Builds the levels of a Merkle tree from leaf nodes
 * @param {Array<string>} leaves - Array of leaf node hashes
 * @returns {Object} - Merkle tree with levels and root
 */
const buildMerkleTreeLevels = (leaves) => {
  // Make a copy of leaves to avoid modifying the original array
  let currentLevel = [...leaves];
  const levels = [currentLevel];

  // Continue building levels until we reach the root
  while (currentLevel.length > 1) {
    const nextLevel = [];

    // Process pairs of nodes
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Concat the pair and hash them
        const left = currentLevel[i];
        const right = currentLevel[i + 1];
        const combined = left + right;
        const hash = crypto.createHash('sha256').update(combined).digest('hex');
        nextLevel.push(hash);
      } else {
        // Odd number of nodes, promote the last one
        nextLevel.push(currentLevel[i]);
      }
    }

    levels.unshift(nextLevel);
    currentLevel = nextLevel;
  }

  return {
    root: levels[0][0],
    levels: levels
  };
};

/**
 * Extracts the Merkle root from a tree
 * @param {Object} treeData - Merkle tree data 
 * @returns {string} - The Merkle root hash
 */
const getMerkleRoot = (treeData) => {
  if (!treeData || !treeData.root) {
    throw new Error('Invalid Merkle tree data');
  }
  return treeData.root;
};

/**
 * Generates a Merkle proof for a specific item in the tree
 * @param {Object} tree - Merkle tree object
 * @param {number} index - Index of the item in the original array
 * @returns {Object} - Proof object with siblings and path
 */
const generateMerkleProof = (tree, index) => {
  if (!tree || !tree.levels || tree.levels.length === 0) {
    throw new Error('Invalid Merkle tree');
  }

  if (typeof index !== 'number' || index < 0 || index >= tree.levels[tree.levels.length - 1].length) {
    throw new Error(`Invalid index: ${index}`);
  }

  const proof = {
    root: tree.root,
    leaf: tree.levels[tree.levels.length - 1][index],
    siblings: [],
    path: []
  };

  // Start from the bottom level (leaves)
  let currentIndex = index;

  // Iterate through levels from bottom to top (excluding root)
  for (let i = tree.levels.length - 1; i > 0; i--) {
    const level = tree.levels[i];
    const isLeftNode = currentIndex % 2 === 0;
    const siblingIndex = isLeftNode ? currentIndex + 1 : currentIndex - 1;

    // Check if sibling exists
    if (siblingIndex < level.length) {
      proof.siblings.push(level[siblingIndex]);
      proof.path.push(isLeftNode ? 'right' : 'left');
    }

    // Move up to the parent's index
    currentIndex = Math.floor(currentIndex / 2);
  }

  return proof;
};

/**
 * Verifies a Merkle proof against a root
 * @param {string} root - The Merkle root
 * @param {Object} proof - The proof object
 * @param {string|Object} item - The item to verify
 * @returns {boolean} - True if the proof is valid
 */
const verifyMerkleProof = (root, proof, item) => {
  try {
    if (!proof || !proof.siblings || !Array.isArray(proof.siblings)) {
      throw new Error('Invalid proof structure');
    }

    // Convert item to hash if it's not already a hash
    let itemHash;
    if (typeof item === 'string' && item.match(/^[0-9a-f]{64}$/i)) {
      // Item is already a hash
      itemHash = item;
    } else {
      // Ensure consistent serialization by sorting object keys before hashing
      const itemString = typeof item === 'object' ?
        JSON.stringify(item, Object.keys(item).sort()) : String(item);
      itemHash = crypto.createHash('sha256').update(itemString).digest('hex');
    }

    // If leaf is specified in the proof, make sure it matches
    if (proof.leaf && proof.leaf !== itemHash) {
      return false;
    }

    let currentHash = itemHash;

    // Traverse up the tree using siblings
    for (let i = 0; i < proof.siblings.length; i++) {
      const sibling = proof.siblings[i];
      const direction = proof.path && proof.path[i] ? proof.path[i] : (i % 2 === 0 ? 'right' : 'left');

      // Combine hashes based on the path
      const combined = direction === 'left'
        ? sibling + currentHash  // sibling is left, current is right
        : currentHash + sibling; // current is left, sibling is right

      currentHash = crypto.createHash('sha256').update(combined).digest('hex');
    }

    // The final hash should match the root
    return currentHash === root;
  } catch (error) {
    console.error('Error verifying Merkle proof:', error);
    return false;
  }
};

/**
 * Verifies an item's inclusion in a Merkle tree
 * @param {Object} tree - Merkle tree object
 * @param {string|Object} item - Item to verify
 * @returns {boolean} - True if the item is in the tree
 */
const verifyItemInMerkleTree = (tree, item) => {
  try {
    // Convert item to hash if it's not already a hash
    let itemHash;
    if (typeof item === 'string' && item.match(/^[0-9a-f]{64}$/i)) {
      // Item is already a hash
      itemHash = item;
    } else {
      // Convert item to string and hash it
      const itemString = typeof item === 'object' ? JSON.stringify(item) : String(item);
      itemHash = crypto.createHash('sha256').update(itemString).digest('hex');
    }

    // Check if the hash exists in the leaves
    const leaves = tree.levels[tree.levels.length - 1];
    const index = leaves.findIndex(leaf => leaf === itemHash);

    if (index === -1) {
      return false;
    }

    // Generate and verify the proof
    const proof = generateMerkleProof(tree, index);
    return verifyMerkleProof(tree.root, proof, itemHash);
  } catch (error) {
    console.error('Error verifying item in Merkle tree:', error);
    return false;
  }
};


const hashData = (data) => {
  // For objects, sort the keys to ensure consistent serialization
  if (typeof data === 'object' && data !== null) {
    return crypto.createHash('sha256')
      .update(JSON.stringify(data, Object.keys(data).sort()))
      .digest('hex');
  }
  // For other types, use standard JSON.stringify
  return crypto.createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
};
// After the existing Merkle Tree functions

// ===== Entity Management and Authentication =====

/**
 * Middleware for authenticating API requests
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateRequest = async (req, res, next) => {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: No API key provided'
      });
    }

    // In a real system, this would query a database
    // For this demo, we'll use our in-memory store
    let entity = null;
    let entityType = null;

    // Check each entity store for the API key
    for (const [type, entities] of Object.entries(config.entityStore)) {
      for (const [id, entityData] of Object.entries(entities)) {
        if (entityData.apiKey === apiKey) {
          entity = entityData;
          entity.id = id;
          entityType = type.slice(0, -1); // Remove trailing 's' (e.g., manufacturers -> manufacturer)
          break;
        }
      }
      if (entity) break;
    }

    if (!entity) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: Invalid API key'
      });
    }

    // Attach entity and type to request object for later use
    req.entity = entity;
    req.entityType = entityType;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * Register a new entity in the system
 * @param {string} entityType - Type of entity (manufacturer, distributor, retailer)
 * @param {Object} details - Entity details
 * @returns {Object} - Registered entity information
 */
const registerEntity = async (entityType, details) => {
  try {
    if (!['manufacturer', 'distributor', 'retailer'].includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }

    if (!details.name || !details.contactInfo) {
      throw new Error('Entity must have a name and contact information');
    }

    // Generate unique ID
    const id = `${entityType}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Generate API key
    const apiKey = crypto.randomBytes(16).toString('hex');

    // Create entity object with base properties first
    const entityObject = {
      ...details,
      apiKey,
      createdAt: Date.now(),
      streams: {} // Initialize streams object
    };

    // Store entity data
    const pluralType = `${entityType}s`;
    config.entityStore[pluralType][id] = entityObject;

    // For distributors and retailers, create entity-specific streams on their respective chains
    if (entityType === 'distributor') {
      // Generate a simple hex code for the entity that's only alphanumeric
      const entityCode = crypto.randomBytes(2).toString('hex');

      // Create streams sequentially
      try {
        console.log(`Creating streams for ${entityType} ${id}`);

        // Create inventory stream
        const inventoryStream = `d${entityCode}inventory`;
        await executeCommand('distributor-chain', `create stream ${inventoryStream} '{"restrict":"write"}' || true`);
        await executeCommand('distributor-chain', `subscribe ${inventoryStream}`);

        // Store stream name with entity for later use
        console.log(`Created inventory stream: ${inventoryStream}`);
        entityObject.streams.inventory = inventoryStream;

        // Create transfers_in stream
        const transfersInStream = `d${entityCode}in`;
        await executeCommand('distributor-chain', `create stream ${transfersInStream} '{"restrict":"write"}' || true`);
        await executeCommand('distributor-chain', `subscribe ${transfersInStream}`);

        // Store stream name with entity
        console.log(`Created transfers_in stream: ${transfersInStream}`);
        entityObject.streams.transfersIn = transfersInStream;

        // Create transfers_out stream
        const transfersOutStream = `d${entityCode}out`;
        await executeCommand('distributor-chain', `create stream ${transfersOutStream} '{"restrict":"write"}' || true`);
        await executeCommand('distributor-chain', `subscribe ${transfersOutStream}`);

        // Store stream name with entity
        console.log(`Created transfers_out stream: ${transfersOutStream}`);
        entityObject.streams.transfersOut = transfersOutStream;

        // Update entity in store
        config.entityStore[pluralType][id] = entityObject;
        console.log(`Final entity configuration:`, JSON.stringify(entityObject.streams, null, 2));
      } catch (streamError) {
        console.error(`Error creating streams for ${entityType} ${id}:`, streamError);
      }
    }
    else if (entityType === 'retailer') {
      // Similar code for retailers...
      // Implementation for retailer streams
    }

    // Save all entities to disk - now that all streams are created and stored
    await saveEntitiesToDisk();

    console.log(`Entity registration complete for ${entityType} ${id}`);

    return {
      id,
      apiKey,
      entityType,
      name: details.name
    };
  } catch (error) {
    console.error('Failed to register entity:', error);
    throw error;
  }
};

// ===== Helper Functions =====

/**
 * Generate unique serial numbers for products
 * @param {string} productId - Product ID
 * @param {number} quantity - Number of serial numbers to generate
 * @returns {Array<string>} - Array of serial numbers
 */
const generateSerialNumbers = (productId, quantity) => {
  const serialNumbers = [];
  const prefix = productId.substring(0, 4).toUpperCase();

  for (let i = 0; i < quantity; i++) {
    const randomPart = crypto.randomBytes(6).toString('hex');
    const serialNumber = `${prefix}-${randomPart}-${(i + 1).toString().padStart(5, '0')}`;
    serialNumbers.push(serialNumber);
  }

  return serialNumbers;
};

/**
 * Validate serial numbers format and uniqueness
 * @param {Array<string>} serialNumbers - Array of serial numbers to validate
 * @returns {boolean} - True if all serial numbers are valid
 */
const validateSerialNumbers = (serialNumbers) => {
  if (!Array.isArray(serialNumbers)) {
    return false;
  }

  // Check for duplicates
  const uniqueSerials = new Set(serialNumbers);
  if (uniqueSerials.size !== serialNumbers.length) {
    return false;
  }

  // Check format (basic validation)
  const validFormat = serialNumbers.every(serial =>
    typeof serial === 'string' &&
    serial.length >= 10
  );

  return validFormat;
};

// Add these functions after your existing helper functions

/**
 * Encrypts sensitive data using entity-specific keys
 * @param {Object} data - Data to encrypt
 * @param {string} entityId - Entity ID for key derivation
 * @returns {Object} - Encrypted data and metadata
 */
const encryptSensitiveData = (data, entityId) => {
  try {
    if (!data || !entityId) {
      throw new Error('Data and entity ID are required for encryption');
    }

    // In production, use a proper key management system
    // This is a simplified example using entity ID as encryption seed
    const entityKey = crypto.createHash('sha256').update(entityId + config.systemSecret).digest('hex');

    // Generate a random IV for CBC mode
    const iv = crypto.randomBytes(16);

    // Create a cipher using AES-256-CBC
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(entityKey.slice(0, 32)), iv);

    // Convert the data to string
    const jsonData = JSON.stringify(data);

    // Encrypt the data
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      entityId,
      timestamp: Date.now(),
      version: '1.0',
      algorithm: 'aes-256-cbc'
    };
  } catch (error) {
    console.error('Failed to encrypt sensitive data:', error);
    throw error;
  }
};

/**
 * Decrypts sensitive data using entity-specific keys
 * @param {Object} encryptedPackage - Encrypted data package
 * @param {string} entityId - Entity ID for key derivation
 * @returns {Object} - Decrypted data
 */
const decryptSensitiveData = (encryptedPackage, entityId) => {
  try {
    if (!encryptedPackage || !entityId) {
      throw new Error('Encrypted package and entity ID are required for decryption');
    }

    // Verify this is the correct entity
    if (encryptedPackage.entityId !== entityId) {
      throw new Error('This data cannot be decrypted by this entity');
    }

    // Derive key from entity ID (same as in encryption)
    const entityKey = crypto.createHash('sha256').update(entityId + config.systemSecret).digest('hex');

    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(entityKey.slice(0, 32)),
      Buffer.from(encryptedPackage.iv, 'hex')
    );

    // Decrypt the data
    let decrypted = decipher.update(encryptedPackage.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Parse the JSON
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to decrypt sensitive data:', error);
    throw error;
  }
};

/**
 * Creates a hash reference for sensitive data
 * @param {Object} data - Sensitive data
 * @returns {string} - Hash reference
 */
const createDataReference = (data) => {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(dataString).digest('hex');
};


// ===== API Endpoints =====

// ----- Entity Endpoints -----

app.post('/api/register/manufacturer', async (req, res) => {
  try {
    const { name, contactInfo, location } = req.body;

    if (!name || !contactInfo) {
      return res.status(400).json({
        success: false,
        message: 'Name and contact info are required'
      });
    }

    const entity = await registerEntity('manufacturer', {
      name,
      contactInfo,
      location,
      role: 'manufacturer'
    });

    res.status(201).json({
      success: true,
      message: 'Manufacturer registered successfully',
      entity: {
        id: entity.id,
        name,
        apiKey: entity.apiKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to register manufacturer',
      error: error.message
    });
  }
});

app.post('/api/register/distributor', async (req, res) => {
  try {
    const { name, contactInfo, location, warehouseInfo } = req.body;

    if (!name || !contactInfo) {
      return res.status(400).json({
        success: false,
        message: 'Name and contact info are required'
      });
    }

    const entity = await registerEntity('distributor', {
      name,
      contactInfo,
      location,
      warehouseInfo,
      role: 'distributor'
    });

    res.status(201).json({
      success: true,
      message: 'Distributor registered successfully',
      entity: {
        id: entity.id,
        name,
        apiKey: entity.apiKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to register distributor',
      error: error.message
    });
  }
});

app.post('/api/register/retailer', async (req, res) => {
  try {
    const { name, contactInfo, location, storeInfo } = req.body;

    if (!name || !contactInfo) {
      return res.status(400).json({
        success: false,
        message: 'Name and contact info are required'
      });
    }

    const entity = await registerEntity('retailer', {
      name,
      contactInfo,
      location,
      storeInfo,
      role: 'retailer'
    });

    res.status(201).json({
      success: true,
      message: 'Retailer registered successfully',
      entity: {
        id: entity.id,
        name,
        apiKey: entity.apiKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to register retailer',
      error: error.message
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API key is required'
      });
    }

    // Find entity by API key
    let entity = null;
    let entityType = null;
    let entityId = null;

    // Check each entity store for the API key
    for (const [type, entities] of Object.entries(config.entityStore)) {
      for (const [id, entityData] of Object.entries(entities)) {
        if (entityData.apiKey === apiKey) {
          entity = { ...entityData };
          entityId = id;
          entityType = type.slice(0, -1); // Remove trailing 's' (e.g., manufacturers -> manufacturer)
          break;
        }
      }
      if (entity) break;
    }

    if (!entity) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    // Return entity details without sensitive data
    res.json({
      success: true,
      message: 'Login successful',
      entity: {
        id: entityId,
        name: entity.name,
        type: entityType,
        role: entityType,
        apiKey: apiKey,
        location: entity.location || null,
        contactInfo: entity.contactInfo || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

app.get('/api/entities/:type', authenticateRequest, async (req, res) => {
  try {
    const { type } = req.params;

    // Validate type
    const validTypes = ['manufacturer', 'distributor', 'retailer'];
    const pluralType = type + 's';

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be manufacturer, distributor, or retailer'
      });
    }

    // Get entities from the store
    const entities = config.entityStore[pluralType];

    if (!entities) {
      return res.json({
        success: true,
        entities: []
      });
    }

    // Format entity data, removing sensitive information
    const formattedEntities = Object.entries(entities).map(([id, entity]) => ({
      id,
      name: entity.name,
      location: entity.location || null,
      contactInfo: entity.contactInfo || null
    }));

    res.json({
      success: true,
      entities: formattedEntities
    });
  } catch (error) {
    console.error(`Failed to get ${req.params.type} entities:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to get ${req.params.type} entities`,
      error: error.message
    });
  }
});

// ----- Product Registration Endpoints -----

// product registration endpoint with sensitive manufacturing data
app.post('/api/products/register', authenticateRequest, async (req, res) => {
  try {
    const { name, description, category, specifications, quantity, unitPrice, distributorId } = req.body;

    // Validations
    if (!name || !category || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product name, category, and valid quantity are required'
      });
    }

    // Validate distributor ID if provided
    if (distributorId) {
      const distributor = config.entityStore.distributors[distributorId];
      if (!distributor) {
        return res.status(400).json({
          success: false,
          message: 'Invalid distributor ID'
        });
      }
    }

    // Generate product ID
    const productId = `prod-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Generate serial numbers
    const serialNumbers = generateSerialNumbers(productId, quantity);

    // Process sensitive manufacturing data that shouldn't be shared with other entities
    const sensitiveMfgData = {
      productId,
      manufacturingCost: req.body.manufacturingCost || 0,
      supplierInfo: req.body.supplierInfo || {},
      batchQualityMetrics: req.body.batchQualityMetrics || {},
      productionFacility: req.body.productionFacility || 'Unknown',
      internalNotes: req.body.internalNotes || '',
      components: req.body.components || [],
      timestamp: Date.now()
    };

    // Encrypt sensitive data using entity-specific encryption
    const encryptedMfgData = encryptSensitiveData(sensitiveMfgData, req.entity.id);

    // Create reference hash for cross-chain verification
    const sensitiveDataRef = createDataReference(sensitiveMfgData);

    // Store encrypted data in private manufacturer stream
    try {
      // Create a private manufacturer data stream if it doesn't exist
      const privateStreamName = `mfg_private_data`;

      try {
        await executeCommand(
          'main-chain',
          `create stream ${privateStreamName} false`
        );
        console.log('Created manufacturer private data stream');
      } catch (streamError) {
        if (!streamError.message.includes('already exists')) {
          throw streamError;
        }
      }

      // Store encrypted sensitive data on chain
      const encryptedHexData = Buffer.from(JSON.stringify(encryptedMfgData)).toString('hex');

      await executeCommand(
        'main-chain',
        `publish ${privateStreamName} ${productId} ${encryptedHexData}`
      );

      console.log(`Stored sensitive manufacturing data for ${productId}`);
    } catch (error) {
      console.error('Failed to store sensitive manufacturing data:', error);
      // Continue with product registration even if sensitive data storage fails
    }

    // Create a Merkle tree from product data
    const productItems = serialNumbers.map((serial, index) => ({
      serialNumber: serial,
      productId,
      index
    }));

    const merkleTree = generateMerkleTree(productItems);

    // Create public product data without sensitive information
    const productData = {
      productId,
      name,
      description: description || '',
      category,
      specifications: specifications || {},
      quantity,
      unitPrice: unitPrice || 0,
      manufacturerId: req.entity.id,
      manufacturerName: req.entity.name,
      registrationDate: Date.now(),
      serialNumberCount: serialNumbers.length,
      serialNumbersMerkleRoot: merkleTree.root,
      sensitiveDataReference: sensitiveDataRef, // Add reference to sensitive data
      distributorId: distributorId || null // Add distributor ID if provided
    };

    // Record to main chain
    const hexData = Buffer.from(JSON.stringify(productData)).toString('hex');

    const txid = await executeCommand(
      'main-chain',
      `publish products ${productId} ${hexData}`
    );

    // Also record serial numbers to product_serial_numbers stream for lookups
    for (let i = 0; i < serialNumbers.length; i += 100) {
      // Process in batches to avoid command line length limits
      const batch = serialNumbers.slice(i, i + 100);
      const serialData = {
        productId,
        serialBatch: batch,
        batchIndex: Math.floor(i / 100),
        totalBatches: Math.ceil(serialNumbers.length / 100)
      };

      const serialHexData = Buffer.from(JSON.stringify(serialData)).toString('hex');
      await executeCommand(
        'main-chain',
        `publish product_serial_numbers ${productId} ${serialHexData}`
      );
    }

    // If a distributor was specified, create a transfer notification
    if (distributorId) {
      // Create transfer record
      const transferId = `transfer-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      const transferData = {
        id: transferId,
        productId,
        serialNumbers,
        quantity,
        manufacturerId: req.entity.id,
        manufacturerName: req.entity.name,
        distributorId,
        status: 'pending',
        createdAt: Date.now(),
        notes: req.body.notes || ''
      };

      // Convert to hex
      const transferHexData = Buffer.from(JSON.stringify(transferData)).toString('hex');

      // Publish to transfers stream on main chain
      await executeCommand(
        'main-chain',
        `publish transfers ${transferId} ${transferHexData}`
      );

      console.log(`Created transfer notification ${transferId} for distributor ${distributorId}`);
    }

    res.status(201).json({
      success: true,
      message: 'Product registered successfully',
      productId,
      name,
      serialNumberCount: serialNumbers.length,
      merkleRoot: merkleTree.root,
      sensitiveDataStored: true,
      distributorAssigned: distributorId ? true : false,
      txid: txid.trim()
    });
  } catch (error) {
    console.error('Product registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register product',
      error: error.message
    });
  }
});

// Endpoint for manufacturer to retrieve their sensitive data
app.get('/api/manufacturer/sensitive-data/:productId', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a manufacturer
    if (req.entityType !== 'manufacturer') {
      return res.status(403).json({
        success: false,
        message: 'Only manufacturers can access this endpoint'
      });
    }

    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Get product details to verify ownership
    const productData = await executeCommand(
      'main-chain',
      `liststreamkeyitems products ${productId}`
    );

    const products = JSON.parse(productData);

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const productInfo = JSON.parse(Buffer.from(products[0].data, 'hex').toString());

    // Verify that this manufacturer owns the product
    if (productInfo.manufacturerId !== req.entity.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this product data'
      });
    }

    // Get sensitive data from private stream
    const sensitiveDataItems = await executeCommand(
      'main-chain',
      `liststreamkeyitems mfg_private_data ${productId}`
    );

    const sensitiveDataRecords = JSON.parse(sensitiveDataItems);

    if (!sensitiveDataRecords || sensitiveDataRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sensitive data not found for this product'
      });
    }

    // Get most recent sensitive data record
    const latestRecord = sensitiveDataRecords.reduce((latest, current) => {
      return latest.time > current.time ? latest : current;
    }, sensitiveDataRecords[0]);

    const encryptedPackage = JSON.parse(Buffer.from(latestRecord.data, 'hex').toString());

    // Decrypt the data for the manufacturer
    const sensitiveData = decryptSensitiveData(encryptedPackage, req.entity.id);

    res.json({
      success: true,
      productId,
      productName: productInfo.name,
      manufacturingData: sensitiveData
    });
  } catch (error) {
    console.error('Failed to retrieve sensitive manufacturing data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sensitive data',
      error: error.message
    });
  }
});

app.get('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    // Fetch product data from main chain
    const productData = await executeCommand(
      'main-chain',
      `liststreamkeyitems products ${productId}`
    );

    const products = JSON.parse(productData);

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get the most recent version if multiple entries exist
    const latestProduct = products.reduce((latest, current) => {
      return latest.time > current.time ? latest : current;
    }, products[0]);

    // Convert hex data to JSON
    const productInfo = JSON.parse(Buffer.from(latestProduct.data, 'hex').toString());

    res.json({
      success: true,
      product: productInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product',
      error: error.message
    });
  }
});

app.post('/api/products/:productId/merkle', async (req, res) => {
  try {
    const { productId } = req.params;

    // Fetch product data from main chain
    const productData = await executeCommand(
      'main-chain',
      `liststreamkeyitems products ${productId}`
    );

    const products = JSON.parse(productData);

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get the most recent version if multiple entries exist
    const latestProduct = products.reduce((latest, current) => {
      return latest.time > current.time ? latest : current;
    }, products[0]);

    // Convert hex data to JSON
    const productInfo = JSON.parse(Buffer.from(latestProduct.data, 'hex').toString());

    // Fetch serial numbers from the product_serial_numbers stream
    const serialData = await executeCommand(
      'main-chain',
      `liststreamkeyitems product_serial_numbers ${productId}`
    );

    const serialBatches = JSON.parse(serialData);

    // Reconstruct serial numbers from batches
    let serialNumbers = [];
    if (serialBatches && serialBatches.length > 0) {
      serialBatches.forEach(batch => {
        const batchData = JSON.parse(Buffer.from(batch.data, 'hex').toString());
        if (Array.isArray(batchData.serialBatch)) {
          serialNumbers = [...serialNumbers, ...batchData.serialBatch];
        }
      });
    }

    // Create a Merkle tree from serial numbers
    const productItems = serialNumbers.map((serial, index) => ({
      serialNumber: serial,
      productId,
      index
    }));

    const merkleTree = generateMerkleTree(productItems);

    res.json({
      success: true,
      productId,
      name: productInfo.name,
      merkleRoot: merkleTree.root,
      serialNumberCount: serialNumbers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate Merkle tree',
      error: error.message
    });
  }
});

// Endpoint for manufacturers to retrieve serial numbers for their products
app.get('/api/products/:productId/serial-numbers', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a manufacturer
    if (req.entityType !== 'manufacturer') {
      return res.status(403).json({
        success: false,
        message: 'Only manufacturers can access this endpoint'
      });
    }

    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Get product details to verify ownership
    const productData = await executeCommand(
      'main-chain',
      `liststreamkeyitems products ${productId}`
    );

    const products = JSON.parse(productData);

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const productInfo = JSON.parse(Buffer.from(products[0].data, 'hex').toString());

    // Verify that this manufacturer owns the product
    if (productInfo.manufacturerId !== req.entity.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this product data'
      });
    }

    // Fetch serial numbers from the product_serial_numbers stream
    const serialData = await executeCommand(
      'main-chain',
      `liststreamkeyitems product_serial_numbers ${productId}`
    );

    const serialBatches = JSON.parse(serialData);

    if (!serialBatches || serialBatches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No serial numbers found for this product'
      });
    }

    // Reconstruct serial numbers from batches
    let serialNumbers = [];
    serialBatches.forEach(batch => {
      try {
        const batchData = JSON.parse(Buffer.from(batch.data, 'hex').toString());
        if (batchData.serialBatch && Array.isArray(batchData.serialBatch)) {
          serialNumbers = [...serialNumbers, ...batchData.serialBatch];
        }
      } catch (error) {
        console.error('Error parsing serial batch data:', error);
      }
    });

    res.json({
      success: true,
      productId,
      serialNumbers,
      count: serialNumbers.length
    });
  } catch (error) {
    console.error('Failed to retrieve serial numbers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve serial numbers',
      error: error.message
    });
  }
});

// Alternative endpoint for manufacturers to retrieve serial numbers
app.get('/api/manufacturer/products/:productId/serials', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a manufacturer
    if (req.entityType !== 'manufacturer') {
      return res.status(403).json({
        success: false,
        message: 'Only manufacturers can access this endpoint'
      });
    }

    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Get product details to verify ownership
    const productData = await executeCommand(
      'main-chain',
      `liststreamkeyitems products ${productId}`
    );

    const products = JSON.parse(productData);

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const productInfo = JSON.parse(Buffer.from(products[0].data, 'hex').toString());

    // Verify that this manufacturer owns the product
    if (productInfo.manufacturerId !== req.entity.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this product data'
      });
    }

    // Fetch serial numbers from the product_serial_numbers stream
    const serialData = await executeCommand(
      'main-chain',
      `liststreamkeyitems product_serial_numbers ${productId}`
    );

    const serialBatches = JSON.parse(serialData);

    if (!serialBatches || serialBatches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No serial numbers found for this product'
      });
    }

    // Reconstruct serial numbers from batches
    let serialNumbers = [];
    serialBatches.forEach(batch => {
      try {
        const batchData = JSON.parse(Buffer.from(batch.data, 'hex').toString());
        if (batchData.serialBatch && Array.isArray(batchData.serialBatch)) {
          serialNumbers = [...serialNumbers, ...batchData.serialBatch];
        }
      } catch (error) {
        console.error('Error parsing serial batch data:', error);
      }
    });

    // Also provide the Merkle tree information
    const productItems = serialNumbers.map((serial, index) => ({
      serialNumber: serial,
      productId,
      index
    }));

    const merkleTree = generateMerkleTree(productItems);

    res.json({
      success: true,
      productId,
      productName: productInfo.name,
      serialNumbers,
      count: serialNumbers.length,
      merkleRoot: merkleTree.root,
      registeredRoot: productInfo.serialNumbersMerkleRoot || '',
      rootsMatch: merkleTree.root === productInfo.serialNumbersMerkleRoot
    });
  } catch (error) {
    console.error('Failed to retrieve serial numbers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve serial numbers',
      error: error.message
    });
  }
});

// GET /api/manufacturer/transfers - Get all transfers for a manufacturer
app.get('/api/manufacturer/transfers', authenticateRequest, async (req, res) => {
  try {
    // Get the manufacturer ID from the authenticated entity
    const manufacturerId = req.entity.id;

    // Check if user is a manufacturer
    if (req.entityType !== 'manufacturer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only manufacturers can view their transfers.'
      });
    }

    // Fetch transfers from blockchain instead of using undefined transferLedger variable
    const transferData = await executeCommand(
      'main-chain',
      `liststreamitems transfers`
    );

    const transfers = JSON.parse(transferData);

    // Filter only this manufacturer's transfers
    const allTransfers = transfers.filter(transfer => {
      const transferInfo = JSON.parse(Buffer.from(transfer.data, 'hex').toString());
      return transferInfo.manufacturerId === manufacturerId;
    });

    // Format the response
    const formattedTransfers = await Promise.all(allTransfers.map(async (transfer) => {
      const transferInfo = JSON.parse(Buffer.from(transfer.data, 'hex').toString());

      // Get product details
      let productName = 'Unknown Product';
      try {
        const productData = await executeCommand(
          'main-chain',
          `liststreamkeyitems products ${transferInfo.productId}`
        );
        const products = JSON.parse(productData);
        if (products && products.length > 0) {
          const productInfo = JSON.parse(Buffer.from(products[0].data, 'hex').toString());
          productName = productInfo.name || 'Unknown Product';
        }
      } catch (err) {
        console.error(`Error fetching product info: ${err.message}`);
      }

      // Get distributor details
      let distributorName = 'Unknown Distributor';
      try {
        const distributor = config.entityStore.distributors[transferInfo.distributorId];
        if (distributor) {
          distributorName = distributor.name || 'Unknown Distributor';
        }
      } catch (err) {
        console.error(`Error fetching distributor info: ${err.message}`);
      }

      return {
        id: transferInfo.id || transfer.txid,
        productId: transferInfo.productId,
        productName,
        distributorId: transferInfo.distributorId,
        distributorName,
        quantity: transferInfo.quantity || transferInfo.serialNumbers?.length || 0,
        status: transferInfo.status || 'unknown',
        createdAt: transferInfo.createdAt || transferInfo.timestamp || transfer.time,
        serialNumbers: transferInfo.serialNumbers || []
      };
    }));

    res.json({
      success: true,
      transfers: formattedTransfers
    });
  } catch (error) {
    console.error('Error fetching manufacturer transfers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfers',
      error: error.message
    });
  }
});

// GET /api/manufacturer/products - Get all products for a manufacturer
app.get('/api/manufacturer/products', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a manufacturer
    if (req.entityType !== 'manufacturer') {
      return res.status(403).json({
        success: false,
        message: 'Only manufacturers can access this endpoint'
      });
    }

    const manufacturerId = req.entity.id;

    // Fetch all products from main chain
    const allProductsData = await executeCommand(
      'main-chain',
      'liststreamitems products'
    );

    const allProducts = JSON.parse(allProductsData);

    if (!allProducts || allProducts.length === 0) {
      return res.json({
        success: true,
        products: []
      });
    }

    // Filter and format manufacturer's products
    const manufacturerProducts = [];

    // Process each product
    for (const item of allProducts) {
      try {
        const productData = JSON.parse(Buffer.from(item.data, 'hex').toString());

        // Only include products owned by this manufacturer
        if (productData.manufacturerId === manufacturerId) {
          manufacturerProducts.push({
            productId: productData.productId,
            name: productData.name,
            description: productData.description,
            category: productData.category,
            specifications: productData.specifications,
            quantity: productData.quantity,
            serialNumberCount: productData.serialNumberCount,
            serialNumbersMerkleRoot: productData.serialNumbersMerkleRoot,
            registrationDate: productData.registrationDate,
            distributorId: productData.distributorId || null
          });
        }
      } catch (error) {
        console.error('Error parsing product data:', error);
      }
    }

    res.json({
      success: true,
      manufacturerId,
      productCount: manufacturerProducts.length,
      products: manufacturerProducts
    });
  } catch (error) {
    console.error('Failed to retrieve manufacturer products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve manufacturer products',
      error: error.message
    });
  }
});

// ----- Distributor Chain Endpoints -----

/**
 * Helper function to update inventory on distributor chain
 * @param {string} distributorId - Distributor ID
 * @param {string} productId - Product ID
 * @param {Array<string>} serialNumbers - Serial numbers to add to inventory
 * @param {string} operation - 'add' or 'remove'
 * @returns {Object} - Transaction result
 */
// Fix the updateDistributorInventory function
const updateDistributorInventory = async (distributorId, productId, serialNumbers, operation = 'add') => {
  try {
    // Validate input
    if (!distributorId || !productId || !serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      throw new Error('Invalid input for inventory update');
    }

    // Create inventory update record
    const inventoryUpdate = {
      productId,
      serialNumbers,
      distributorId,
      operation,
      quantity: serialNumbers.length,
      timestamp: Date.now(),
      updateId: `inv-update-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    };

    // Create a stream key combining product ID and distributor ID
    const streamKey = `${productId}-${distributorId}`;

    // Find the distributor entity to get its stream names
    const entity = config.entityStore.distributors[distributorId];

    if (!entity || !entity.streams || !entity.streams.inventory) {
      throw new Error(`Cannot find inventory stream for distributor ${distributorId}`);
    }

    // Get the inventory stream name
    const inventoryStreamName = entity.streams.inventory;

    // Convert to hex for blockchain storage
    const hexData = Buffer.from(JSON.stringify(inventoryUpdate)).toString('hex');

    // Publish to distributor chain
    const txid = await executeCommand(
      'distributor-chain',
      `publish ${inventoryStreamName} ${streamKey} ${hexData}`
    );

    // Also publish to the general distributor_transactions stream
    await executeCommand(
      'distributor-chain',
      `publish distributor_transactions ${inventoryUpdate.updateId} ${hexData}`
    );

    // Generate Merkle root for this update and publish to merkle_roots stream
    const updateItems = serialNumbers.map((serial, index) => ({
      serialNumber: serial,
      productId,
      operation,
      distributorId,
      timestamp: inventoryUpdate.timestamp
    }));

    const merkleTree = generateMerkleTree(updateItems);

    const merkleData = {
      updateId: inventoryUpdate.updateId,
      merkleRoot: merkleTree.root,
      operation,
      productId,
      distributorId,
      serialNumberCount: serialNumbers.length,
      timestamp: inventoryUpdate.timestamp
    };

    const merkleHexData = Buffer.from(JSON.stringify(merkleData)).toString('hex');

    await executeCommand(
      'distributor-chain',
      `publish merkle_roots ${inventoryUpdate.updateId} ${merkleHexData}`
    );

    // Also publish to main chain for cross-chain verification
    await executeCommand(
      'main-chain',
      `publish sidechain_merkle_roots ${inventoryUpdate.updateId} ${merkleHexData}`
    );

    return {
      txid: txid.trim(),
      updateId: inventoryUpdate.updateId,
      merkleRoot: merkleTree.root
    };
  } catch (error) {
    console.error('Failed to update distributor inventory:', error);
    throw error;
  }
};

/**
 * Helper to get distributor inventory for a specific product
 */
const getDistributorInventoryForProduct = async (distributorId, productId) => {
  try {
    // Find the distributor entity to get its stream names
    const entity = config.entityStore.distributors[distributorId];

    console.log(`Getting inventory for distributor ${distributorId}, product ${productId}`);
    console.log(`Entity data:`, JSON.stringify(entity, null, 2));

    if (!entity) {
      throw new Error(`Distributor ${distributorId} not found in entity store`);
    }

    if (!entity.streams) {
      throw new Error(`No streams configuration found for distributor ${distributorId}`);
    }

    if (!entity.streams.inventory) {
      throw new Error(`No inventory stream defined for distributor ${distributorId}`);
    }

    // Get the inventory stream name from entity config
    const streamName = entity.streams.inventory;

    // Remove the distributorId from productId if it's already there
    // This prevents key duplication when forming the streamKey
    let cleanProductId = productId;
    if (productId.includes(distributorId)) {
      cleanProductId = productId.substring(0, productId.indexOf(distributorId) - 1);
    }

    // Stream key for this product
    const streamKey = `${cleanProductId}-${distributorId}`;

    console.log(`Using inventory stream: ${streamName}, key: ${streamKey}`);

    // Get inventory records from the distributor chain
    const inventoryData = await executeCommand(
      'distributor-chain',
      `liststreamkeyitems ${streamName} ${streamKey}`
    );

    const inventoryItems = JSON.parse(inventoryData);
    console.log(`Found ${inventoryItems.length} inventory items for key ${streamKey}`);

    // Process the inventory items to get current state
    const serialNumbersInStock = new Set();

    for (const item of inventoryItems) {
      const inventoryUpdate = JSON.parse(Buffer.from(item.data, 'hex').toString());

      if (inventoryUpdate.operation === 'add') {
        // Add serial numbers to stock
        inventoryUpdate.serialNumbers.forEach(serial => serialNumbersInStock.add(serial));
      } else if (inventoryUpdate.operation === 'remove') {
        // Remove serial numbers from stock
        inventoryUpdate.serialNumbers.forEach(serial => serialNumbersInStock.delete(serial));
      }
    }

    console.log(`Processed inventory for ${productId}: ${serialNumbersInStock.size} items in stock`);

    return {
      productId: cleanProductId,
      distributorId,
      quantity: serialNumbersInStock.size,
      serialNumbers: Array.from(serialNumbersInStock)
    };
  } catch (error) {
    console.error(`Failed to get distributor inventory for product ${productId}:`, error);
    return {
      productId,
      distributorId,
      quantity: 0,
      serialNumbers: []
    };
  }
};

/**
 * Helper function to verify product ownership
 * @param {string} distributorId - Distributor ID
 * @param {string} productId - Product ID
 * @param {Array<string>} serialNumbers - Serial numbers to verify
 * @returns {boolean} - True if distributor has all specified serial numbers in inventory
 */
const verifyDistributorProductOwnership = async (distributorId, productId, serialNumbers) => {
  try {
    const inventory = await getDistributorInventoryForProduct(distributorId, productId);

    // Create a set of the serial numbers in inventory for fast lookup
    const inventorySet = new Set(inventory.serialNumbers);

    // Check if all requested serial numbers are in inventory
    return serialNumbers.every(serial => inventorySet.has(serial));
  } catch (error) {
    console.error('Failed to verify product ownership:', error);
    return false;
  }
};

const findProductIdForTestSerial = (serialNumber) => {
  // Extract the prefix from the serial number (e.g., "PROD" from "PROD-394815-00001")
  const parts = serialNumber.split('-');
  if (parts.length < 3) return null;

  // Convert prefix to lowercase to match your product IDs
  const prefix = parts[0].toLowerCase();

  // Look for products with IDs starting with the prefix
  const matchingProducts = db.products.filter(product =>
    product.productId && product.productId.startsWith(prefix)
  );

  return matchingProducts.length > 0 ? matchingProducts[0].productId : null;
};


// Endpoint to get distributor inventory
app.post('/api/distributor/receive-from-manufacturer', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a distributor
    if (req.entityType !== 'distributor') {
      return res.status(403).json({
        success: false,
        message: 'Only distributors can access this endpoint'
      });
    }

    const { productId, serialNumbers, manufacturerId, transferId } = req.body;

    if (!productId || !serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid serial numbers array are required'
      });
    }

    // Validate serial numbers format
    if (!validateSerialNumbers(serialNumbers)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid serial numbers format'
      });
    }

    // Verify that the product exists on the main chain
    const productExists = await executeCommand(
      'main-chain',
      `liststreamkeyitems products ${productId}`
    );

    const products = JSON.parse(productExists);

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found on main chain'
      });
    }

    // Record the receipt on the distributor chain
    const receiptId = `receipt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Create receipt record
    const receipt = {
      receiptId,
      productId,
      serialNumbers,
      quantity: serialNumbers.length,
      manufacturerId,
      distributorId: req.entity.id,
      timestamp: Date.now(),
      status: 'received'
    };

    // Get the distributor's transfer stream name (from entity data)
    let transfersInStream = null;

    if (req.entity && req.entity.streams && req.entity.streams.transfersIn) {
      transfersInStream = req.entity.streams.transfersIn;
    } else {
      // Fallback if stream name not found in entity data
      const entityCode = req.entity.id.split('-')[2] || crypto.randomBytes(2).toString('hex');
      transfersInStream = `d${entityCode}in`;
    }

    // Convert to hex for blockchain storage
    const hexData = Buffer.from(JSON.stringify(receipt)).toString('hex');

    // Publish to distributor chain - use receiptId as the KEY, not the stream name
    const txid = await executeCommand(
      'distributor-chain',
      `publish ${transfersInStream} ${receiptId} ${hexData}`
    );

    // Also publish to the general distributor_transactions stream
    await executeCommand(
      'distributor-chain',
      `publish distributor_transactions ${receiptId} ${hexData}`
    );

    // Update inventory
    const inventoryUpdate = await updateDistributorInventory(
      req.entity.id,
      productId,
      serialNumbers,
      'add'
    );

    // Create a record on main chain for cross-chain verification
    const crossChainData = {
      receiptId,
      distributorId: req.entity.id,
      manufacturerId,
      productId,
      serialNumberCount: serialNumbers.length,
      merkleRoot: inventoryUpdate.merkleRoot,
      timestamp: receipt.timestamp
    };

    const crossChainHexData = Buffer.from(JSON.stringify(crossChainData)).toString('hex');

    await executeCommand(
      'main-chain',
      `publish cross_chain_verifications ${receiptId} ${crossChainHexData}`
    );

    // ADDED: Update the transfer status on main chain if transferId is provided
    if (transferId) {
      try {
        console.log(`Updating transfer status for transfer ID: ${transferId}`);

        // Get the existing transfer data
        const transferData = await executeCommand(
          'main-chain',
          `liststreamkeyitems transfers ${transferId}`
        );

        const transfers = JSON.parse(transferData);

        if (transfers && transfers.length > 0) {
          // Get the latest transfer record
          const latestTransfer = transfers.reduce((latest, current) => {
            return latest.time > current.time ? latest : current;
          }, transfers[0]);

          // Parse the transfer data
          const transferRecord = JSON.parse(Buffer.from(latestTransfer.data, 'hex').toString());

          // Update the status to 'accepted'
          transferRecord.status = 'accepted';
          transferRecord.acceptedAt = Date.now();
          transferRecord.receiptId = receiptId;

          // Publish the updated transfer record
          const updatedHexData = Buffer.from(JSON.stringify(transferRecord)).toString('hex');

          await executeCommand(
            'main-chain',
            `publish transfers ${transferId} ${updatedHexData}`
          );

          console.log(`Updated transfer status to 'accepted' for transfer ID: ${transferId}`);
        }
      } catch (transferUpdateError) {
        console.error(`Failed to update transfer status: ${transferUpdateError.message}`);
        // Continue with response even if transfer update fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Products received and inventory updated',
      receiptId,
      productId,
      quantity: serialNumbers.length,
      txid: txid.trim(),
      inventoryUpdateId: inventoryUpdate.updateId
    });
  } catch (error) {
    console.error('Failed to process product receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process product receipt',
      error: error.message
    });
  }
});

// Endpoint for distributors to create shipments to retailers with encrypted sensitive logistics data
app.post('/api/distributor/shipment/create', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a distributor
    if (req.entityType !== 'distributor') {
      return res.status(403).json({
        success: false,
        message: 'Only distributors can access this endpoint'
      });
    }

    const { productId, serialNumbers, retailerId, shipmentDetails } = req.body;

    if (!productId || !serialNumbers || !retailerId || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, retailer ID, and valid serial numbers array are required'
      });
    }

    // Validate serial numbers format
    if (!validateSerialNumbers(serialNumbers)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid serial numbers format'
      });
    }

    // Verify that the distributor has these products in inventory
    const hasProducts = await verifyDistributorProductOwnership(
      req.entity.id,
      productId,
      serialNumbers
    );

    if (!hasProducts) {
      return res.status(400).json({
        success: false,
        message: 'One or more serial numbers are not in your inventory'
      });
    }

    // Remove products from distributor inventory
    const inventoryUpdate = await updateDistributorInventory(
      req.entity.id,
      productId,
      serialNumbers,
      'remove'
    );

    // Generate a shipment ID
    const shipmentId = `shipment-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Create public shipment data (non-sensitive)
    const publicShipment = {
      shipmentId,
      productId,
      serialNumbers,
      quantity: serialNumbers.length,
      distributorId: req.entity.id,
      retailerId,
      timestamp: Date.now(),
      status: 'shipped',
      expectedDeliveryDate: shipmentDetails?.expectedDelivery
    };

    // Create sensitive logistics data (should not be shared with other entities)
    const sensitiveLogistics = {
      carrier: shipmentDetails?.carrier || 'Unknown',
      trackingNumber: shipmentDetails?.trackingNumber || null,
      routingDetails: shipmentDetails?.routingDetails || {},
      insuranceInfo: shipmentDetails?.insuranceInfo || {},
      specialInstructions: shipmentDetails?.specialInstructions || '',
      contractTerms: shipmentDetails?.contractTerms || {},
      pricing: {
        shippingCost: shipmentDetails?.pricing?.shippingCost || 0,
        insuranceCost: shipmentDetails?.pricing?.insuranceCost || 0,
        discounts: shipmentDetails?.pricing?.discounts || 0,
        taxes: shipmentDetails?.pricing?.taxes || 0,
        totalCost: shipmentDetails?.pricing?.totalCost || 0
      },
      internalNotes: shipmentDetails?.internalNotes || ''
    };

    // Encrypt sensitive logistics data using distributor's entity ID
    const encryptedLogistics = encryptSensitiveData(sensitiveLogistics, req.entity.id);

    // Create data reference hash for verification without revealing content
    const logisticsReference = createDataReference(sensitiveLogistics);

    // Add reference to public shipment
    publicShipment.logisticsReference = logisticsReference;
    publicShipment.hasEncryptedData = true;

    // Create complete shipment record with encrypted data
    const completeShipment = {
      ...publicShipment,
      encryptedLogistics
    };

    // Get the distributor's transfer stream name from entity data
    let transfersOutStream = null;

    if (req.entity && req.entity.streams && req.entity.streams.transfersOut) {
      transfersOutStream = req.entity.streams.transfersOut;
    } else {
      // Fallback if stream name not found in entity data
      const entityCode = req.entity.id.split('-')[2] || crypto.randomBytes(2).toString('hex');
      transfersOutStream = `d${entityCode}out`;
    }

    // Convert complete shipment to hex for blockchain storage
    const hexData = Buffer.from(JSON.stringify(completeShipment)).toString('hex');

    // Publish complete record (with encrypted data) to distributor chain
    const txid = await executeCommand(
      'distributor-chain',
      `publish ${transfersOutStream} ${shipmentId} ${hexData}`
    );

    // Convert public shipment to hex for cross-chain sharing
    const publicHexData = Buffer.from(JSON.stringify(publicShipment)).toString('hex');

    // Also publish public data to the general distributor_transactions stream
    await executeCommand(
      'distributor-chain',
      `publish distributor_transactions ${shipmentId} ${publicHexData}`
    );

    // Create a record on main chain for cross-chain verification (public data only)
    const crossChainData = {
      shipmentId,
      distributorId: req.entity.id,
      retailerId,
      productId,
      serialNumberCount: serialNumbers.length,
      merkleRoot: inventoryUpdate.merkleRoot,
      timestamp: publicShipment.timestamp,
      logisticsReference // Only include reference hash, not actual logistics data
    };

    const crossChainHexData = Buffer.from(JSON.stringify(crossChainData)).toString('hex');

    await executeCommand(
      'main-chain',
      `publish cross_chain_verifications ${shipmentId} ${crossChainHexData}`
    );

    res.status(201).json({
      success: true,
      message: 'Shipment created successfully',
      shipmentId,
      productId,
      retailerId,
      quantity: serialNumbers.length,
      txid: txid.trim()
    });
  } catch (error) {
    console.error('Failed to create shipment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create shipment',
      error: error.message
    });
  }
});

// Endpoint to access encrypted shipment logistics
app.get('/api/distributor/shipment/:shipmentId/logistics', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a distributor
    if (req.entityType !== 'distributor') {
      return res.status(403).json({
        success: false,
        message: 'Only distributors can access this endpoint'
      });
    }

    const { shipmentId } = req.params;

    if (!shipmentId) {
      return res.status(400).json({
        success: false,
        message: 'Shipment ID is required'
      });
    }

    // Find the distributor's transfers out stream
    let transfersOutStream = null;

    if (req.entity && req.entity.streams && req.entity.streams.transfersOut) {
      transfersOutStream = req.entity.streams.transfersOut;
    } else {
      // Fallback if stream name not found in entity data
      const entityCode = req.entity.id.split('-')[2] || crypto.randomBytes(2).toString('hex');
      transfersOutStream = `d${entityCode}out`;
    }

    // Get the shipment record
    const shipmentData = await executeCommand(
      'distributor-chain',
      `liststreamkeyitems ${transfersOutStream} ${shipmentId}`
    );

    const shipments = JSON.parse(shipmentData);

    if (!shipments || shipments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shipment record not found'
      });
    }

    // Get the most recent shipment record
    const latestShipment = shipments.reduce((latest, current) => {
      return latest.time > current.time ? latest : current;
    }, shipments[0]);

    // Parse the shipment record
    const shipmentRecord = JSON.parse(Buffer.from(latestShipment.data, 'hex').toString());

    // Verify this distributor owns the shipment record
    if (shipmentRecord.distributorId !== req.entity.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this shipment record'
      });
    }

    // Check if the record has encrypted logistics data
    if (!shipmentRecord.encryptedLogistics) {
      return res.status(404).json({
        success: false,
        message: 'No encrypted logistics data found for this shipment'
      });
    }

    // Decrypt the logistics data
    try {
      const logisticsData = decryptSensitiveData(shipmentRecord.encryptedLogistics, req.entity.id);

      res.json({
        success: true,
        shipmentId,
        productId: shipmentRecord.productId,
        retailerId: shipmentRecord.retailerId,
        quantity: shipmentRecord.quantity,
        status: shipmentRecord.status,
        timestamp: shipmentRecord.timestamp,
        expectedDeliveryDate: shipmentRecord.expectedDeliveryDate,
        logisticsData
      });
    } catch (decryptError) {
      console.error('Failed to decrypt logistics data:', decryptError);
      res.status(500).json({
        success: false,
        message: 'Failed to decrypt logistics data',
        error: decryptError.message
      });
    }
  } catch (error) {
    console.error('Failed to retrieve shipment logistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve shipment logistics',
      error: error.message
    });
  }
});

// Endpoint to get distributor shipment history
app.get('/api/distributor/shipments', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a distributor
    if (req.entityType !== 'distributor') {
      return res.status(403).json({
        success: false,
        message: 'Only distributors can access this endpoint'
      });
    }

    // Find the distributor's transfers out stream - using the SAME pattern as in entity registration
    let transfersOutStream = null;

    if (req.entity && req.entity.streams && req.entity.streams.transfersOut) {
      // Use the stream name directly from entity data if available (preferred approach)
      transfersOutStream = req.entity.streams.transfersOut;
    } else {
      // Fallback - use same pattern as in entity registration (around line 300)
      const entityCode = req.entity.id.split('-')[2] || crypto.randomBytes(2).toString('hex');
      transfersOutStream = `d${entityCode}out`;
    }

    console.log(`Using transfers out stream: ${transfersOutStream} for distributor ${req.entity.id}`);

    // Get all items in the transfers_out stream
    const shipmentsData = await executeCommand(
      'distributor-chain',
      `liststreamitems ${transfersOutStream}`
    );

    const shipments = JSON.parse(shipmentsData);

    if (!shipments || shipments.length === 0) {
      return res.json({
        success: true,
        shipments: []
      });
    }

    // Process each shipment
    const formattedShipments = shipments.map(shipment => {
      try {
        const shipmentData = JSON.parse(Buffer.from(shipment.data, 'hex').toString());

        return {
          shipmentId: shipmentData.shipmentId,
          productId: shipmentData.productId,
          quantity: shipmentData.quantity,
          retailerId: shipmentData.retailerId,
          timestamp: shipmentData.timestamp,
          status: shipmentData.status
        };
      } catch (error) {
        console.error('Error parsing shipment data:', error);
        return null;
      }
    }).filter(shipment => shipment !== null);

    res.json({
      success: true,
      distributorId: req.entity.id,
      shipments: formattedShipments
    });
  } catch (error) {
    console.error('Failed to get shipment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get shipment history',
      error: error.message
    });
  }
});
// Endpoint to get distributor inventory
app.get('/api/distributor/inventory', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a distributor
    if (req.entityType !== 'distributor') {
      return res.status(403).json({
        success: false,
        message: 'Only distributors can access this endpoint'
      });
    }

    // Get entity to access its stream names
    const entity = config.entityStore.distributors[req.entity.id];

    if (!entity || !entity.streams || !entity.streams.inventory) {
      return res.status(404).json({
        success: false,
        message: `Cannot find inventory stream for distributor ${req.entity.id}`
      });
    }

    // Stream name for this distributor's inventory
    const streamName = entity.streams.inventory;

    // Get all keys in the inventory stream
    const keysData = await executeCommand(
      'distributor-chain',
      `liststreamkeys ${streamName}`
    );

    const keys = JSON.parse(keysData);

    if (!keys || keys.length === 0) {
      return res.json({
        success: true,
        distributorId: req.entity.id,
        inventory: []
      });
    }

    // Process each key to get inventory by product
    // Process each key to get inventory by product
    const inventoryPromises = keys.map(async (key) => {
      try {
        // Fix key.name access - MultiChain returns keys where the actual key is in either .key or .name
        const keyString = key.key || key.name;

        if (!keyString) {
          console.error(`Invalid key structure:`, key);
          return null;
        }

        // Extract product ID - by finding the distributor ID part and taking everything before it
        let productId = keyString;
        const distributorPart = `-${req.entity.id}`;

        if (keyString.includes(distributorPart)) {
          productId = keyString.substring(0, keyString.indexOf(distributorPart));
        }

        console.log(`Processing inventory for product ID: ${productId}`);

        return await getDistributorInventoryForProduct(req.entity.id, productId);
      } catch (error) {
        console.error(`Failed to get inventory for product key:`, error);
        return null;
      }
    });

    // Wait for all inventory queries to complete
    const inventoryItems = await Promise.all(inventoryPromises);

    // Filter out null results and format response
    const validInventory = inventoryItems.filter(item => item !== null && item.serialNumbers && item.serialNumbers.length > 0);

    console.log(`Found ${validInventory.length} valid inventory items with products`);

    res.json({
      success: true,
      distributorId: req.entity.id,
      inventory: validInventory
    });
  } catch (error) {
    console.error('Failed to get distributor inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get distributor inventory',
      error: error.message
    });
  }
});

// Endpoint for distributors to see pending transfers
app.get('/api/distributor/pending-transfers', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a distributor
    if (req.entityType !== 'distributor') {
      return res.status(403).json({
        success: false,
        message: 'Only distributors can access this endpoint'
      });
    }

    // Get all transfers from main chain
    const transfersData = await executeCommand(
      'main-chain',
      'liststreamitems transfers'
    );

    const allTransfers = JSON.parse(transfersData);

    // Process transfers to find the latest status of each ID
    const transferMap = new Map(); // Maps transferId to the latest transfer data

    // First pass: organize ALL transfers by ID and find the latest version of each
    allTransfers.forEach(item => {
      try {
        const transferData = JSON.parse(Buffer.from(item.data, 'hex').toString());
        const transferId = transferData.id;

        // Only keep the latest version based on blockchain timestamp
        if (!transferMap.has(transferId) ||
          item.time > transferMap.get(transferId).blockTime) {
          transferMap.set(transferId, {
            blockTime: item.time,
            data: transferData
          });
        }
      } catch (error) {
        console.error(`Error processing transfer item:`, error);
      }
    });

    // Now filter to only include pending transfers for this distributor
    // Convert to array and extract just the transfer data
    let pendingTransfers = Array.from(transferMap.values())
      .map(item => item.data)
      .filter(transfer =>
        transfer.distributorId === req.entity.id &&
        transfer.status === 'pending'
      );

    console.log(`Found ${pendingTransfers.length} pending transfers for distributor ${req.entity.id}`);

    // Sort by creation timestamp (newest first)
    pendingTransfers = pendingTransfers.sort((a, b) => b.createdAt - a.createdAt);

    // For each transfer, get the product details
    const transfersWithProductDetails = await Promise.all(pendingTransfers.map(async (transfer) => {
      try {
        const productData = await executeCommand(
          'main-chain',
          `liststreamkeyitems products ${transfer.productId}`
        );

        const products = JSON.parse(productData);

        if (!products || products.length === 0) {
          return {
            ...transfer,
            productDetails: null
          };
        }

        const productInfo = JSON.parse(Buffer.from(products[0].data, 'hex').toString());

        return {
          ...transfer,
          productDetails: {
            name: productInfo.name,
            description: productInfo.description,
            category: productInfo.category
          }
        };
      } catch (error) {
        console.error(`Failed to get product details for ${transfer.productId}:`, error);
        return transfer;
      }
    }));

    res.json({
      success: true,
      transfers: transfersWithProductDetails
    });
  } catch (error) {
    console.error('Failed to retrieve pending transfers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending transfers',
      error: error.message
    });
  }
});


// ----- Retailer Chain Endpoints -----

/**
 * Helper function to update inventory on retailer chain
 * @param {string} retailerId - Retailer ID
 * @param {string} productId - Product ID
 * @param {Array<string>} serialNumbers - Serial numbers to add to inventory
 * @param {string} operation - 'add' or 'remove'
 * @returns {Object} - Transaction result
 */
const updateRetailerInventory = async (retailerId, productId, serialNumbers, operation = 'add') => {
  try {
    // Validate input
    if (!retailerId || !productId || !serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      throw new Error('Invalid input for inventory update');
    }

    // Find the retailer entity to get its stream names
    const entity = config.entityStore.retailers[retailerId];

    if (!entity || !entity.streams || !entity.streams.inventory) {
      throw new Error(`Cannot find inventory stream for retailer ${retailerId}`);
    }

    // Get the inventory stream name from entity config
    const streamName = entity.streams.inventory;

    // Create inventory update record
    const inventoryUpdate = {
      productId,
      serialNumbers,
      retailerId,
      operation,
      quantity: serialNumbers.length,
      timestamp: Date.now(),
      updateId: `inv-update-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    };

    // Create a stream key combining product ID and retailer ID
    const streamKey = `${productId}-${retailerId}`;

    // Convert to hex for blockchain storage
    const hexData = Buffer.from(JSON.stringify(inventoryUpdate)).toString('hex');

    // Publish to retailer chain
    const txid = await executeCommand(
      'retailer-chain',
      `publish ${streamName} ${streamKey} ${hexData}`
    );

    // Also publish to the general retailer_transactions stream
    await executeCommand(
      'retailer-chain',
      `publish retailer_transactions ${inventoryUpdate.updateId} ${hexData}`
    );

    // Generate Merkle root for this update and publish to merkle_roots stream
    const updateItems = serialNumbers.map((serial, index) => ({
      serialNumber: serial,
      productId,
      operation,
      retailerId,
      timestamp: inventoryUpdate.timestamp
    }));

    const merkleTree = generateMerkleTree(updateItems);

    const merkleData = {
      updateId: inventoryUpdate.updateId,
      merkleRoot: merkleTree.root,
      operation,
      productId,
      retailerId,
      serialNumberCount: serialNumbers.length,
      timestamp: inventoryUpdate.timestamp
    };

    const merkleHexData = Buffer.from(JSON.stringify(merkleData)).toString('hex');

    await executeCommand(
      'retailer-chain',
      `publish merkle_roots ${inventoryUpdate.updateId} ${merkleHexData}`
    );

    // Also publish to main chain for cross-chain verification
    await executeCommand(
      'main-chain',
      `publish sidechain_merkle_roots ${inventoryUpdate.updateId} ${merkleHexData}`
    );

    return {
      txid: txid.trim(),
      updateId: inventoryUpdate.updateId,
      merkleRoot: merkleTree.root
    };
  } catch (error) {
    console.error('Failed to update retailer inventory:', error);
    throw error;
  }
};

/**
 * Helper to get retailer inventory for a specific product
 */
const getRetailerInventoryForProduct = async (retailerId, productId) => {
  try {
    // Find the retailer entity to get its stream names
    const entity = config.entityStore.retailers[retailerId];

    if (!entity || !entity.streams || !entity.streams.inventory) {
      throw new Error(`Cannot find inventory stream for retailer ${retailerId}`);
    }

    // Get the inventory stream name from entity config
    const streamName = entity.streams.inventory;

    // Stream key for this product - ensure consistent format
    const streamKey = `${productId}-${retailerId}`;

    console.log(`Looking up inventory for retailer ${retailerId}, product ${productId} with key ${streamKey}`);

    // Get inventory records from the retailer chain
    const inventoryData = await executeCommand(
      'retailer-chain',
      `liststreamkeyitems ${streamName} ${streamKey}`
    );

    const inventoryItems = JSON.parse(inventoryData);
    console.log(`Found ${inventoryItems.length} inventory records for ${streamKey}`);

    // Process the inventory items to get current state
    const serialNumbersInStock = new Set();

    for (const item of inventoryItems) {
      try {
        const inventoryUpdate = JSON.parse(Buffer.from(item.data, 'hex').toString());
        console.log(`Processing inventory update: ${JSON.stringify(inventoryUpdate)}`);

        if (inventoryUpdate.operation === 'add') {
          // Add serial numbers to stock
          inventoryUpdate.serialNumbers.forEach(serial => {
            serialNumbersInStock.add(serial);
            console.log(`Added serial ${serial} to inventory`);
          });
        } else if (inventoryUpdate.operation === 'remove') {
          // Remove serial numbers from stock
          inventoryUpdate.serialNumbers.forEach(serial => {
            serialNumbersInStock.delete(serial);
            console.log(`Removed serial ${serial} from inventory`);
          });
        }
      } catch (parseError) {
        console.error(`Error parsing inventory item: ${parseError.message}`);
      }
    }

    const serialNumbers = Array.from(serialNumbersInStock);
    console.log(`Final inventory for ${productId}: ${serialNumbers.length} items in stock`);

    return {
      productId,
      retailerId,
      quantity: serialNumbers.length,
      serialNumbers
    };
  } catch (error) {
    console.error(`Failed to get retailer inventory for ${productId}:`, error);
    throw error;
  }
};

/**
 * Helper function to verify product ownership by retailer
 * @param {string} retailerId - Retailer ID
 * @param {string} productId - Product ID
 * @param {Array<string>} serialNumbers - Serial numbers to verify
 * @returns {boolean} - True if retailer has all specified serial numbers in inventory
 */
const verifyRetailerProductOwnership = async (retailerId, productId, serialNumbers) => {
  try {
    const inventory = await getRetailerInventoryForProduct(retailerId, productId);

    // Create a set of the serial numbers in inventory for fast lookup
    const inventorySet = new Set(inventory.serialNumbers);

    // Check if all requested serial numbers are in inventory
    return serialNumbers.every(serial => inventorySet.has(serial));
  } catch (error) {
    console.error('Failed to verify product ownership:', error);
    return false;
  }
};

// Endpoint for retailers to receive products from distributors
app.post('/api/retailer/receive-from-distributor', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    const retailerId = req.entity.id;

    // Get entity to access its stream names
    let entity = config.entityStore.retailers[retailerId];

    // Check if entity exists but doesn't have the necessary streams
    if (entity && (!entity.streams || !entity.streams.inventory)) {
      console.log(`Retailer ${retailerId} exists but missing streams. Creating now...`);
      // Ensure the streams exist
      const retailerStreams = await ensureRetailerStreams(retailerId);
      
      // Refresh entity from the store after updating streams
      entity = config.entityStore.retailers[retailerId];
    }

    const { shipmentId, productId, serialNumbers, distributorId } = req.body;

    if (!shipmentId || !productId || !serialNumbers || !distributorId ||
      !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Shipment ID, product ID, distributor ID and valid serial numbers array are required'
      });
    }

    // Validate serial numbers format
    if (!validateSerialNumbers(serialNumbers)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid serial numbers format'
      });
    }

    // Verify that the product exists on the main chain
    const productExists = await executeCommand(
      'main-chain',
      `liststreamkeyitems products ${productId}`
    );

    const products = JSON.parse(productExists);

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found on main chain'
      });
    }

    // Verify the shipment on distributor chain
    // First, find the distributor entity to get its stream names
    const distributorEntity = config.entityStore.distributors[distributorId];

    // Get the transfers_out stream name using the same pattern as in other places
    let transfersOutStream = null;

    if (distributorEntity && distributorEntity.streams && distributorEntity.streams.transfersOut) {
      transfersOutStream = distributorEntity.streams.transfersOut;
    } else {
      // Fallback if stream name not found in entity data
      const entityCode = distributorId.split('-')[2] || crypto.randomBytes(2).toString('hex');
      transfersOutStream = `d${entityCode}out`;
    }

    try {
      const shipmentData = await executeCommand(
        'distributor-chain',
        `liststreamkeyitems ${transfersOutStream} ${shipmentId}`
      );

      const shipments = JSON.parse(shipmentData);

      if (!shipments || shipments.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found on distributor chain'
        });
      }

      const shipmentInfo = JSON.parse(Buffer.from(shipments[0].data, 'hex').toString());

      // Verify that the shipment was intended for this retailer
      if (shipmentInfo.retailerId !== req.entity.id) {
        return res.status(403).json({
          success: false,
          message: 'This shipment was not intended for your retail store'
        });
      }

      // Verify that the serial numbers match
      const serialNumbersMatch = serialNumbers.every(serial =>
        shipmentInfo.serialNumbers.includes(serial)
      );

      if (!serialNumbersMatch) {
        return res.status(400).json({
          success: false,
          message: 'The provided serial numbers do not match the shipment record'
        });
      }
    } catch (error) {
      console.error('Failed to verify shipment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify shipment on distributor chain',
        error: error.message
      });
    }

    // Record the receipt on the retailer chain
    const receiptId = `receipt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Create receipt record
    const receipt = {
      receiptId,
      shipmentId,
      productId,
      serialNumbers,
      quantity: serialNumbers.length,
      distributorId,
      retailerId: req.entity.id,
      timestamp: Date.now(),
      status: 'received'
    };

    // Use the standard retailer_transactions stream - this exists for all retailers
    const retailerTransactionsStream = 'retailer_transactions';

    // Convert to hex for blockchain storage
    const hexData = Buffer.from(JSON.stringify(receipt)).toString('hex');

    // Publish to retailer chain using the general transactions stream
    const txid = await executeCommand(
      'retailer-chain',
      `publish ${retailerTransactionsStream} ${receiptId} ${hexData}`
    );

    // Update inventory
    const inventoryUpdate = await updateRetailerInventory(
      req.entity.id,
      productId,
      serialNumbers,
      'add'
    );

    // Create a record on main chain for cross-chain verification
    const crossChainData = {
      receiptId,
      shipmentId,
      retailerId: req.entity.id,
      distributorId,
      productId,
      serialNumberCount: serialNumbers.length,
      merkleRoot: inventoryUpdate.merkleRoot,
      timestamp: receipt.timestamp
    };

    const crossChainHexData = Buffer.from(JSON.stringify(crossChainData)).toString('hex');

    await executeCommand(
      'main-chain',
      `publish cross_chain_verifications ${receiptId} ${crossChainHexData}`
    );

    res.status(201).json({
      success: true,
      message: 'Shipment received and inventory updated',
      receiptId,
      productId,
      quantity: serialNumbers.length,
      txid: txid.trim(),
      inventoryUpdateId: inventoryUpdate.updateId
    });
  } catch (error) {
    console.error('Failed to process shipment receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process shipment receipt',
      error: error.message
    });
  }
});

// Endpoint to get retailer inventory
app.get('/api/retailer/inventory', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    const retailerId = req.entity.id;

    // Get entity to access its stream names
    let entity = config.entityStore.retailers[retailerId];

    // Check if entity exists but doesn't have the necessary streams
    if (entity && (!entity.streams || !entity.streams.inventory)) {
      console.log(`Retailer ${retailerId} exists but missing streams. Creating now...`);
      // Ensure the streams exist
      const retailerStreams = await ensureRetailerStreams(retailerId);
      
      // Refresh entity from the store after updating streams
      entity = config.entityStore.retailers[retailerId];
    }

    if (!entity || !entity.streams || !entity.streams.inventory) {
      return res.status(404).json({
        success: false,
        message: `Cannot find inventory stream for retailer ${retailerId}`
      });
    }

    // Stream name for this retailer's inventory
    const streamName = entity.streams.inventory;

    // Get all keys in the inventory stream
    const keysData = await executeCommand(
      'retailer-chain',
      `liststreamkeys ${streamName}`
    );

    const keys = JSON.parse(keysData);
    console.log(`Found ${keys.length} keys in retailer inventory stream ${streamName}`);

    if (!keys || keys.length === 0) {
      return res.json({
        success: true,
        retailerId: req.entity.id,
        inventory: []
      });
    }

    // Process each key to get inventory by product
    const inventoryPromises = keys.map(async (key) => {
      try {
        // Handle both possible key formats from MultiChain
        const keyString = key.key || key.name;

        if (!keyString) {
          console.error(`Invalid key structure:`, key);
          return null;
        }

        // Extract product ID from the key (format is productId-retailerId)
        // Split on the retailerId to get the productId part correctly
        const parts = keyString.split(`-${retailerId}`);
        const productId = parts[0];
        
        if (!productId) {
          console.error(`Could not extract product ID from key: ${keyString}`);
          return null;
        }
        
        console.log(`Processing inventory for key ${keyString}, extracted product ID: ${productId}`);
        
        // Get inventory for this product
        return await getRetailerInventoryForProduct(retailerId, productId);
      } catch (error) {
        console.error(`Failed to get inventory for key: ${error.message}`);
        return null;
      }
    });

    // Wait for all inventory queries to complete
    const inventoryItems = await Promise.all(inventoryPromises);

    // Filter out null results and products with zero items
    const validInventory = inventoryItems.filter(item => 
      item !== null && item.serialNumbers && item.serialNumbers.length > 0
    );

    console.log(`Found ${validInventory.length} valid products with items in inventory`);

    // Look up product names for each inventory item
    const enrichedInventory = await Promise.all(validInventory.map(async (item) => {
      try {
        // Get product details from main chain
        const productData = await executeCommand(
          'main-chain',
          `liststreamkeyitems products ${item.productId}`
        );
        
        const products = JSON.parse(productData);
        
        if (products && products.length > 0) {
          const productInfo = JSON.parse(Buffer.from(products[0].data, 'hex').toString());
          return {
            ...item,
            productName: productInfo.name || item.productId
          };
        }
        
        return item;
      } catch (error) {
        console.error(`Error enriching product ${item.productId}: ${error.message}`);
        return item;
      }
    }));

    res.json({
      success: true,
      retailerId: req.entity.id,
      inventory: enrichedInventory
    });
  } catch (error) {
    console.error('Failed to get retailer inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get retailer inventory',
      error: error.message
    });
  }
});

// Updated endpoint to record customer sales with encrypted customer data
app.post('/api/retailer/sales/record', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    const { customerName, customerContact, customerAddress, paymentMethod, saleNotes, items, timestamp } = req.body;

    // Handle both single item and multiple items formats
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product item is required'
      });
    }

    // Validate each item in the items array
    for (const item of items) {
      // Accept either serialNumber or serialNumbers array
      const hasSerialNumber = item.serialNumber || 
                             (item.serialNumbers && item.serialNumbers.length > 0);
      
      if (!item.productId || !hasSerialNumber || item.price === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Product ID, serial number, and price are required'
        });
      }
    }

    // Generate a sale ID
    const saleId = `sale-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Process multiple items
    const processedItems = [];
    const inventoryUpdates = [];
    
    for (const item of items) {
      // Handle both single serialNumber and array of serialNumbers
      const serialNumbers = item.serialNumbers || [item.serialNumber];
      
      // Verify that the retailer has this product in inventory
      const hasProduct = await verifyRetailerProductOwnership(
        req.entity.id,
        item.productId,
        serialNumbers
      );

      if (!hasProduct) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.productId} with serial number(s) ${serialNumbers.join(', ')} not found in inventory`
        });
      }
      
      // Add to processed items
      processedItems.push({
        productId: item.productId,
        serialNumbers,
        price: item.price,
        quantity: serialNumbers.length
      });
      
      // Add to inventory updates
      inventoryUpdates.push({
        productId: item.productId,
        serialNumbers
      });
    }

    // Create the basic sale record with non-sensitive data for public sharing
    const publicSale = {
      saleId,
      retailerId: req.entity.id,
      timestamp: timestamp || Date.now(),
      status: 'sold',
      items: processedItems
    };

    // Collect sensitive customer data that should be encrypted
    const sensitiveCustomerData = {
      customerName: customerName || 'anonymous',
      customerContact: customerContact || '',
      customerAddress: customerAddress || '',
      paymentMethod: paymentMethod || 'cash',
      saleNotes: saleNotes || '',
      customerInfo: req.body.customerInfo || {},
      paymentDetails: req.body.paymentDetails || {},
      shippingAddress: req.body.shippingAddress || {},
      contactInfo: req.body.contactInfo || {},
      customerNotes: req.body.customerNotes || ''
    };

    // Encrypt sensitive customer data
    const encryptedCustomerData = encryptSensitiveData(sensitiveCustomerData, req.entity.id);

    // Create a reference hash for the encrypted data
    const customerDataReference = createDataReference(sensitiveCustomerData);

    // Add reference to public sale data
    publicSale.customerDataReference = customerDataReference;
    publicSale.hasEncryptedData = true;

    // Full sale record with encrypted data (only stored on retailer chain)
    const completeSaleRecord = {
      ...publicSale,
      encryptedCustomerData
    };

    // Get entity to access its stream names
    const entity = config.entityStore.retailers[req.entity.id];
    if (!entity || !entity.streams || !entity.streams.sales) {
      return res.status(404).json({
        success: false,
        message: `Cannot find sales stream for retailer ${req.entity.id}`
      });
    }

    // Stream name for this retailer's sales from entity data
    const salesStreamName = entity.streams.sales;

    // Convert complete sale record to hex for blockchain storage
    const completeHexData = Buffer.from(JSON.stringify(completeSaleRecord)).toString('hex');

    // Publish complete record with encrypted data to retailer's sales stream
    const txid = await executeCommand(
      'retailer-chain',
      `publish ${salesStreamName} ${saleId} ${completeHexData}`
    );

    // Convert public sale record to hex (without sensitive customer data)
    const publicHexData = Buffer.from(JSON.stringify(publicSale)).toString('hex');

    // Also publish public data to the general retailer_transactions stream
    await executeCommand(
      'retailer-chain',
      `publish retailer_transactions ${saleId} ${publicHexData}`
    );

    // Remove the products from inventory
    for (const update of inventoryUpdates) {
      await updateRetailerInventory(
        req.entity.id,
        update.productId,
        update.serialNumbers,
        'remove'
      );
    }

    // Create a record on main chain for product history (only public data)
    const crossChainData = {
      saleId,
      retailerId: req.entity.id,
      itemCount: processedItems.length,
      timestamp: publicSale.timestamp,
      customerDataReference
    };

    const crossChainHexData = Buffer.from(JSON.stringify(crossChainData)).toString('hex');

    await executeCommand(
      'main-chain',
      `publish cross_chain_verifications ${saleId} ${crossChainHexData}`
    );

    res.status(201).json({
      success: true,
      message: 'Sale recorded successfully',
      saleId,
      productId: items.length === 1 ? items[0].productId : undefined,
      serialNumber: items.length === 1 ? items[0].serialNumber || (items[0].serialNumbers && items[0].serialNumbers[0]) : undefined,
      itemCount: items.length,
      txid: txid.trim()
    });
  } catch (error) {
    console.error('Failed to record sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record sale',
      error: error.message
    });
  }
});

//  endpoint to access encrypted customer data for a sale
app.get('/api/retailer/sales/:saleId/customer-data', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    const { saleId } = req.params;

    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: 'Sale ID is required'
      });
    }

    // Get entity to access its stream names
    const entity = config.entityStore.retailers[req.entity.id];

    if (!entity || !entity.streams || !entity.streams.sales) {
      return res.status(404).json({
        success: false,
        message: `Cannot find sales stream for retailer ${req.entity.id}`
      });
    }

    // Stream name for this retailer's sales
    const salesStreamName = entity.streams.sales;

    // Get the sale record
    const saleData = await executeCommand(
      'retailer-chain',
      `liststreamkeyitems ${salesStreamName} ${saleId}`
    );

    const sales = JSON.parse(saleData);

    if (!sales || sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sale record not found'
      });
    }

    // Get the most recent version of the sale record
    const latestSale = sales.reduce((latest, current) => {
      return latest.time > current.time ? latest : current;
    }, sales[0]);

    // Parse the sale record
    const saleRecord = JSON.parse(Buffer.from(latestSale.data, 'hex').toString());

    // Verify this retailer owns the sale record
    if (saleRecord.retailerId !== req.entity.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this sale record'
      });
    }

    // Check if the record has encrypted customer data
    if (!saleRecord.encryptedCustomerData) {
      return res.status(404).json({
        success: false,
        message: 'No encrypted customer data found for this sale'
      });
    }

    // Decrypt the customer data
    try {
      const customerData = decryptSensitiveData(saleRecord.encryptedCustomerData, req.entity.id);

      res.json({
        success: true,
        saleId,
        productId: saleRecord.productId,
        serialNumber: saleRecord.serialNumber,
        price: saleRecord.price,
        timestamp: saleRecord.timestamp,
        status: saleRecord.status,
        customerData
      });
    } catch (decryptError) {
      console.error('Failed to decrypt customer data:', decryptError);
      res.status(500).json({
        success: false,
        message: 'Failed to decrypt customer data',
        error: decryptError.message
      });
    }
  } catch (error) {
    console.error('Failed to retrieve customer data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer data',
      error: error.message
    });
  }
});

// Endpoint to get sales history
// Update the sales history endpoint to include all necessary data

app.get('/api/retailer/sales/history', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    // Get entity to access its stream names
    const entity = config.entityStore.retailers[req.entity.id];

    if (!entity || !entity.streams || !entity.streams.sales) {
      return res.status(404).json({
        success: false,
        message: `Cannot find sales stream for retailer ${req.entity.id}`
      });
    }

    // Stream name for this retailer's sales - get from entity data
    const streamName = entity.streams.sales;

    // Get all items in the sales stream
    const salesData = await executeCommand(
      'retailer-chain',
      `liststreamitems ${streamName}`
    );

    const sales = JSON.parse(salesData);

    if (!sales || sales.length === 0) {
      return res.json({
        success: true,
        sales: []
      });
    }

    // Process each sale to include all necessary information
    const formattedSales = sales.map(sale => {
      try {
        const saleData = JSON.parse(Buffer.from(sale.data, 'hex').toString());
        
        // Create a more complete sale object with all available information
        return {
          saleId: saleData.saleId,
          timestamp: saleData.timestamp,
          status: saleData.status || 'sold',
          customerName: saleData.customerName || 'Anonymous',
          items: saleData.items || [],
          itemCount: saleData.items ? saleData.items.length : 0,
          // Calculate total from items if available
          total: saleData.items 
            ? saleData.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0)
            : 0
        };
      } catch (error) {
        console.error('Error parsing sale data:', error);
        return null;
      }
    }).filter(sale => sale !== null);

    res.json({
      success: true,
      retailerId: req.entity.id,
      sales: formattedSales
    });
  } catch (error) {
    console.error('Failed to get sales history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sales history',
      error: error.message
    });
  }
});

//  endpoint to submit daily sales summary with encrypted financial data
app.post('/api/retailer/sales/daily-summary', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    const { date, salesData } = req.body;

    if (!date || !salesData) {
      return res.status(400).json({
        success: false,
        message: 'Date and sales data are required'
      });
    }

    // Generate a summary ID
    const summaryId = `summary-${date}-${crypto.randomBytes(4).toString('hex')}`;

    // Create public summary with non-sensitive data
    const publicSummary = {
      summaryId,
      retailerId: req.entity.id,
      date,
      itemsSold: salesData.itemCount || 0,
      timestamp: Date.now()
    };

    // Create sensitive data object with financial information
    const sensitiveSalesData = {
      totalSales: salesData.totalAmount || 0,
      revenue: salesData.revenue || 0,
      profitMargin: salesData.profitMargin || 0,
      productBreakdown: salesData.productBreakdown || {},
      paymentMethodBreakdown: salesData.paymentMethodBreakdown || {},
      transactionDetails: salesData.items || [],
      categoryPerformance: salesData.categoryPerformance || {},
      hourlyDistribution: salesData.hourlyDistribution || {},
      staffPerformance: salesData.staffPerformance || {},
      discountsApplied: salesData.discountsApplied || {},
      taxCollected: salesData.taxCollected || 0
    };

    // Encrypt sensitive sales data
    const encryptedSalesData = encryptSensitiveData(sensitiveSalesData, req.entity.id);

    // Create data reference for verification
    const salesDataReference = createDataReference(sensitiveSalesData);

    // Add reference to public data
    publicSummary.salesDataReference = salesDataReference;
    publicSummary.hasEncryptedData = true;

    // Create complete summary with encrypted data
    const completeSummary = {
      ...publicSummary,
      encryptedSalesData
    };

    // Generate a Merkle tree from the sales data for verification
    const salesItems = [];

    // If details are available, use them for the Merkle tree
    if (Array.isArray(salesData.items)) {
      salesItems.push(...salesData.items);
    } else {
      // Otherwise just use the summary data
      salesItems.push({
        date,
        itemsSold: salesData.itemCount || 0,
        salesDataReference
      });
    }

    const merkleTree = generateMerkleTree(salesItems);

    // Add Merkle root to both summaries
    publicSummary.merkleRoot = merkleTree.root;
    completeSummary.merkleRoot = merkleTree.root;

    // Convert complete summary to hex for retailer chain
    const hexData = Buffer.from(JSON.stringify(completeSummary)).toString('hex');

    // First check if the retailer_summaries stream exists and create it if it doesn't
    try {
      await executeCommand(
        'retailer-chain',
        'create stream retailer_summaries false'
      );
      console.log('Created retailer_summaries stream');
    } catch (streamError) {
      // If error is not about the stream already existing, rethrow
      if (!streamError.message.includes('already exists')) {
        throw streamError;
      }
    }

    // Publish complete summary with encrypted data to retailer chain
    const txid = await executeCommand(
      'retailer-chain',
      `publish retailer_summaries ${summaryId} ${hexData}`
    );

    // Publish only public data to main chain (without sensitive financial details)
    const mainChainData = {
      summaryId,
      retailerId: req.entity.id,
      date,
      itemsSold: salesData.itemCount || 0,
      merkleRoot: merkleTree.root,
      salesDataReference, // Only include reference hash
      timestamp: publicSummary.timestamp
    };

    const mainChainHexData = Buffer.from(JSON.stringify(mainChainData)).toString('hex');

    await executeCommand(
      'main-chain',
      `publish sidechain_merkle_roots ${summaryId} ${mainChainHexData}`
    );

    res.status(201).json({
      success: true,
      message: 'Daily sales summary recorded successfully',
      summaryId,
      date,
      merkleRoot: merkleTree.root,
      txid: txid.trim()
    });
  } catch (error) {
    console.error('Failed to record daily summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record daily summary',
      error: error.message
    });
  }
});

// endpoint to access encrypted sales summary data
app.get('/api/retailer/sales-summary/:summaryId/financial-data', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    const { summaryId } = req.params;

    if (!summaryId) {
      return res.status(400).json({
        success: false,
        message: 'Summary ID is required'
      });
    }

    // Get the summary record from retailer chain
    const summaryData = await executeCommand(
      'retailer-chain',
      `liststreamkeyitems retailer_summaries ${summaryId}`
    );

    const summaries = JSON.parse(summaryData);

    if (!summaries || summaries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Summary record not found'
      });
    }

    // Get the most recent summary record
    const latestSummary = summaries.reduce((latest, current) => {
      return latest.time > current.time ? latest : current;
    }, summaries[0]);

    // Parse the summary record
    const summaryRecord = JSON.parse(Buffer.from(latestSummary.data, 'hex').toString());

    // Verify this retailer owns the summary record
    if (summaryRecord.retailerId !== req.entity.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this sales summary'
      });
    }

    // Check if the record has encrypted sales data
    if (!summaryRecord.encryptedSalesData) {
      return res.status(404).json({
        success: false,
        message: 'No encrypted financial data found for this summary'
      });
    }

    // Decrypt the sales data
    try {
      const financialData = decryptSensitiveData(summaryRecord.encryptedSalesData, req.entity.id);

      res.json({
        success: true,
        summaryId,
        date: summaryRecord.date,
        itemsSold: summaryRecord.itemsSold,
        merkleRoot: summaryRecord.merkleRoot,
        timestamp: summaryRecord.timestamp,
        financialData
      });
    } catch (decryptError) {
      console.error('Failed to decrypt sales data:', decryptError);
      res.status(500).json({
        success: false,
        message: 'Failed to decrypt sales data',
        error: decryptError.message
      });
    }
  } catch (error) {
    console.error('Failed to retrieve sales summary data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales summary data',
      error: error.message
    });
  }
});

// Endpoint to process a customer return
app.post('/api/retailer/returns/process', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    const { saleId, productId, serialNumber, reason } = req.body;

    if (!saleId || !productId || !serialNumber || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Sale ID, product ID, serial number, and reason are required'
      });
    }

    // Get entity to access its stream names
    const entity = config.entityStore.retailers[req.entity.id];

    if (!entity || !entity.streams || !entity.streams.sales) {
      return res.status(404).json({
        success: false,
        message: `Cannot find sales stream for retailer ${req.entity.id}`
      });
    }

    // Stream name for this retailer's sales - get from entity config
    const streamName = entity.streams.sales;

    try {
      const saleData = await executeCommand(
        'retailer-chain',
        `liststreamkeyitems ${streamName} ${saleId}`
      );

      const sales = JSON.parse(saleData);

      if (!sales || sales.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sale record not found'
        });
      }

      // Get the most recent version of the sale
      const latestSale = sales.reduce(
        (latest, current) => (latest.time > current.time ? latest : current),
        sales[0]
      );
      
      const saleInfo = JSON.parse(Buffer.from(latestSale.data, 'hex').toString());
      
      // For multi-item sales, we need to check if the product is part of the items array
      let productFound = false;
      let serialNumberFound = false;
      
      if (saleInfo.items && Array.isArray(saleInfo.items)) {
        // Handle modern format with items array
        for (const item of saleInfo.items) {
          if (item.productId === productId) {
            productFound = true;
            
            // Check if serialNumber is in this item's serialNumbers
            if (item.serialNumbers && Array.isArray(item.serialNumbers)) {
              if (item.serialNumbers.includes(serialNumber)) {
                serialNumberFound = true;
                break;
              }
            } else if (item.serialNumber === serialNumber) {
              // For single serialNumber format
              serialNumberFound = true;
              break;
            }
          }
        }
      } else {
        // Handle legacy format (direct properties on sale object)
        if (saleInfo.productId === productId) {
          productFound = true;
          if (saleInfo.serialNumber === serialNumber || 
              (saleInfo.serialNumbers && saleInfo.serialNumbers.includes(serialNumber))) {
            serialNumberFound = true;
          }
        }
      }

      // Verify that the product details match
      if (!productFound || !serialNumberFound) {
        return res.status(400).json({
          success: false,
          message: 'Product details do not match sale record'
        });
      }

      // Check if the sale is already returned
      if (saleInfo.status === 'returned') {
        return res.status(400).json({
          success: false,
          message: 'This product has already been returned'
        });
      }
    } catch (error) {
      console.error('Failed to verify sale:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify sale',
        error: error.message
      });
    }

    // Generate a return ID
    const returnId = `return-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Create return record
    const returnRecord = {
      returnId,
      saleId,
      productId,
      serialNumber,
      reason,
      retailerId: req.entity.id,
      timestamp: Date.now(),
      status: 'returned'
    };

    // Get the returns stream from entity config
    if (!entity.streams.returns) {
      return res.status(404).json({
        success: false,
        message: `Cannot find returns stream for retailer ${req.entity.id}`
      });
    }

    const returnsStreamName = entity.streams.returns;

    // Convert to hex for blockchain storage
    const hexData = Buffer.from(JSON.stringify(returnRecord)).toString('hex');

    // Publish to retailer chain
    const txid = await executeCommand(
      'retailer-chain',
      `publish ${returnsStreamName} ${returnId} ${hexData}`
    );

    // Also update the sale status
    const saleUpdateData = {
      saleId,
      productId,
      serialNumber,
      retailerId: req.entity.id,
      status: 'returned',
      returnId,
      timestamp: returnRecord.timestamp
    };

    const saleUpdateHexData = Buffer.from(JSON.stringify(saleUpdateData)).toString('hex');

    await executeCommand(
      'retailer-chain',
      `publish ${streamName} ${saleId} ${saleUpdateHexData}`
    );

    // Add the product back to inventory
    const inventoryUpdate = await updateRetailerInventory(
      req.entity.id,
      productId,
      [serialNumber],
      'add'
    );

    res.status(201).json({
      success: true,
      message: 'Return processed successfully',
      returnId,
      saleId,
      productId,
      serialNumber,
      txid: txid.trim()
    });
  } catch (error) {
    console.error('Failed to process return:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process return',
      error: error.message
    });
  }
});

// Endpoint to get returns history
app.get('/api/retailer/returns/history', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    // Get entity to access its stream names
    const entity = config.entityStore.retailers[req.entity.id];

    if (!entity || !entity.streams || !entity.streams.returns) {
      return res.status(404).json({
        success: false,
        message: `Cannot find returns stream for retailer ${req.entity.id}`
      });
    }

    // Stream name for this retailer's returns
    const streamName = entity.streams.returns;

    // Get all items in the returns stream
    const returnsData = await executeCommand(
      'retailer-chain',
      `liststreamitems ${streamName}`
    );

    const returns = JSON.parse(returnsData);

    if (!returns || returns.length === 0) {
      return res.json({
        success: true,
        returns: []
      });
    }

    // Process each return
    const formattedReturns = returns.map(returnItem => {
      try {
        const returnData = JSON.parse(Buffer.from(returnItem.data, 'hex').toString());

        return {
          returnId: returnData.returnId,
          saleId: returnData.saleId,
          productId: returnData.productId,
          serialNumber: returnData.serialNumber,
          reason: returnData.reason,
          timestamp: returnData.timestamp,
          status: returnData.status
        };
      } catch (error) {
        console.error('Error parsing return data:', error);
        return null;
      }
    }).filter(returnItem => returnItem !== null);

    res.json({
      success: true,
      retailerId: req.entity.id,
      returns: formattedReturns
    });
  } catch (error) {
    console.error('Failed to get returns history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get returns history',
      error: error.message
    });
  }
});

// Add this new endpoint to get pending shipments for a retailer
app.get('/api/retailer/pending-shipments', authenticateRequest, async (req, res) => {
  try {
    // Verify that the authenticated entity is a retailer
    if (req.entityType !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'Only retailers can access this endpoint'
      });
    }

    // Get shipments from distributor chains that are intended for this retailer
    const retailerId = req.entity.id;
    
    // Get all distributors
    const distributors = Object.entries(config.entityStore.distributors);
    
    // Initialize array for shipments
    let pendingShipments = [];

    // Iterate through each distributor to find shipments for this retailer
    for (const [distributorId, distributor] of distributors) {
      try {
        // Get the distributor's transfers_out stream name
        let transfersOutStream = null;

        if (distributor && distributor.streams && distributor.streams.transfersOut) {
          transfersOutStream = distributor.streams.transfersOut;
        } else {
          // Fallback if stream name not found in entity data
          const entityCode = distributorId.split('-')[2] || crypto.randomBytes(2).toString('hex');
          transfersOutStream = `d${entityCode}out`;
        }

        console.log(`Checking distributor ${distributorId} stream ${transfersOutStream} for shipments to retailer ${retailerId}`);

        // Get all items in the transfers_out stream
        const shipmentsData = await executeCommand(
          'distributor-chain',
          `liststreamitems ${transfersOutStream}`
        );

        const shipments = JSON.parse(shipmentsData);

        if (shipments && shipments.length > 0) {
          // Filter for shipments intended for this retailer
          for (const shipment of shipments) {
            try {
              const shipmentData = JSON.parse(Buffer.from(shipment.data, 'hex').toString());
              
              if (shipmentData.retailerId === retailerId) {
                // Get product details
                let productName = 'Unknown Product';
                try {
                  const productData = await executeCommand(
                    'main-chain',
                    `liststreamkeyitems products ${shipmentData.productId}`
                  );
                  
                  const products = JSON.parse(productData);
                  if (products && products.length > 0) {
                    const productInfo = JSON.parse(Buffer.from(products[0].data, 'hex').toString());
                    productName = productInfo.name || productInfo.productId;
                  }
                } catch (err) {
                  console.error(`Error getting product details: ${err.message}`);
                }

                // Add to pending shipments
                pendingShipments.push({
                  shipmentId: shipmentData.shipmentId,
                  distributorId: distributorId,
                  distributorName: distributor.name || distributorId,
                  productId: shipmentData.productId,
                  productName: productName,
                  quantity: shipmentData.serialNumbers?.length || shipmentData.quantity || 0,
                  serialNumbers: shipmentData.serialNumbers || [],
                  status: shipmentData.status || 'shipped',
                  timestamp: shipmentData.timestamp,
                  createdAt: shipmentData.timestamp || shipment.time * 1000
                });
              }
            } catch (parseError) {
              console.error(`Error parsing shipment data: ${parseError.message}`);
            }
          }
        }
      } catch (distributorError) {
        console.error(`Error getting shipments from distributor ${distributorId}: ${distributorError.message}`);
        // Continue with next distributor
      }
    }

    // Sort by timestamp (newest first)
    pendingShipments.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      success: true,
      shipments: pendingShipments
    });
  } catch (error) {
    console.error('Failed to get pending shipments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending shipments',
      error: error.message
    });
  }
});

// Update the product verification endpoint to include retailer data and Merkle proof verification
app.get('/api/verify/product/:serialNumber', async (req, res) => {
  try {
    const { serialNumber } = req.params;

    if (!serialNumber) {
      return res.status(400).json({
        success: false,
        message: 'Serial number is required'
      });
    }

    console.log(`Verifying product with serial number: ${serialNumber}`);

    // Find the product this serial number belongs to by searching all product batches
    const allProductsData = await executeCommand(
      'main-chain',
      'liststreamitems product_serial_numbers'
    );

    const allProducts = JSON.parse(allProductsData);

    let productId = null;
    let serialBatch = null;
    let exactMatch = false;

    // ONLY search for an EXACT match in product registrations
    for (const product of allProducts) {
      try {
        const batchData = JSON.parse(Buffer.from(product.data, 'hex').toString());

        if (batchData.serialBatch && batchData.serialBatch.includes(serialNumber)) {
          productId = batchData.productId;
          serialBatch = batchData.serialBatch;
          exactMatch = true;
          console.log(`Found exact match for serial number ${serialNumber} in product ${productId}`);
          break;
        }
      } catch (error) {
        console.error('Error parsing product data:', error);
        // Continue to next product
      }
    }

    // If not found in product registrations, don't continue
    if (!exactMatch) {
      return res.status(404).json({
        success: false,
        message: 'Product not found. The serial number you entered does not match any registered product.'
      });
    }

    // Get product details
    const productData = await executeCommand(
      'main-chain',
      `liststreamkeyitems products ${productId}`
    );

    const products = JSON.parse(productData);

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product details not found'
      });
    }

    // Get the most recent version if multiple entries exist
    const latestProduct = products.reduce((latest, current) => {
      return latest.time > current.time ? latest : current;
    }, products[0]);

    // Convert hex data to JSON - STORE THIS SAFELY
    const productInfo = JSON.parse(Buffer.from(latestProduct.data, 'hex').toString());
    
    // Make sure we have basic product info properties to avoid errors
    if (!productInfo.name) productInfo.name = "Unknown product";
    if (!productInfo.description) productInfo.description = "";
    if (!productInfo.category) productInfo.category = "Unknown";
    if (!productInfo.manufacturerId) productInfo.manufacturerId = "unknown";
    if (!productInfo.manufacturerName) productInfo.manufacturerName = "Unknown manufacturer";
    if (!productInfo.specifications) productInfo.specifications = {};

    // Generate a Merkle proof to verify this serial number's authenticity
    let merkleVerification = {
      isAuthentic: false,
      proofAvailable: false,
      rootMatchesRegistration: false
    };

    if (serialBatch) {
      // Create items for Merkle tree
      const productItems = serialBatch.map((serial, index) => ({
        serialNumber: serial,
        productId,
        index
      }));

      // Build Merkle tree from product serial numbers
      const merkleTree = generateMerkleTree(productItems);

      // Get the index of our serial number
      const serialIndex = serialBatch.indexOf(serialNumber);

      if (serialIndex !== -1) {
        // Generate proof for this serial number
        const proof = generateMerkleProof(merkleTree, serialIndex);

        // Verify the proof
        const itemToVerify = {
          serialNumber,
          productId,
          index: serialIndex
        };

        const isValid = verifyMerkleProof(merkleTree.root, proof, itemToVerify);

        merkleVerification = {
          isAuthentic: isValid,
          merkleRoot: merkleTree.root,
          productRegisteredRoot: productInfo.serialNumbersMerkleRoot,
          proofAvailable: true,
          rootMatchesRegistration: merkleTree.root === productInfo.serialNumbersMerkleRoot
        };
      }
    }

    // If not authentic based on Merkle verification, fail the verification 
    if (merkleVerification.proofAvailable && !merkleVerification.isAuthentic) {
      return res.status(400).json({
        success: false,
        message: 'Product verification failed. This may be a counterfeit product.',
        serialNumber,
        productId,
        authenticity: merkleVerification
      });
    }

    // Determine the current location of the product
    // Default to manufacturer (start of supply chain)
    let currentLocation = { type: 'manufacturer', status: 'produced' };
    let allTransactions = [];

    console.log(`Searching for transactions involving serial number: ${serialNumber}`);
    
    try {
      // Get retailer transactions
      const retailerTxs = await executeCommand(
        'retailer-chain',
        'liststreamitems retailer_transactions'
      );
      
      const retailTxsArray = JSON.parse(retailerTxs);
      console.log(`Found ${retailTxsArray.length} potential retailer transactions to check`);
      
      for (const tx of retailTxsArray) {
        try {
          const txData = JSON.parse(Buffer.from(tx.data, 'hex').toString());
          const txTimestamp = tx.time * 1000;
          const timestamp = txData.timestamp || txTimestamp;
          
          let hasSerialNumber = false;
          
          if (txData.serialNumber === serialNumber) {
            hasSerialNumber = true;
          }
          
          if (Array.isArray(txData.serialNumbers) && txData.serialNumbers.includes(serialNumber)) {
            hasSerialNumber = true;
          }
          
          if (Array.isArray(txData.items)) {
            for (const item of txData.items) {
              if (item.serialNumber === serialNumber) {
                hasSerialNumber = true;
                break;
              }
              if (Array.isArray(item.serialNumbers) && item.serialNumbers.includes(serialNumber)) {
                hasSerialNumber = true;
                break;
              }
            }
          }
          
          if (hasSerialNumber) {
            console.log(`Found retailer transaction with serial ${serialNumber}, type: ${txData.status || 'unknown'}, timestamp: ${new Date(timestamp).toISOString()}`);
            
            allTransactions.push({
              chain: 'retailer',
              timestamp,
              data: txData,
              blockTime: txTimestamp
            });
          }
        } catch (e) {
          // Continue to next transaction
        }
      }

      // Get distributor transactions
      const distributorTxs = await executeCommand(
        'distributor-chain',
        'liststreamitems distributor_transactions'
      );
      
      const distTxsArray = JSON.parse(distributorTxs);
      console.log(`Found ${distTxsArray.length} potential distributor transactions to check`);
      
      for (const tx of distTxsArray) {
        try {
          const txData = JSON.parse(Buffer.from(tx.data, 'hex').toString());
          const txTimestamp = tx.time * 1000;
          const timestamp = txData.timestamp || txTimestamp;
          
          let hasSerialNumber = false;
          
          if (txData.serialNumber === serialNumber) {
            hasSerialNumber = true;
          }
          
          if (Array.isArray(txData.serialNumbers) && txData.serialNumbers.includes(serialNumber)) {
            hasSerialNumber = true;
          }
          
          if (hasSerialNumber) {
            console.log(`Found distributor transaction with serial ${serialNumber}, type: ${txData.status || 'unknown'}, timestamp: ${new Date(timestamp).toISOString()}`);
            
            allTransactions.push({
              chain: 'distributor',
              timestamp,
              data: txData,
              blockTime: txTimestamp
            });
          }
        } catch (e) {
          // Continue to next transaction
        }
      }
      
      // Sort all transactions by timestamp, newest first (keep this for the transaction history)
      allTransactions.sort((a, b) => {
        const aTime = a.timestamp || a.blockTime;
        const bTime = b.timestamp || b.blockTime;
        return bTime - aTime;
      });
      
      // NEW LOGIC: Prioritize supply chain stage over timestamp
      // Stage priority: customer (sold) > retailer (returned) > retailer (in_stock) > in_transit > distributor > manufacturer
      
      // Find transactions for each stage
      const customerSale = allTransactions.find(tx => 
        tx.chain === 'retailer' && tx.data.status === 'sold');
      
      const productReturn = allTransactions.find(tx => 
        tx.chain === 'retailer' && tx.data.status === 'returned');
      
      const inRetailerInventory = allTransactions.find(tx => 
        tx.chain === 'retailer' && (
          tx.data.status === 'received' || 
          tx.data.status === 'add' || 
          (tx.data.retailerId && (tx.data.operation === 'add' || !tx.data.operation))
        )
      );

      const inTransit = allTransactions.find(tx => 
        tx.chain === 'distributor' && tx.data.status === 'shipped' && tx.data.retailerId);
      
      const inDistributor = allTransactions.find(tx => 
        tx.chain === 'distributor' && (
          tx.data.status === 'received' || 
          (tx.data.distributorId && (tx.data.operation === 'add' || !tx.data.operation))
        )
      );
      
      // Apply priority-based location determination
      // If a product is sold and not returned, it's with a customer
      if (customerSale && !productReturn) {
        currentLocation = {
          type: 'customer',
          status: 'sold',
          saleId: customerSale.data.saleId,
          timestamp: customerSale.timestamp || customerSale.blockTime
        };
      } 
      // If returned or in retailer inventory, it's at the retailer
      else if (productReturn) {
        currentLocation = {
          type: 'retailer',
          status: 'returned',
          entityId: productReturn.data.retailerId,
          returnId: productReturn.data.returnId,
          timestamp: productReturn.timestamp || productReturn.blockTime
        };
      }
      else if (inRetailerInventory) {
        currentLocation = {
          type: 'retailer',
          status: 'in_stock',
          entityId: inRetailerInventory.data.retailerId,
          timestamp: inRetailerInventory.timestamp || inRetailerInventory.blockTime
        };
      }
      // If in transit, it's between distributor and retailer
      else if (inTransit) {
        currentLocation = {
          type: 'in_transit',
          status: 'shipping',
          from: inTransit.data.distributorId,
          to: inTransit.data.retailerId,
          timestamp: inTransit.timestamp || inTransit.blockTime
        };
      }
      // If in distributor inventory, it's at the distributor
      else if (inDistributor) {
        currentLocation = {
          type: 'distributor',
          status: 'in_stock',
          entityId: inDistributor.data.distributorId,
          timestamp: inDistributor.timestamp || inDistributor.blockTime
        };
      }
      // Otherwise, it's still at the manufacturer (default)
    } catch (error) {
      console.error('Error checking product location:', error);
    }

    console.log(`Final product location determination: ${JSON.stringify(currentLocation)}`);

    // Send the response with all product details and location
    res.json({
      success: true,
      serialNumber,
      productId,
      productInfo: {
        name: productInfo.name,
        description: productInfo.description,
        category: productInfo.category,
        manufacturer: {
          id: productInfo.manufacturerId,
          name: productInfo.manufacturerName
        },
        specifications: productInfo.specifications || {}
      },
      currentLocation,
      verificationTimestamp: Date.now(),
      authenticity: merkleVerification,
      transactionCount: allTransactions.length,
      transactionHistory: allTransactions.slice(0, 5).map(tx => ({
        chain: tx.chain,
        status: tx.data.status || 'unknown',
        timestamp: new Date(tx.timestamp || tx.blockTime).toISOString()
      }))
    });
  } catch (error) {
    console.error('Failed to verify product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify product',
      error: error.message
    });
  }
});

// Add a dedicated endpoint for full Merkle proof verification
app.get('/api/verify/product/:serialNumber/merkle-proof', async (req, res) => {
  try {
    const { serialNumber } = req.params;

    if (!serialNumber) {
      return res.status(400).json({
        success: false,
        message: 'Serial number is required'
      });
    }

    // Find the product this serial number belongs to
    let productId = null;
    let serialBatch = null;

    // Get product details from main chain - replicating exact search logic as product registration
    const serialData = await executeCommand(
      'main-chain',
      'liststreamitems product_serial_numbers'
    );

    const allBatches = JSON.parse(serialData);

    // Search through all batches exactly as done during registration
    for (const batch of allBatches) {
      try {
        const batchData = JSON.parse(Buffer.from(batch.data, 'hex').toString());
        if (batchData.serialBatch && batchData.serialBatch.includes(serialNumber)) {
          productId = batchData.productId;
          serialBatch = batchData.serialBatch;
          break;
        }
      } catch (error) {
        console.error('Error parsing batch data:', error);
      }
    }

    if (!productId) {
      return res.status(404).json({
        success: false,
        message: 'Serial number not found in any product'
      });
    }

    // Get product details
    const productData = await executeCommand(
      'main-chain',
      `liststreamkeyitems products ${productId}`
    );

    const products = JSON.parse(productData);

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get the most recent version
    const latestProduct = products.reduce((latest, current) => {
      return latest.time > current.time ? latest : current;
    }, products[0]);

    const productInfo = JSON.parse(Buffer.from(latestProduct.data, 'hex').toString());

    // Create items in EXACTLY THE SAME FORMAT as during registration
    const serialItems = serialBatch.map((serial, index) => ({
      serialNumber: serial,
      productId,
      index
    }));

    // Generate the Merkle tree using the exact same format and order
    const merkleTree = generateMerkleTree(serialItems);

    // Generate proof
    const serialIndex = serialBatch.indexOf(serialNumber);

    if (serialIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Serial number not found in the product batch'
      });
    }

    const proof = generateMerkleProof(merkleTree, serialIndex);

    // Verify the proof using EXACTLY the same item format
    const itemToVerify = {
      serialNumber,
      productId,
      index: serialIndex
    };

    const isValid = verifyMerkleProof(merkleTree.root, proof, itemToVerify);

    // Compare with stored root from product registration
    const registeredRoot = productInfo.serialNumbersMerkleRoot || '';
    const calculatedRoot = merkleTree.root;
    const rootsMatch = registeredRoot === calculatedRoot;

    res.json({
      success: true,
      product: serialNumber,
      verified: isValid,
      merkleRoot: calculatedRoot,
      registeredRoot: registeredRoot,
      rootsMatch: rootsMatch,
      proof: {
        siblings: proof.siblings || [],
        path: proof.path || []
      },
      productName: productInfo.name || "Unknown product",
      productId: productId,
      manufacturer: productInfo.manufacturerName || "Unknown manufacturer",
      verificationTimestamp: Date.now(),
      message: `Product ${serialNumber} verified with Merkle proof successfully`
    });
  } catch (error) {
    console.error('Failed to verify product with Merkle proof:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Merkle proof',
      error: error.message
    });
  }
});


// Now update your existing entities to have the proper streams
app.post('/api/fix-retailer-streams', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    // Basic security check - require API key for system admin
    if (apiKey !== config.systemSecret) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Fix all retailer entities
    const updatedRetailers = [];
    
    for (const [retailerId, retailer] of Object.entries(config.entityStore.retailers)) {
      try {
        // Ensure this retailer has all required streams
        const retailerStreams = await ensureRetailerStreams(retailerId);
        
        // Update the entity in the store
        config.entityStore.retailers[retailerId] = {
          ...retailer,
          streams: {
            ...retailer.streams,
            ...retailerStreams
          }
        };
        
        updatedRetailers.push({
          id: retailerId,
          name: retailer.name,
          updatedStreams: retailerStreams
        });
      } catch (retailerError) {
        console.error(`Error fixing streams for retailer ${retailerId}: ${retailerError.message}`);
      }
    }
    
    // Save updated entities to disk
    await saveEntitiesToDisk();
    
    res.json({
      success: true,
      message: 'Retailer streams fixed',
      updatedRetailers
    });
  } catch (error) {
    console.error('Failed to fix retailer streams:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix retailer streams',
      error: error.message
    });
  }
});

// Fix the ensureRetailerStreams function
const ensureRetailerStreams = async (retailerId) => {
  try {
    // Create a short code for stream names
    const entityCode = retailerId.split('-')[2] || crypto.randomBytes(2).toString('hex');
    
    const retailerStreams = {
      inventory: `r${entityCode}inv`,
      sales: `r${entityCode}sales`,
      returns: `r${entityCode}returns`
    };
    
    // Create the inventory stream if it doesn't exist
    try {
      await executeCommand(
        'retailer-chain',
        `create stream ${retailerStreams.inventory} {}`
      );
      console.log(`Created inventory stream ${retailerStreams.inventory} for retailer ${retailerId}`);
    } catch (err) {
      // If error is because stream already exists, that's fine
      if (!err.message.includes('Stream with this name already exists')) {
        console.error(`Error creating inventory stream: ${err.message}`);
        throw err;
      }
    }
    
    // Create the sales stream if it doesn't exist
    try {
      await executeCommand(
        'retailer-chain',
        `create stream ${retailerStreams.sales} {}`
      );
    } catch (err) {
      if (!err.message.includes('Stream with this name already exists')) {
        console.error(`Error creating sales stream: ${err.message}`);
        throw err;
      }
    }
    
    // Create the returns stream if it doesn't exist
    try {
      await executeCommand(
        'retailer-chain',
        `create stream ${retailerStreams.returns} {}`
      );
    } catch (err) {
      if (!err.message.includes('Stream with this name already exists')) {
        console.error(`Error creating returns stream: ${err.message}`);
        throw err;
      }
    }
    
    // Subscribe to all streams
    try {
      await executeCommand(
        'retailer-chain',
        `subscribe ${retailerStreams.inventory}`
      );
      await executeCommand(
        'retailer-chain',
        `subscribe ${retailerStreams.sales}`
      );
      await executeCommand(
        'retailer-chain',
        `subscribe ${retailerStreams.returns}`
      );
    } catch (err) {
      console.error(`Error subscribing to streams: ${err.message}`);
      // Continue even if subscription fails
    }
    
    // Update the entity store with the stream names
    if (config.entityStore.retailers[retailerId]) {
      config.entityStore.retailers[retailerId].streams = {
        ...config.entityStore.retailers[retailerId].streams,
        ...retailerStreams
      };
      
      // Save to disk to persist the changes
      await saveEntitiesToDisk();
    }
    
    return retailerStreams;
  } catch (error) {
    console.error(`Failed to ensure streams for retailer ${retailerId}:`, error);
    throw error;
  }
};
// Now update your existing entities to have the proper streams
app.post('/api/fix-retailer-streams', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    // Basic security check - require API key for system admin
    if (apiKey !== config.systemSecret) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Fix all retailer entities
    const updatedRetailers = [];
    
    for (const [retailerId, retailer] of Object.entries(config.entityStore.retailers)) {
      try {
        // Ensure this retailer has all required streams
        const retailerStreams = await ensureRetailerStreams(retailerId);
        
        // Update the entity in the store
        config.entityStore.retailers[retailerId] = {
          ...retailer,
          streams: {
            ...retailer.streams,
            ...retailerStreams
          }
        };
        
        updatedRetailers.push({
          id: retailerId,
          name: retailer.name,
          updatedStreams: retailerStreams
        });
      } catch (retailerError) {
        console.error(`Error fixing streams for retailer ${retailerId}: ${retailerError.message}`);
      }
    }
    
    // Save updated entities to disk
    await saveEntitiesToDisk();
    
    res.json({
      success: true,
      message: 'Retailer streams fixed',
      updatedRetailers
    });
  } catch (error) {
    console.error('Failed to fix retailer streams:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix retailer streams',
      error: error.message
    });
  }
});

// Export everything needed for testing
export {
  executeCommand,
  rpcCall,
  config,
  startup,
  generateMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  verifyItemInMerkleTree,
  registerEntity,
  generateSerialNumbers,
  validateSerialNumbers,
  authenticateRequest,
  updateDistributorInventory,
  getDistributorInventoryForProduct,
  verifyDistributorProductOwnership,
  updateRetailerInventory,
  getRetailerInventoryForProduct,
  verifyRetailerProductOwnership
};

console.log('Relay service starting up...');