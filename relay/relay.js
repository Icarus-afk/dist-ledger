import express from 'express';
import { spawn } from 'child_process';
import crypto from 'crypto';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// Add logging
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'access.log'), 
    { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

const PROJECT_DIR = "/home/lothrok/Documents/projects/dist-ledger";

/**
 * Execute a MultiChain command and return the result as a Promise
 */
function executeCommand(chain, command, node = 0) {
    return new Promise((resolve, reject) => {
        let dataDir = PROJECT_DIR + '/data/' + chain;
        
        // Handle node-specific operations
        if (node > 0) {
            dataDir = PROJECT_DIR + '/data/' + chain + '-node' + node;
        }
        
        const cmdArgs = [
            '-datadir=' + dataDir,
            chain,
            ...command.split(' ')
        ];
        
        const process = spawn('multichain-cli', cmdArgs);
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        process.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            } else {
                try {
                    // Try to parse as JSON
                    resolve(JSON.parse(stdout));
                } catch (error) {
                    // Return as plain text if not valid JSON
                    resolve(stdout);
                }
            }
        });
    });
}

/**
 * Get a block and its Merkle root
 */
async function getBlockMerkleRoot(chain, blockHash) {
    try {
        const block = await executeCommand(chain, `getblock ${blockHash} 1`);
        return {
            blockHash: blockHash,
            merkleRoot: block.merkleroot,
            timestamp: block.time,
            height: block.height
        };
    } catch (error) {
        console.error(`Error getting block Merkle root for ${chain}:`, error);
        throw error;
    }
}

/**
 * Create a simple Merkle tree from an array of transactions
 */
function createMerkleTree(transactions) {
    // Hash each transaction
    let leaves = transactions.map(tx => crypto.createHash('sha256').update(JSON.stringify(tx)).digest('hex'));
    
    // Build the tree
    while (leaves.length > 1) {
        const newLevel = [];
        
        for (let i = 0; i < leaves.length; i += 2) {
            if (i + 1 < leaves.length) {
                // Hash the pair
                const combinedHash = crypto.createHash('sha256')
                    .update(leaves[i] + leaves[i + 1])
                    .digest('hex');
                newLevel.push(combinedHash);
            } else {
                // Odd number of leaves, duplicate the last one
                const combinedHash = crypto.createHash('sha256')
                    .update(leaves[i] + leaves[i])
                    .digest('hex');
                newLevel.push(combinedHash);
            }
        }
        
        leaves = newLevel;
    }
    
    return leaves[0] || '';
}

/**
 * API endpoint to publish a Merkle root from a sidechain to the main chain
 */
app.post('/api/relay/merkleroot', async (req, res) => {
    try {
        const { sourceChain, blockHash } = req.body;
        
        // Validate request
        if (!sourceChain || !blockHash) {
            return res.status(400).json({
                success: false,
                message: 'Missing sourceChain or blockHash'
            });
        }
        
        if (!['distributor-chain', 'retailer-chain'].includes(sourceChain)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sourceChain. Must be distributor-chain or retailer-chain'
            });
        }
        
        // Get the Merkle root from the block
        const blockInfo = await getBlockMerkleRoot(sourceChain, blockHash);
        
        // Create data for storage
        const data = {
            sourceChain,
            blockHash: blockInfo.blockHash,
            merkleRoot: blockInfo.merkleRoot,
            blockHeight: blockInfo.height,
            timestamp: Date.now()
        };
        
        // Generate a key for the data
        const key = `${sourceChain}_block_${blockInfo.height}`;
        
        // Convert data to hex format
        const hexData = Buffer.from(JSON.stringify(data)).toString('hex');
        
        // Publish to main chain
        const result = await executeCommand(
            'main-chain', 
            `publish sidechain_merkle_roots ${key} ${hexData}`
        );
        
        // Also store in source chain for reference
        await executeCommand(
            sourceChain,
            `publish merkle_roots ${key} ${hexData}`
        );
        
        res.status(200).json({
            success: true,
            message: 'Merkle root relayed to main chain',
            data: {
                transaction: result,
                merkleRoot: blockInfo.merkleRoot,
                sourceChain,
                blockHash: blockInfo.blockHash
            }
        });
        
    } catch (error) {
        console.error('Error in /api/relay/merkleroot:', error);
        res.status(500).json({
            success: false,
            message: 'Error relaying Merkle root',
            error: error.message
        });
    }
});

/**
 * API endpoint to verify a transaction using a Merkle proof
 */
app.post('/api/relay/verify', async (req, res) => {
    try {
        const { sourceChain, blockHash, transactionId, proof } = req.body;
        
        // Validate request
        if (!sourceChain || !blockHash || !transactionId || !proof) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters'
            });
        }
        
        // Get the Merkle root from the main chain
        const items = await executeCommand(
            'main-chain',
            `liststreamitems sidechain_merkle_roots ${sourceChain}_block_*`
        );
        
        // Find the relevant item
        const item = items.find(item => {
            const data = JSON.parse(Buffer.from(item.data, 'hex').toString());
            return data.blockHash === blockHash;
        });
        
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Merkle root not found on main chain'
            });
        }
        
        const storedData = JSON.parse(Buffer.from(item.data, 'hex').toString());
        const { merkleRoot } = storedData;
        
        // Verify the proof against the Merkle root
        let currentHash = crypto.createHash('sha256').update(transactionId).digest('hex');
        
        for (const step of proof) {
            if (step.position === 'left') {
                currentHash = crypto.createHash('sha256')
                    .update(step.hash + currentHash)
                    .digest('hex');
            } else {
                currentHash = crypto.createHash('sha256')
                    .update(currentHash + step.hash)
                    .digest('hex');
            }
        }
        
        const isValid = currentHash === merkleRoot;
        
        // Record verification result
        const verificationData = {
            sourceChain,
            blockHash,
            transactionId,
            verified: isValid,
            timestamp: Date.now()
        };
        
        const hexVerificationData = Buffer.from(JSON.stringify(verificationData)).toString('hex');
        
        await executeCommand(
            'main-chain',
            `publish cross_chain_verifications verify_${transactionId} ${hexVerificationData}`
        );
        
        res.status(200).json({
            success: true,
            verified: isValid,
            merkleRoot,
            message: isValid ? 'Transaction verified successfully' : 'Transaction verification failed'
        });
        
    } catch (error) {
        console.error('Error in /api/relay/verify:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying transaction',
            error: error.message
        });
    }
});

/**
 * Get the latest block from a chain
 */
