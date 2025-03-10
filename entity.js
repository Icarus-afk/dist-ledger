/**
 * Entity Management Module - ES6 Version
 * 
 * This module fetches and manages supply chain entities and their credentials
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import crypto from 'crypto';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory for storing entity data
const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_FILE = path.join(DATA_DIR, 'entities.json');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');

// API endpoints configuration
const API_CONFIG = {
  baseUrl: 'localhost:3000',
  endpoints: {
    manufacturers: '/api/manufacturers',
    distributors: '/api/distributors',
    retailers: '/api/retailers',
    admins: '/api/admins',
  },
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.API_KEY || 'default-api-key',
  }
};

/**
 * Ensure data directory exists
 */
const ensureDataDir = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`Data directory created at: ${DATA_DIR}`);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('Error creating data directory:', error);
      throw error;
    }
  }
};

/**
 * Fetch data from an API endpoint
 */
const fetchFromApi = async (endpoint, options = {}) => {
  try {
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: API_CONFIG.headers,
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching from API (${endpoint}):`, error);
    // For demo/development, return mock data if API fails
    return getMockData(endpoint);
  }
};

/**
 * Get mock data when API is unavailable (for development)
 */
const getMockData = (endpoint) => {
  // Extract entity type from endpoint
  const entityType = endpoint.split('/').pop();
  
  // Generate 3 mock entities of this type
  const mockEntities = Array(3).fill().map((_, index) => {
    const id = `${entityType.slice(0, -1)}-${Date.now()}-${index}`;
    return {
      id,
      type: entityType.slice(0, -1), // Remove the 's' to get singular form
      name: `Mock ${entityType.slice(0, -1).charAt(0).toUpperCase() + entityType.slice(0, -1).slice(1)} ${index + 1}`,
      contactInfo: {
        email: `contact@mock${entityType}${index + 1}.com`,
        phone: `555-000-${index + 1}${index + 1}${index + 1}${index + 1}`
      },
      location: `Mock Location ${index + 1}`,
      apiKey: crypto.randomBytes(16).toString('hex')
    };
  });
  
  return { data: mockEntities };
};

/**
 * Load entities from file or return empty object
 */
const loadEntities = async () => {
  try {
    const data = await fs.readFile(ENTITIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {}; // File doesn't exist yet
    }
    console.error('Error loading entities:', error);
    return {};
  }
};

/**
 * Load credentials from file or return empty object
 */
const loadCredentials = async () => {
  try {
    const data = await fs.readFile(CREDENTIALS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        manufacturers: {},
        distributors: {},
        retailers: {},
        admins: {}
      };
    }
    console.error('Error loading credentials:', error);
    return {
      manufacturers: {},
      distributors: {},
      retailers: {},
      admins: {}
    };
  }
};

/**
 * Save entities to file
 */
const saveEntities = async (entities) => {
  try {
    await fs.writeFile(ENTITIES_FILE, JSON.stringify(entities, null, 2), 'utf8');
    console.log('Entities saved to:', ENTITIES_FILE);
    return true;
  } catch (error) {
    console.error('Error saving entities:', error);
    return false;
  }
};

/**
 * Save credentials to file
 */
const saveCredentials = async (credentials) => {
  try {
    await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf8');
    console.log('Credentials saved to:', CREDENTIALS_FILE);
    return true;
  } catch (error) {
    console.error('Error saving credentials:', error);
    return false;
  }
};

/**
 * Fetch all entities from APIs and save locally
 */
const fetchAndSaveAllEntities = async () => {
  await ensureDataDir();
  
  // Container for all entities
  const allEntities = {};
  
  // Container for all credentials
  const allCredentials = {
    manufacturers: {},
    distributors: {},
    retailers: {},
    admins: {}
  };
  
  // Fetch from each endpoint
  for (const [entityType, endpoint] of Object.entries(API_CONFIG.endpoints)) {
    console.log(`Fetching ${entityType}...`);
    
    try {
      const response = await fetchFromApi(endpoint);
      
      if (response && response.data) {
        allEntities[entityType] = response.data;
        
        // Generate and store credentials for each entity
        for (const entity of response.data) {
          // Generate a default password
          const defaultPassword = `${entityType.slice(0, -1)}123`;
          
          // Store credentials
          allCredentials[entityType][entity.id] = {
            id: entity.id,
            username: entity.id, // Use ID as username
            password: defaultPassword,
            apiKey: entity.apiKey || crypto.randomBytes(16).toString('hex')
          };
        }
      }
    } catch (error) {
      console.error(`Error fetching ${entityType}:`, error);
    }
  }
  
  // Save entities and credentials
  await saveEntities(allEntities);
  await saveCredentials(allCredentials);
  
  return {
    entities: allEntities,
    credentials: allCredentials
  };
};

/**
 * Generate password for an entity
 */
const generateEntityPassword = (entityType) => {
  // Simple function to generate a password - can be made more sophisticated
  const basePassword = entityType.slice(0, 4).toLowerCase();
  const randomPart = Math.floor(1000 + Math.random() * 9000); // 4-digit number
  return `${basePassword}${randomPart}`;
};

/**
 * Create a new entity with credentials
 */
const createEntity = async (entityType, details) => {
  if (!['manufacturer', 'distributor', 'retailer', 'admin'].includes(entityType)) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }
  
  if (!details.name) {
    throw new Error('Entity must have a name');
  }
  
  // Generate credentials
  const id = `${entityType}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const password = details.password || generateEntityPassword(entityType);
  const apiKey = crypto.randomBytes(16).toString('hex');
  
  // Create entity object
  const entity = {
    id,
    type: entityType,
    name: details.name,
    contactInfo: details.contactInfo || {},
    location: details.location || '',
    apiKey,
    createdAt: Date.now()
  };
  
  // Load existing data
  const entities = await loadEntities();
  const credentials = await loadCredentials();
  
  // Add entity
  const pluralType = `${entityType}s`;
  entities[pluralType] = entities[pluralType] || [];
  entities[pluralType].push(entity);
  
  // Add credentials
  credentials[pluralType][id] = {
    id,
    username: id, // Use ID as username
    password,
    apiKey
  };
  
  // Save updated data
  await saveEntities(entities);
  await saveCredentials(credentials);
  
  return {
    ...entity,
    password // Include password in the response, but not in stored entities
  };
};

/**
 * Authenticate an entity
 */
const authenticateEntity = async (id, password) => {
  const credentials = await loadCredentials();
  
  // Check each entity type
  for (const [type, entityCredentials] of Object.entries(credentials)) {
    if (id in entityCredentials) {
      // Check password
      if (entityCredentials[id].password === password) {
        return {
          id,
          type: type.slice(0, -1), // Remove the 's' to get singular form
          authenticated: true,
          apiKey: entityCredentials[id].apiKey
        };
      }
      // Password incorrect
      return { authenticated: false, error: 'Invalid password' };
    }
  }
  
  // Entity ID not found
  return { authenticated: false, error: 'Entity ID not found' };
};

/**
 * List all entities with their credentials
 */
const listAllEntitiesWithCredentials = async () => {
  const entities = await loadEntities();
  const credentials = await loadCredentials();
  
  const result = {};
  
  // Merge entities with their credentials
  for (const [type, entityList] of Object.entries(entities)) {
    result[type] = entityList.map(entity => {
      const entityCredentials = credentials[type]?.[entity.id];
      return {
        ...entity,
        username: entityCredentials?.username || entity.id,
        password: entityCredentials?.password || '(no password)',
        apiKey: entityCredentials?.apiKey || entity.apiKey || '(no API key)'
      };
    });
  }
  
  return result;
};

// Main execution function
const main = async () => {
  console.log('Fetching and saving entities...');
  await fetchAndSaveAllEntities();
  
  // Create sample entities if none exist (for demo purposes)
  const entities = await loadEntities();
  const hasManufacturers = entities.manufacturers && entities.manufacturers.length > 0;
  const hasDistributors = entities.distributors && entities.distributors.length > 0;
  const hasRetailers = entities.retailers && entities.retailers.length > 0;
  const hasAdmins = entities.admins && entities.admins.length > 0;
  
  if (!hasManufacturers) {
    console.log('Creating sample manufacturer...');
    await createEntity('manufacturer', {
      name: 'TechCorp Manufacturing',
      contactInfo: { email: 'tech@example.com', phone: '555-123-4567' },
      location: 'San Jose, CA'
    });
  }
  
  if (!hasDistributors) {
    console.log('Creating sample distributor...');
    await createEntity('distributor', {
      name: 'Global Distribution Inc.',
      contactInfo: { email: 'global@example.com', phone: '555-765-4321' },
      location: 'Chicago, IL'
    });
  }
  
  if (!hasRetailers) {
    console.log('Creating sample retailer...');
    await createEntity('retailer', {
      name: 'City Electronics Store',
      contactInfo: { email: 'city@example.com', phone: '555-987-6543' },
      location: 'New York, NY'
    });
  }
  
  if (!hasAdmins) {
    console.log('Creating admin user...');
    await createEntity('admin', {
      name: 'System Administrator',
      contactInfo: { email: 'admin@distledger.com' },
      password: 'admin1234' // Fixed password for admin
    });
  }
  
  // Display all entities with credentials
  const allEntities = await listAllEntitiesWithCredentials();
  console.log('\nEntities and Login Credentials:');
  console.log('===============================');
  for (const [type, entityList] of Object.entries(allEntities)) {
    console.log(`\n${type.toUpperCase()}:`);
    entityList.forEach((entity, index) => {
      console.log(`\n  ${index + 1}. ${entity.name}`);
      console.log(`     ID: ${entity.id}`);
      console.log(`     Username: ${entity.username}`);
      console.log(`     Password: ${entity.password}`);
      console.log(`     API Key: ${entity.apiKey}`);
    });
  }
  console.log('\n===============================');
  console.log(`Entities saved to: ${ENTITIES_FILE}`);
  console.log(`Credentials saved to: ${CREDENTIALS_FILE}`);
};

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error in main execution:', error);
    process.exit(1);
  });
}

// Export functions for use in other modules
export {
  fetchAndSaveAllEntities,
  createEntity,
  authenticateEntity,
  loadEntities,
  loadCredentials,
  listAllEntitiesWithCredentials
};