app.get('/api/chain/:chainName/latest-block', async (req, res) => {
    try {
        const { chainName } = req.params;
        
        if (!['distributor-chain', 'retailer-chain', 'main-chain'].includes(chainName)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid chain name'
            });
        }
        
        // Get the latest block hash
        const blockCount = await executeCommand(chainName, 'getblockcount');
        const blockHash = await executeCommand(chainName, `getblockhash ${blockCount}`);
        const block = await executeCommand(chainName, `getblock ${blockHash} 1`);
        
        res.status(200).json({
            success: true,
            block
        });
        
    } catch (error) {
        console.error(`Error getting latest block:`, error);
        res.status(500).json({
            success: false,
            message: 'Error getting latest block',
            error: error.message
        });
    }
});

/**
 * Record a transaction on the distributor chain
 */
app.post('/api/distributor/transaction', async (req, res) => {
    try {
        const { transactionType, productId, quantity, relatedEntity, additionalData } = req.body;
        
        if (!transactionType || !productId || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Create transaction object
        const transaction = {
            transactionId: `DIST-TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            transactionType,
            productId,
            quantity,
            relatedEntity: relatedEntity || 'INTERNAL',
            timestamp: Date.now(),
            status: 'PENDING',
            additionalData: additionalData || {}
        };
        
        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(transaction)).toString('hex');
        
        // Publish to stream
        const result = await executeCommand(
            'distributor-chain',
            `publish distributor_transactions ${transaction.transactionId} ${hexData}`
        );
        
        res.status(201).json({
            success: true,
            message: 'Transaction recorded',
            transaction,
            txid: result
        });
        
    } catch (error) {
        console.error('Error creating distributor transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating distributor transaction',
            error: error.message
        });
    }
});

/**
 * NEW: Record a transaction on the retailer chain
 */
app.post('/api/retailer/transaction', async (req, res) => {
    try {
        const { transactionType, productId, quantity, customerId, storeLocation, additionalData } = req.body;
        
        if (!transactionType || !productId || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Create transaction object
        const transaction = {
            transactionId: `RETAIL-TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            transactionType,
            productId,
            quantity,
            customerId: customerId || 'ANONYMOUS',
            storeLocation: storeLocation || 'MAIN',
            timestamp: Date.now(),
            status: 'PENDING',
            additionalData: additionalData || {}
        };
        
        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(transaction)).toString('hex');
        
        // Publish to stream
        const result = await executeCommand(
            'retailer-chain',
            `publish retailer_transactions ${transaction.transactionId} ${hexData}`
        );
        
        // If this is a SALE, notify distributor chain to update inventory
        if (transactionType === 'SALE' || transactionType === 'RETURN') {
            const notificationData = {
                type: 'INVENTORY_UPDATE',
                source: 'retailer-chain',
                productId,
                quantity: transactionType === 'SALE' ? -quantity : quantity,
                reference: transaction.transactionId,
                timestamp: Date.now()
            };
            
            const hexNotificationData = Buffer.from(JSON.stringify(notificationData)).toString('hex');
            
            try {
                await executeCommand(
                    'distributor-chain',
                    `publish inventory_updates ${productId} ${hexNotificationData}`
                );
                console.log(`Inventory update notification sent to distributor chain for ${transaction.transactionId}`);
            } catch (error) {
                console.error('Failed to send inventory notification:', error);
            }
        }
        
        res.status(201).json({
            success: true,
            message: 'Transaction recorded',
            transaction,
            txid: result
        });
        
    } catch (error) {
        console.error('Error creating retailer transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating retailer transaction',
            error: error.message
        });
    }
});

/**
 * NEW: Cross-chain query API - Search for product transactions across chains
 */
app.get('/api/product/:productId/history', async (req, res) => {
    try {
        const { productId } = req.params;
        const results = { distributor: [], retailer: [] };
        
        // Query distributor chain
        try {
            const distributorItems = await executeCommand(
                'distributor-chain',
                `liststreamkeyitems distributor_transactions ${productId}`
            );
            
            results.distributor = distributorItems.map(item => {
                try {
                    return JSON.parse(Buffer.from(item.data, 'hex').toString());
                } catch (e) {
                    return { error: 'Failed to parse data', raw: item };
                }
            });
        } catch (error) {
            console.error(`Error querying distributor chain:`, error);
            results.distributor = [{ error: error.message }];
        }
        
        // Query retailer chain
        try {
            const retailerItems = await executeCommand(
                'retailer-chain',
                `liststreamkeyitems retailer_transactions ${productId}`
            );
            
            results.retailer = retailerItems.map(item => {
                try {
                    return JSON.parse(Buffer.from(item.data, 'hex').toString());
                } catch (e) {
                    return { error: 'Failed to parse data', raw: item };
                }
            });
        } catch (error) {
            console.error(`Error querying retailer chain:`, error);
            results.retailer = [{ error: error.message }];
        }
        
        // Combine and sort by timestamp
        const allTransactions = [
            ...results.distributor.map(tx => ({ ...tx, chain: 'distributor' })),
            ...results.retailer.map(tx => ({ ...tx, chain: 'retailer' }))
        ].sort((a, b) => a.timestamp - b.timestamp);
        
        res.status(200).json({
            success: true,
            productId,
            results: {
                distributor: results.distributor,
                retailer: results.retailer,
                timeline: allTransactions
            }
        });
        
    } catch (error) {
        console.error(`Error retrieving product history:`, error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving product history',
            error: error.message
        });
    }
});

/**
 * NEW: Network health API - Check the status of all chains and nodes
 */
app.get('/api/network/health', async (req, res) => {
    try {
        const results = {};
        const chains = ['distributor-chain', 'retailer-chain', 'main-chain'];
        
        for (const chain of chains) {
            results[chain] = {
                mainNode: { status: 'unknown', blockHeight: 0, peers: 0 },
                peerNodes: []
            };
            
            try {
                // Check main node
                const info = await executeCommand(chain, 'getinfo');
                const blockCount = await executeCommand(chain, 'getblockcount');
                const peerInfo = await executeCommand(chain, 'getpeerinfo');
                
                results[chain].mainNode = {
                    status: 'online',
                    version: info.version,
                    protocolversion: info.protocolversion,
                    blockHeight: blockCount,
                    peers: peerInfo.length,
                    chainParams: info.chainparams
                };
                
                // Check peer nodes 1, 2, and 3
                for (let node = 1; node <= 3; node++) {
                    try {
                        const nodeInfo = await executeCommand(chain, 'getinfo', node);
                        const nodeBlockCount = await executeCommand(chain, 'getblockcount', node);
                        
                        results[chain].peerNodes.push({
                            nodeId: node,
                            status: 'online',
                            blockHeight: nodeBlockCount,
                            version: nodeInfo.version
                        });
                    } catch (error) {
                        results[chain].peerNodes.push({
                            nodeId: node,
                            status: 'offline',
                            error: error.message
                        });
                    }
                }
            } catch (error) {
                results[chain].mainNode = {
                    status: 'offline',
                    error: error.message
                };
            }
        }
        
        res.status(200).json({
            success: true,
            timestamp: Date.now(),
            network: results
        });
        
    } catch (error) {
        console.error(`Error checking network health:`, error);
        res.status(500).json({
            success: false,
            message: 'Error checking network health',
            error: error.message
        });
    }
});

/**
 * NEW: Batch transaction processing
 */
app.post('/api/batch/transactions', async (req, res) => {
    try {
        const { chain, transactions } = req.body;
        
        if (!chain || !transactions || !Array.isArray(transactions)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request. Must provide chain and transactions array.'
            });
        }
        
        if (!['distributor-chain', 'retailer-chain'].includes(chain)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid chain. Must be distributor-chain or retailer-chain'
            });
        }
        
        const results = [];
        const streamName = chain === 'distributor-chain' 
            ? 'distributor_transactions' 
            : 'retailer_transactions';
        
        for (const tx of transactions) {
            try {
                // Generate transaction ID if not provided
                const txId = tx.transactionId || 
                    `${chain === 'distributor-chain' ? 'DIST' : 'RETAIL'}-TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                
                // Add metadata
                const enrichedTx = {
                    ...tx,
                    transactionId: txId,
                    timestamp: tx.timestamp || Date.now(),
                    status: tx.status || 'PENDING'
                };
                
                // Convert to hex
                const hexData = Buffer.from(JSON.stringify(enrichedTx)).toString('hex');
                
                // Publish to chain
                const txResult = await executeCommand(
                    chain,
                    `publish ${streamName} ${txId} ${hexData}`
                );
                
                results.push({
                    success: true,
                    transactionId: txId,
                    txid: txResult
                });
                
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    transaction: tx
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        
        res.status(200).json({
            success: true,
            message: `Processed ${successCount} of ${transactions.length} transactions`,
            results
        });
        
    } catch (error) {
        console.error('Error in batch transaction processing:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing batch transactions',
            error: error.message
        });
    }
});

/**
 * NEW: Cross-chain asset transfer
 */
app.post('/api/transfer/asset', async (req, res) => {
    try {
        const { sourceChain, targetChain, assetName, quantity, metadata } = req.body;
        
        if (!sourceChain || !targetChain || !assetName || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        if (sourceChain === targetChain) {
            return res.status(400).json({
                success: false,
                message: 'Source and target chains must be different'
            });
        }
        
        const chains = ['distributor-chain', 'retailer-chain', 'main-chain'];
        if (!chains.includes(sourceChain) || !chains.includes(targetChain)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid chain specified'
            });
        }
        
        // 1. Lock assets on source chain
        const lockData = {
            assetName,
            quantity,
            targetChain,
            status: 'LOCKED',
            timestamp: Date.now(),
            metadata: metadata || {}
        };
        
        const transferId = `TRANSFER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const hexLockData = Buffer.from(JSON.stringify(lockData)).toString('hex');
        
        // Record lock on source chain
        const lockResult = await executeCommand(
            sourceChain,
            `publish asset_transfers ${transferId} ${hexLockData}`
        );
        
        // 2. Create transfer record on main chain (acting as the coordinator)
        const transferData = {
            transferId,
            sourceChain,
            targetChain,
            assetName,
            quantity,
            status: 'PENDING',
            sourceTxid: lockResult,
            timestamp: Date.now(),
            metadata: metadata || {}
        };
        
        const hexTransferData = Buffer.from(JSON.stringify(transferData)).toString('hex');
        
        const mainChainResult = await executeCommand(
            'main-chain',
            `publish cross_chain_transfers ${transferId} ${hexTransferData}`
        );
        
        // 3. Issue asset on target chain
        const issueData = {
            assetName,
            quantity,
            sourceChain,
            transferId,
            status: 'ISSUED',
            timestamp: Date.now(),
            metadata: metadata || {}
        };
        
        const hexIssueData = Buffer.from(JSON.stringify(issueData)).toString('hex');
        
        const issueResult = await executeCommand(
            targetChain,
            `publish asset_receipts ${transferId} ${hexIssueData}`
        );
        
        // 4. Update status on main chain
        const updateData = {
            ...transferData,
            status: 'COMPLETED',
            targetTxid: issueResult,
            completedAt: Date.now()
        };
        
        const hexUpdateData = Buffer.from(JSON.stringify(updateData)).toString('hex');
        
        await executeCommand(
            'main-chain',
            `publish cross_chain_transfers ${transferId}_completed ${hexUpdateData}`
        );
        
        res.status(200).json({
            success: true,
            message: 'Asset transferred between chains',
            transferId,
            source: {
                chain: sourceChain,
                txid: lockResult
            },
            target: {
                chain: targetChain,
                txid: issueResult
            },
            coordinator: {
                txid: mainChainResult
            }
        });
        
    } catch (error) {
        console.error('Error transferring asset between chains:', error);
        res.status(500).json({
            success: false,
            message: 'Error transferring asset',
            error: error.message
        });
    }
});

/**
 * NEW: Dashboard statistics API
 */
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const stats = {
            blockHeights: {},
            transactionCounts: {},
            assetData: {},
            recentActivity: []
        };
        
        // Get block heights
        for (const chain of ['distributor-chain', 'retailer-chain', 'main-chain']) {
            try {
                const blockCount = await executeCommand(chain, 'getblockcount');
                stats.blockHeights[chain] = blockCount;
            } catch (error) {
                console.error(`Error getting block height for ${chain}:`, error);
                stats.blockHeights[chain] = 'Error';
            }
        }
        
        // Get transaction counts
        try {
            const distributorItems = await executeCommand(
                'distributor-chain',
                'liststreamitems distributor_transactions 1'
            );
            stats.transactionCounts['distributor-chain'] = distributorItems.length;
        } catch (error) {
            stats.transactionCounts['distributor-chain'] = 'Error';
        }
        
        try {
            const retailerItems = await executeCommand(
                'retailer-chain',
                'liststreamitems retailer_transactions 1'
            );
            stats.transactionCounts['retailer-chain'] = retailerItems.length;
        } catch (error) {
            stats.transactionCounts['retailer-chain'] = 'Error';
        }
        
        // Get recent cross-chain activity
        try {
            const transfers = await executeCommand(
                'main-chain',
                'liststreamitems cross_chain_transfers 10'
            );
            
            stats.recentActivity = transfers.map(item => {
                try {
                    return JSON.parse(Buffer.from(item.data, 'hex').toString());
                } catch (e) {
                    return { error: 'Failed to parse data' };
                }
            });
        } catch (error) {
            stats.recentActivity = [{ error: 'Failed to fetch activity' }];
        }
        
        res.status(200).json({
            success: true,
            timestamp: Date.now(),
            stats
        });
        
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard statistics',
            error: error.message
        });
    }
});

/**
 * NEW: Auto-sync endpoint - Automatically sync Merkle roots between chains
 */
app.post('/api/sync/merkle-roots', async (req, res) => {
    try {
        const results = {
            'distributor-chain': { success: false, blockHeight: 0, newBlocksProcessed: 0 },
            'retailer-chain': { success: false, blockHeight: 0, newBlocksProcessed: 0 }
        };
        
        // Find the last synced blocks
        const syncedRoots = await executeCommand(
            'main-chain',
            'liststreamitems sidechain_merkle_roots'
        );
        
        const lastSyncedBlocks = {
            'distributor-chain': 0,
            'retailer-chain': 0
        };
        
        // Extract the last block heights from the keys
        syncedRoots.forEach(item => {
            try {
                const data = JSON.parse(Buffer.from(item.data, 'hex').toString());
                
                if (data.sourceChain === 'distributor-chain' && data.blockHeight > lastSyncedBlocks['distributor-chain']) {
                    lastSyncedBlocks['distributor-chain'] = data.blockHeight;
                } else if (data.sourceChain === 'retailer-chain' && data.blockHeight > lastSyncedBlocks['retailer-chain']) {
                    lastSyncedBlocks['retailer-chain'] = data.blockHeight;
                }
            } catch (error) {
                console.error('Error parsing item data:', error);
            }
        });
        
        // Process each sidechain
        for (const chain of ['distributor-chain', 'retailer-chain']) {
            try {
                // Get current block height
                const blockCount = await executeCommand(chain, 'getblockcount');
                results[chain].blockHeight = blockCount;
                
                // If there are new blocks, process them
                const startBlock = lastSyncedBlocks[chain] + 1;
                if (startBlock <= blockCount) {
                    console.log(`Processing ${chain} blocks from ${startBlock} to ${blockCount}`);
                    
                    for (let height = startBlock; height <= blockCount; height++) {
                        // Get block hash at this height
                        const blockHash = await executeCommand(chain, `getblockhash ${height}`);
                        
                        // Relay the Merkle root to the main chain
                        const blockInfo = await getBlockMerkleRoot(chain, blockHash);
                        
                        // Create data for storage
                        const data = {
                            sourceChain: chain,
                            blockHash: blockInfo.blockHash,
                            merkleRoot: blockInfo.merkleRoot,
                            blockHeight: blockInfo.height,
                            timestamp: Date.now()
                        };
                        
                        // Generate a key for the data
                        const key = `${chain}_block_${blockInfo.height}`;
                        
                        // Convert data to hex format
                        const hexData = Buffer.from(JSON.stringify(data)).toString('hex');
                        
                        // Publish to main chain
                        await executeCommand(
                            'main-chain', 
                            `publish sidechain_merkle_roots ${key} ${hexData}`
                        );
                        
                        // Also store in source chain for reference
                        await executeCommand(
                            chain,
                            `publish merkle_roots ${key} ${hexData}`
                        );
                        
                        results[chain].newBlocksProcessed++;
                    }
                    
                    results[chain].success = true;
                } else {
                    results[chain].success = true;
                    results[chain].message = 'No new blocks to process';
                }
            } catch (error) {
                console.error(`Error syncing ${chain}:`, error);
                results[chain].error = error.message;
            }
        }
        
        res.status(200).json({
            success: true,
            lastSyncedBlocks,
            results
        });
        
    } catch (error) {
        console.error('Error in auto sync:', error);
        res.status(500).json({
            success: false,
            message: 'Error during auto-sync process',
            error: error.message
        });
    }
});

/**
 * NEW: Scheduled task handler for automated processes
 */
let scheduledTasks = {};

/**
 * Start or stop automated block verification
 */
app.post('/api/automation/block-verification', async (req, res) => {
    try {
        const { action, intervalMinutes = 5 } = req.body;
        
        if (action === 'start') {
            // Stop any existing task first
            if (scheduledTasks.blockVerification) {
                clearInterval(scheduledTasks.blockVerification);
            }
            
            // Convert minutes to milliseconds
            const intervalMs = intervalMinutes * 60 * 1000;
            
            // Create new task
            console.log(`Starting automated block verification every ${intervalMinutes} minutes`);
            
            // Run once immediately
            await runBlockVerification();
            
            // Then schedule for regular execution
            scheduledTasks.blockVerification = setInterval(async () => {
                try {
                    await runBlockVerification();
                } catch (error) {
                    console.error('Error in scheduled block verification:', error);
                }
            }, intervalMs);
            
            res.status(200).json({
                success: true,
                message: `Automated block verification started, running every ${intervalMinutes} minutes`,
                nextRun: new Date(Date.now() + intervalMs)
            });
            
        } else if (action === 'stop') {
            if (scheduledTasks.blockVerification) {
                clearInterval(scheduledTasks.blockVerification);
                scheduledTasks.blockVerification = null;
                
                res.status(200).json({
                    success: true,
                    message: 'Automated block verification stopped'
                });
            } else {
                res.status(200).json({
                    success: false,
                    message: 'No automated block verification was running'
                });
            }
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid action. Use "start" or "stop"'
            });
        }
    } catch (error) {
        console.error('Error managing block verification automation:', error);
        res.status(500).json({
            success: false,
            message: 'Error managing block verification automation',
            error: error.message
        });
    }
});

/**
 * Perform block verification across all chains
 */
async function runBlockVerification() {
    console.log('Running scheduled block verification...');
    
    const results = {
        timestamp: Date.now(),
        chains: {}
    };
    
    // Check each chain
    for (const chain of ['distributor-chain', 'retailer-chain', 'main-chain']) {
        try {
            // Get block count and check last 5 blocks
            const blockCount = await executeCommand(chain, 'getblockcount');
            const startBlock = Math.max(1, blockCount - 5);
            
            results.chains[chain] = {
                blockHeight: blockCount,
                blocksVerified: 0,
                transactions: 0,
                issues: []
            };
            
            // Check each block
            for (let height = startBlock; height <= blockCount; height++) {
                const blockHash = await executeCommand(chain, `getblockhash ${height}`);
                const block = await executeCommand(chain, `getblock ${blockHash} 1`);
                
                // Check transactions in this block
                results.chains[chain].transactions += block.tx.length;
                
                // Verify Merkle root matches transactions
                const calculatedMerkleRoot = await verifyMerkleRoot(chain, blockHash);
                
                if (calculatedMerkleRoot !== block.merkleroot) {
                    results.chains[chain].issues.push({
                        blockHeight: height,
                        blockHash,
                        message: 'Merkle root verification failed',
                        expected: block.merkleroot,
                        calculated: calculatedMerkleRoot
                    });
                }
                
                results.chains[chain].blocksVerified++;
            }
            
            // Log the result
            if (results.chains[chain].issues.length === 0) {
                console.log(`✅ ${chain}: Verified ${results.chains[chain].blocksVerified} blocks with ${results.chains[chain].transactions} transactions`);
            } else {
                console.error(`❌ ${chain}: Found ${results.chains[chain].issues.length} issues in ${results.chains[chain].blocksVerified} blocks`);
            }
            
        } catch (error) {
            console.error(`Error verifying ${chain}:`, error);
            results.chains[chain] = {
                error: error.message
            };
        }
    }
    
    // Record verification result to main chain
    try {
        const hexData = Buffer.from(JSON.stringify(results)).toString('hex');
        await executeCommand(
            'main-chain',
            `publish block_verifications verify_run_${Date.now()} ${hexData}`
        );
    } catch (error) {
        console.error('Error recording verification results:', error);
    }
    
    return results;
}

/**
 * Helper to verify a block's Merkle root
 */
async function verifyMerkleRoot(chain, blockHash) {
    const block = await executeCommand(chain, `getblock ${blockHash} 1`);
    const txIds = block.tx;
    
    // Simple implementation for demo - in production you'd need to follow the exact
    // Merkle tree construction algorithm used by the blockchain
    return createMerkleTree(txIds);
}

/**
 * NEW: Register a product for supply chain tracking
 */
app.post('/api/supply-chain/register-product', async (req, res) => {
    try {
        const { productId, name, manufacturer, manufacturingDate, attributes } = req.body;
        
        if (!productId || !name || !manufacturer) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Create product data
        const productData = {
            productId,
            name,
            manufacturer,
            manufacturingDate: manufacturingDate || Date.now(),
            registrationDate: Date.now(),
            attributes: attributes || {},
            status: 'REGISTERED'
        };
        
        // Generate QR code data for the product
        const qrData = `PRODUCT:${productId}|MFG:${manufacturer}|DATE:${productData.manufacturingDate}`;
        productData.qrCode = qrData;
        
        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(productData)).toString('hex');
        
        // Publish to both chains for synchronized tracking
        const distResult = await executeCommand(
            'distributor-chain',
            `publish products ${productId} ${hexData}`
        );
        
        // Also share with retailer chain so they know about the product
        const retailResult = await executeCommand(
            'retailer-chain',
            `publish products ${productId} ${hexData}`
        );
        
        // Record on main chain as the single source of truth
        const mainResult = await executeCommand(
            'main-chain',
            `publish product_registry ${productId} ${hexData}`
        );
        
        res.status(201).json({
            success: true,
            message: 'Product registered successfully',
            product: productData,
            transactions: {
                distributor: distResult,
                retailer: retailResult,
                main: mainResult
            }
        });
        
    } catch (error) {
        console.error('Error registering product:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering product',
            error: error.message
        });
    }
});

/**
 * NEW: Record a supply chain event for a product
 */
app.post('/api/supply-chain/record-event', async (req, res) => {
    try {
        const { productId, eventType, location, handler, data } = req.body;
        
        if (!productId || !eventType || !location) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Determine which chain should hold the record based on event type
        let targetChain;
        if (['MANUFACTURED', 'PACKAGED', 'SHIPPED', 'DISTRIBUTOR_RECEIVED'].includes(eventType)) {
            targetChain = 'distributor-chain';
        } else if (['RETAILER_RECEIVED', 'SHELVED', 'SOLD', 'RETURNED'].includes(eventType)) {
            targetChain = 'retailer-chain';
        } else {
            targetChain = 'main-chain'; // Default for custom events
        }
        
        // Create event data
        const eventData = {
            productId,
            eventType,
            location,
            handler: handler || 'SYSTEM',
            timestamp: Date.now(),
            data: data || {}
        };
        
        // Generate event ID
        const eventId = `EVENT-${productId}-${Date.now()}`;
        
        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(eventData)).toString('hex');
        
        // Publish to the appropriate chain
        const result = await executeCommand(
            targetChain,
            `publish supply_chain_events ${eventId} ${hexData}`
        );
        
        // Also publish to product history on main chain for a complete timeline
        await executeCommand(
            'main-chain',
            `publish product_history ${productId} ${hexData}`
        );
        
        res.status(200).json({
            success: true,
            message: 'Supply chain event recorded',
            event: eventData,
            chain: targetChain,
            txid: result
        });
        
    } catch (error) {
        console.error('Error recording supply chain event:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording supply chain event',
            error: error.message
        });
    }
});

/**
 * NEW: Get complete supply chain history for a product
 */
app.get('/api/supply-chain/product/:productId/history', async (req, res) => {
    try {
        const { productId } = req.params;
        
        // Collect all events from all three chains
        const productEvents = [];
        
        // Check each chain for events
        for (const chain of ['distributor-chain', 'retailer-chain', 'main-chain']) {
            try {
                let events = [];
                
                if (chain === 'main-chain') {
                    // On main chain, check the product_history stream
                    const items = await executeCommand(
                        chain,
                        `liststreamkeyitems product_history ${productId}`
                    );
                    
                    events = items.map(item => {
                        try {
                            const data = JSON.parse(Buffer.from(item.data, 'hex').toString());
                            return {
                                ...data,
                                chain,
                                confirmations: item.confirmations,
                                blockTime: item.blocktime
                            };
                        } catch (e) {
                            return { error: 'Failed to parse data', chain };
                        }
                    });
                } else {
                    // On distributor/retailer chains, check the supply_chain_events stream
                    const items = await executeCommand(
                        chain,
                        `liststreamitems supply_chain_events`
                    );
                    
                    events = items
                        .map(item => {
                            try {
                                const data = JSON.parse(Buffer.from(item.data, 'hex').toString());
                                return {
                                    ...data,
                                    chain,
                                    confirmations: item.confirmations,
                                    blockTime: item.blocktime
                                };
                            } catch (e) {
                                return null; // Skip items that can't be parsed
                            }
                        })
                        .filter(data => data && data.productId === productId);
                }
                
                productEvents.push(...events);
            } catch (error) {
                console.error(`Error getting events from ${chain}:`, error);
            }
        }
        
        // Sort events by timestamp
        productEvents.sort((a, b) => a.timestamp - b.timestamp);
        
        // Get product details
        let productDetails = null;
        try {
            const productItem = await executeCommand(
                'main-chain',
                `liststreamkeyitems product_registry ${productId}`
            );
            
            if (productItem.length > 0) {
                productDetails = JSON.parse(Buffer.from(productItem[0].data, 'hex').toString());
            }
        } catch (error) {
            console.error(`Error getting product details:`, error);
        }
        
        res.status(200).json({
            success: true,
            productId,
            productDetails,
            events: productEvents,
            eventCount: productEvents.length
        });
        
    } catch (error) {
        console.error('Error retrieving supply chain history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving supply chain history',
            error: error.message
        });
    }
});

/**
 * NEW: Register a business rule for automated processing
 */
app.post('/api/rules/create', async (req, res) => {
    try {
        const { 
            ruleName, 
            description, 
            triggerConditions,
            actions,
            enabled = true
        } = req.body;
        
        if (!ruleName || !triggerConditions || !actions) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Create rule data
        const ruleData = {
            ruleName,
            description,
            triggerConditions,
            actions,
            enabled,
            createdAt: Date.now(),
            lastUpdated: Date.now()
        };
        
        // Generate a unique rule ID
        const ruleId = `RULE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(ruleData)).toString('hex');
        
        // Store rule on main chain
        const result = await executeCommand(
            'main-chain',
            `publish business_rules ${ruleId} ${hexData}`
        );
        
        res.status(201).json({
            success: true,
            message: 'Business rule created successfully',
            ruleId,
            rule: ruleData,
            txid: result
        });
        
    } catch (error) {
        console.error('Error creating business rule:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating business rule',
            error: error.message
        });
    }
});

/**
 * NEW: Process events against business rules (automated action engine)
 */
app.post('/api/rules/process', async (req, res) => {
    try {
        const { event, testOnly = false } = req.body;
        
        if (!event) {
            return res.status(400).json({
                success: false,
                message: 'No event provided'
            });
        }
        
        // Get all active business rules
        const rulesItems = await executeCommand(
            'main-chain',
            'liststreamitems business_rules'
        );
        
        const rules = rulesItems
            .map(item => {
                try {
                    return JSON.parse(Buffer.from(item.data, 'hex').toString());
                } catch (e) {
                    return null;
                }
            })
            .filter(rule => rule && rule.enabled);
        
        // Process the event against each rule
        const results = [];
        
        for (const rule of rules) {
            try {
                // Check if the event matches the rule's trigger conditions
                const matches = evaluateConditions(event, rule.triggerConditions);
                
                if (matches) {
                    console.log(`Rule "${rule.ruleName}" matched event ${event.productId || event.transactionId}`);
                    
                    // Execute actions if not in test mode
                    if (!testOnly) {
                        const actionResults = await executeRuleActions(rule.actions, event);
                        
                        results.push({
                            ruleName: rule.ruleName,
                            matched: true,
                            actionsExecuted: true,
                            results: actionResults
                        });
                        
                        // Log rule execution
                        const executionData = {
                            ruleId: rule.ruleName,
                            event,
                            actionResults,
                            timestamp: Date.now()
                        };
                        
                        const hexData = Buffer.from(JSON.stringify(executionData)).toString('hex');
                        await executeCommand(
                            'main-chain',
                            `publish rule_executions EXEC-${Date.now()} ${hexData}`
                        );
                    } else {
                        results.push({
                            ruleName: rule.ruleName,
                            matched: true,
                            actionsExecuted: false,
                            message: 'Test mode - actions not executed'
                        });
                    }
                }
                
            } catch (error) {
                console.error(`Error processing rule "${rule.ruleName}":`, error);
                results.push({
                    ruleName: rule.ruleName,
                    matched: false,
                    error: error.message
                });
            }
        }
        
        res.status(200).json({
            success: true,
            event,
            rulesProcessed: rules.length,
            rulesMatched: results.filter(r => r.matched).length,
            results
        });
        
    } catch (error) {
        console.error('Error processing rules:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing rules',
            error: error.message
        });
    }
});

/**
 * Helper function to evaluate rule conditions against an event
 */
function evaluateConditions(event, conditions) {
    // Simple condition evaluator
    for (const condition of conditions) {
        const { field, operator, value } = condition;
        
        // Extract the field value from the event using dot notation
        const fieldParts = field.split('.');
        let fieldValue = event;
        
        for (const part of fieldParts) {
            if (fieldValue === undefined) break;
            fieldValue = fieldValue[part];
        }
        
        // If field doesn't exist in event, condition fails
        if (fieldValue === undefined) return false;
        
        // Evaluate based on operator
        switch (operator) {
            case '==':
                if (fieldValue != value) return false;
                break;
            case '===':
                if (fieldValue !== value) return false;
                break;
            case '!=':
                if (fieldValue == value) return false;
                break;
            case '!==':
                if (fieldValue === value) return false;
                break;
            case '>':
                if (!(fieldValue > value)) return false;
                break;
            case '>=':
                if (!(fieldValue >= value)) return false;
                break;
            case '<':
                if (!(fieldValue < value)) return false;
                break;
            case '<=':
                if (!(fieldValue <= value)) return false;
                break;
            case 'contains':
                if (!String(fieldValue).includes(value)) return false;
                break;
            case 'startsWith':
                if (!String(fieldValue).startsWith(value)) return false;
                break;
            case 'endsWith':
                if (!String(fieldValue).endsWith(value)) return false;
                break;
            default:
                console.warn(`Unknown operator: ${operator}`);
                return false;
        }
    }
    
    // All conditions passed
    return true;
}

/**
 * Execute the actions specified in a rule
 */
async function executeRuleActions(actions, event) {
    const results = [];
    
    for (const action of actions) {
        try {
            switch (action.type) {
                case 'recordTransaction':
                    results.push(await recordTransactionAction(action, event));
                    break;
                case 'notifyChain':
                    results.push(await notifyChainAction(action, event));
                    break;
                case 'updateStatus':
                    results.push(await updateStatusAction(action, event));
                    break;
                default:
                    results.push({
                        action,
                        success: false,
                        message: `Unknown action type: ${action.type}`
                    });
            }
        } catch (error) {
            console.error(`Error executing action:`, error);
            results.push({
                action,
                success: false,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * Action handler: Record a transaction on a chain
 */
async function recordTransactionAction(action, event) {
    const { chain, stream, key = Date.now().toString(), data } = action;
    
    // Prepare data - can include values from the event using template strings
    const processedData = {};
    
    for (const [dataKey, dataValue] of Object.entries(data)) {
        if (typeof dataValue === 'string' && dataValue.includes('${')) {
            // Process template strings like ${event.productId}
            processedData[dataKey] = dataValue.replace(/\${(.*?)}/g, (match, path) => {
                const pathParts = path.split('.');
                let value = event;
                
                for (const part of pathParts) {
                    if (value === undefined) return match;
                    value = value[part];
                }
                
                return value !== undefined ? value : match;
            });
        } else {
            processedData[dataKey] = dataValue;
        }
    }
    
    // Convert to hex
    const hexData = Buffer.from(JSON.stringify(processedData)).toString('hex');
    
    // Publish to chain
    const result = await executeCommand(chain, `publish ${stream} ${key} ${hexData}`);
    
    return {
        action: 'recordTransaction',
        success: true,
        chain,
        stream,
        key,
        txid: result
    };
}

/**
 * Action handler: Notify another chain about an event
 */
async function notifyChainAction(action, event) {
    const { targetChain, notificationType, data } = action;
    
    // Create notification object
    const notification = {
        type: notificationType,
        source: event.chain || 'system',
        relatedTo: event.productId || event.transactionId,
        data: data || {},
        originalEvent: event,
        timestamp: Date.now()
    };
    
    // Convert to hex
    const hexData = Buffer.from(JSON.stringify(notification)).toString('hex');
    
    // Generate a key
    const key = `NOTIFY-${Date.now()}`;
    
    // Publish to target chain
    const result = await executeCommand(
        targetChain,
        `publish notifications ${key} ${hexData}`
    );
    
    return {
        action: 'notifyChain',
        success: true,
        targetChain,
        notificationType,
        key,
        txid: result
    };
}

/**
 * Action handler: Update status of an item
 */
async function updateStatusAction(action, event) {
    const { chain, stream, key, newStatus, additionalData } = action;
    
    // First, get the current item
    const items = await executeCommand(
        chain,
        `liststreamkeyitems ${stream} ${key}`
    );
    
    if (items.length === 0) {
        throw new Error(`Item not found: ${key} in stream ${stream}`);
    }
    
    // Get the most recent item
    const latestItem = items[items.length - 1];
    let itemData;
    
    try {
        itemData = JSON.parse(Buffer.from(latestItem.data, 'hex').toString());
    } catch (error) {
        throw new Error(`Failed to parse item data: ${error.message}`);
    }
    
    // Update the status and add additional data
    const updatedData = {
        ...itemData,
        status: newStatus,
        lastUpdated: Date.now(),
        ...(additionalData || {})
    };
    
    // Convert to hex
    const hexData = Buffer.from(JSON.stringify(updatedData)).toString('hex');
    
    // Publish updated item
    const result = await executeCommand(
        chain,
        `publish ${stream} ${key} ${hexData}`
    );
    
    return {
        action: 'updateStatus',
        success: true,
        chain,
        stream,
        key,
        previousStatus: itemData.status,
        newStatus,
        txid: result
    };
}

// Add at the end of your existing file:

/**
 * Automatic Sync Job Configuration
 */
const SYNC_INTERVAL_MINUTES = 5;
let syncJobInterval = null;

/**
 * Start automatic sync job
 */
async function startAutoSync() {
  console.log(`Starting automatic sync job to run every ${SYNC_INTERVAL_MINUTES} minutes`);
  
  // Run once immediately at startup
  try {
    console.log("Running initial sync job...");
    await runSyncJob();
    console.log("Initial sync complete");
  } catch (error) {
    console.error("Error during initial sync:", error);
  }
  
  // Schedule recurring job
  syncJobInterval = setInterval(async () => {
    try {
      console.log(`Running scheduled sync job at ${new Date().toISOString()}`);
      await runSyncJob();
    } catch (error) {
      console.error("Error during scheduled sync:", error);
    }
  }, SYNC_INTERVAL_MINUTES * 60 * 1000);
}

/**
 * Run a full synchronization job
 */
async function runSyncJob() {
  const results = {
    merkleRoots: await syncMerkleRoots(),
    blockVerification: await runBlockVerification(),
    products: await syncProductRegistry(),
    transactions: await syncTransactionStatus()
  };
  
  // Log detailed results
  console.log("Sync job completed with results:");
  console.log(`- Merkle roots synced: ${results.merkleRoots.newBlocksProcessed || 0} blocks`);
  console.log(`- Blocks verified: ${Object.values(results.blockVerification.chains)
    .reduce((sum, chain) => sum + (chain.blocksVerified || 0), 0)} blocks`);
  
  return results;
}

/**
 * Sync product registry across chains
 */
async function syncProductRegistry() {
  try {
    console.log("Syncing product registry across chains...");
    
    // Get products from main chain (source of truth)
    const mainChainProducts = await executeCommand(
      'main-chain',
      'liststreamitems product_registry'
    );
    
    // Ensure products exist on both side chains
    let syncedProducts = 0;
    for (const item of mainChainProducts) {
      try {
        const productData = Buffer.from(item.data, 'hex').toString();
        const product = JSON.parse(productData);
        const productId = item.keys[0];
        
        // Check if product exists on distributor chain
        const distExists = await checkProductExists('distributor-chain', productId);
        if (!distExists) {
          console.log(`Syncing product ${productId} to distributor chain`);
          await executeCommand(
            'distributor-chain',
            `publish products ${productId} ${item.data}`
          );
          syncedProducts++;
        }
        
        // Check if product exists on retailer chain
        const retailExists = await checkProductExists('retailer-chain', productId);
        if (!retailExists) {
          console.log(`Syncing product ${productId} to retailer chain`);
          await executeCommand(
            'retailer-chain',
            `publish products ${productId} ${item.data}`
          );
          syncedProducts++;
        }
      } catch (error) {
        console.error(`Error syncing product ${item.keys[0]}:`, error);
      }
    }
    
    return { success: true, syncedProducts };
  } catch (error) {
    console.error("Error syncing product registry:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a product exists on a chain
 */
async function checkProductExists(chain, productId) {
  try {
    const items = await executeCommand(
      chain,
      `liststreamkeyitems products ${productId}`
    );
    return items.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Sync Merkle roots between chains
 */
async function syncMerkleRoots() {
  try {
    console.log("Syncing Merkle roots from sidechains to main chain...");
    
    const results = {
      'distributor-chain': { success: false, blockHeight: 0, newBlocksProcessed: 0 },
      'retailer-chain': { success: false, blockHeight: 0, newBlocksProcessed: 0 }
    };
    
    // Find the last synced blocks
    const syncedRoots = await executeCommand(
      'main-chain',
      'liststreamitems sidechain_merkle_roots'
    );
    
    const lastSyncedBlocks = {
      'distributor-chain': 0,
      'retailer-chain': 0
    };
    
    // Extract the last block heights from the keys
    syncedRoots.forEach(item => {
      try {
        const data = JSON.parse(Buffer.from(item.data, 'hex').toString());
        
        if (data.sourceChain === 'distributor-chain' && data.blockHeight > lastSyncedBlocks['distributor-chain']) {
          lastSyncedBlocks['distributor-chain'] = data.blockHeight;
        } else if (data.sourceChain === 'retailer-chain' && data.blockHeight > lastSyncedBlocks['retailer-chain']) {
          lastSyncedBlocks['retailer-chain'] = data.blockHeight;
        }
      } catch (error) {
        console.error('Error parsing item data:', error);
      }
    });
    
    // Process each sidechain
    for (const chain of ['distributor-chain', 'retailer-chain']) {
      try {
        // Get current block height
        const blockCount = await executeCommand(chain, 'getblockcount');
        results[chain].blockHeight = blockCount;
        
        // If there are new blocks, process them
        const startBlock = lastSyncedBlocks[chain] + 1;
        if (startBlock <= blockCount) {
          console.log(`Processing ${chain} blocks from ${startBlock} to ${blockCount}`);
          
          for (let height = startBlock; height <= blockCount; height++) {
            // Get block hash at this height
            const blockHash = await executeCommand(chain, `getblockhash ${height}`);
            
            // Relay the Merkle root to the main chain
            const blockInfo = await getBlockMerkleRoot(chain, blockHash);
            
            // Create data for storage
            const data = {
              sourceChain: chain,
              blockHash: blockInfo.blockHash,
              merkleRoot: blockInfo.merkleRoot,
              blockHeight: blockInfo.height,
              timestamp: Date.now()
            };
            
            // Generate a key for the data
            const key = `${chain}_block_${blockInfo.height}`;
            
            // Convert data to hex format
            const hexData = Buffer.from(JSON.stringify(data)).toString('hex');
            
            // Publish to main chain
            await executeCommand(
              'main-chain', 
              `publish sidechain_merkle_roots ${key} ${hexData}`
            );
            
            // Also store in source chain for reference
            await executeCommand(
              chain,
              `publish merkle_roots ${key} ${hexData}`
            );
            
            results[chain].newBlocksProcessed++;
          }
          
          results[chain].success = true;
        } else {
          results[chain].success = true;
          results[chain].message = 'No new blocks to process';
        }
      } catch (error) {
        console.error(`Error syncing ${chain}:`, error);
        results[chain].error = error.message;
      }
    }
    
    return results;
  } catch (error) {
    console.error("Error in Merkle root sync:", error);
    return { error: error.message };
  }
}

/**
 * Sync transaction status across chains
 */
async function syncTransactionStatus() {
  try {
    console.log("Syncing transaction status across chains...");
    const results = {
      distributorToRetailer: 0,
      retailerToDistributor: 0
    };
    
    // Sync pending transactions from distributor to retailer
    const distributorTxs = await executeCommand(
      'distributor-chain',
      'liststreamitems distributor_transactions'
    );
    
    for (const item of distributorTxs) {
      try {
        const txData = JSON.parse(Buffer.from(item.data, 'hex').toString());
        
        // If transaction involves retailer, ensure it's reflected there
        if (txData.relatedEntity === 'RETAILER' && txData.status === 'PENDING') {
          // Create notification for retailer
          const notificationData = {
            source: 'distributor-chain',
            transactionId: txData.transactionId,
            productId: txData.productId,
            quantity: txData.quantity,
            timestamp: Date.now(),
            status: 'PENDING_ACKNOWLEDGEMENT',
            message: `Distributor transaction ${txData.transactionType} requires retailer acknowledgement`
          };
          
          const hexData = Buffer.from(JSON.stringify(notificationData)).toString('hex');
          
          await executeCommand(
            'retailer-chain',
            `publish notifications ${txData.transactionId} ${hexData}`
          );
          
          results.distributorToRetailer++;
        }
      } catch (error) {
        console.error(`Error processing distributor tx ${item.keys[0]}:`, error);
      }
    }
    
    // Sync retailer sales back to distributor
    const retailerTxs = await executeCommand(
      'retailer-chain',
      'liststreamitems retailer_transactions'
    );
    
    for (const item of retailerTxs) {
      try {
        const txData = JSON.parse(Buffer.from(item.data, 'hex').toString());
        
        // If transaction is a SALE that hasn't been synced to distributor
        if (txData.transactionType === 'SALE' && !txData.syncedToDistributor) {
          // Create inventory update notification
          const notificationData = {
            type: 'INVENTORY_UPDATE',
            source: 'retailer-chain',
            productId: txData.productId,
            quantity: -txData.quantity,
            reference: txData.transactionId,
            timestamp: Date.now()
          };
          
          const hexNotificationData = Buffer.from(JSON.stringify(notificationData)).toString('hex');
          
          await executeCommand(
            'distributor-chain',
            `publish inventory_updates ${txData.productId} ${hexNotificationData}`
          );
          
          // Mark as synced on retailer chain
          const updatedData = {
            ...txData,
            syncedToDistributor: true,
            lastSync: Date.now()
          };
          
          const hexUpdatedData = Buffer.from(JSON.stringify(updatedData)).toString('hex');
          
          await executeCommand(
            'retailer-chain',
            `publish retailer_transactions ${txData.transactionId} ${hexUpdatedData}`
          );
          
          results.retailerToDistributor++;
        }
      } catch (error) {
        console.error(`Error processing retailer tx ${item.keys[0]}:`, error);
      }
    }
    
    return { success: true, ...results };
  } catch (error) {
    console.error("Error syncing transaction status:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle graceful server shutdown
 */
function handleShutdown() {
  console.log('Shutting down relay server gracefully...');
  
  // Clear all intervals
  if (syncJobInterval) {
    clearInterval(syncJobInterval);
  }
  
  if (scheduledTasks.blockVerification) {
    clearInterval(scheduledTasks.blockVerification);
  }
  
  // Close any open connections
  console.log('All scheduled tasks stopped');
  
  // Wait briefly before exiting to ensure logs are written
  setTimeout(() => {
    console.log('Relay server shutdown complete');
    process.exit(0);
  }, 500);
}

// Set up signal handlers for graceful shutdown
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Set up unhandled exception handler
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  // Keep the process alive but log the error
});

// Set up unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED PROMISE REJECTION:', reason);
  // Keep the process alive but log the error
});

/**
 * Start the server and initialize jobs
 */
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║               MULTICHAIN RELAY SERVER STARTED              ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Server running on port: ${PORT.toString().padEnd(28)}  ║
║  Environment: ${process.env.NODE_ENV || 'development'.padEnd(34)}  ║
║  Date: ${new Date().toISOString().padEnd(39)}  ║
║                                                            ║
║  Chains configured:                                        ║
║    - distributor-chain                                     ║
║    - retailer-chain                                        ║
║    - main-chain                                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

  // Check that we can connect to all chains
  try {
    for (const chain of ['distributor-chain', 'retailer-chain', 'main-chain']) {
      try {
        const info = await executeCommand(chain, 'getinfo');
        console.log(`✅ Connected to ${chain.padEnd(20)} | Protocol: ${info.protocolversion} | Blocks: ${info.blocks}`);
      } catch (error) {
        console.error(`❌ Failed to connect to ${chain}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("Error checking chain connectivity:", error);
  }
  
  // Start automatic sync job
  await startAutoSync();
  
  console.log("Server initialization complete!");
});

// Export for testing purposes
export { server, runSyncJob };