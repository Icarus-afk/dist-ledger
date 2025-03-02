import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import crypto from 'crypto';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROJECT_DIR = "/home/lothrok/Documents/projects/dist-ledger";
const PORT = process.env.PORT || 3005;
const RPC_USER = "multichainrpc";
const RPC_PASSWORD = "23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7";

// Chain definitions
const CHAINS = {
    'distributor-chain': {
        rpcPort: 7740,
        networkPort: 7741,
        peerRpcPorts: [7750, 7760]
    },
    'retailer-chain': {
        rpcPort: 7742,
        networkPort: 7743,
        peerRpcPorts: [7752, 7762]
    },
    'main-chain': {
        rpcPort: 7744,
        networkPort: 7745,
        peerRpcPorts: [7754, 7764]
    }
};

// Initialize express app
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Add logging
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'access.log'),
    { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));

// Helper function to execute MultiChain CLI commands with failover
const executeCommandWithFailover = async (chainName, command) => {
    const chain = CHAINS[chainName];
    if (!chain) {
        throw new Error(`Unknown chain: ${chainName}`);
    }

    // Try main node first
    try {
        const result = await executeCommand(chainName, command, chain.rpcPort);
        return result;
    } catch (error) {
        console.log(`Main node for ${chainName} failed, trying peer nodes...`);

        // Try each peer node in sequence
        for (const peerPort of chain.peerRpcPorts) {
            try {
                const result = await executeCommand(chainName, command, peerPort);
                return result;
            } catch (peerError) {
                console.log(`Peer node on port ${peerPort} failed: ${peerError.message}`);
            }
        }

        throw new Error(`All nodes for ${chainName} failed to execute command: ${error.message}`);
    }
};

// Execute MultiChain CLI command
const executeCommand = (chainName, command, rpcPort) => {
    return new Promise((resolve, reject) => {
        const cliCommand = `multichain-cli -datadir=${PROJECT_DIR}/data/${chainName} -rpcuser=${RPC_USER} -rpcpassword=${RPC_PASSWORD} -rpcport=${rpcPort} ${chainName} ${command}`;

        exec(cliCommand, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Command failed with code ${error.code}: ${stderr || error.message}`));
                return;
            }
            resolve(stdout.trim());
        });
    });
};

// API endpoints for chain information
app.get('/api/chain/:chainName/latest-block', async (req, res) => {
    try {
        const { chainName } = req.params;

        if (!Object.keys(CHAINS).includes(chainName)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid chain name'
            });
        }

        const blockCountResult = await executeCommandWithFailover(chainName, 'getblockcount');
        const blockCount = parseInt(blockCountResult);

        const blockHashResult = await executeCommandWithFailover(chainName, `getblockhash ${blockCount}`);
        const blockHash = blockHashResult.trim();

        const blockDataResult = await executeCommandWithFailover(chainName, `getblock ${blockHash}`);
        const block = JSON.parse(blockDataResult);

        res.status(200).json({
            success: true,
            block
        });
    } catch (error) {
        console.error('Error getting latest block:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving latest block',
            error: error.message
        });
    }
});

// Product history endpoint
app.get('/api/product/:productId/history', async (req, res) => {
    try {
        const { productId } = req.params;

        // Get data from distributor chain
        let distributorItems = [];
        try {
            const distributorData = await executeCommandWithFailover(
                'distributor-chain',
                `liststreamkeyitems distributor_transactions ${productId}`
            );
            distributorItems = JSON.parse(distributorData || '[]');
        } catch (error) {
            console.log(`No distributor data found for product ${productId}: ${error.message}`);
        }

        // Get data from retailer chain
        let retailerItems = [];
        try {
            const retailerData = await executeCommandWithFailover(
                'retailer-chain',
                `liststreamkeyitems retailer_transactions ${productId}`
            );
            retailerItems = JSON.parse(retailerData || '[]');
        } catch (error) {
            console.log(`No retailer data found for product ${productId}: ${error.message}`);
        }

        // Combine and sort data
        const timeline = [...distributorItems, ...retailerItems].map(item => {
            const data = JSON.parse(Buffer.from(item.data, 'hex').toString());
            return {
                chain: item.publishers[0].includes('distributor') ? 'distributor' : 'retailer',
                timestamp: data.timestamp || item.blocktime,
                txid: item.txid,
                data
            };
        }).sort((a, b) => a.timestamp - b.timestamp);

        res.status(200).json({
            success: true,
            productId,
            results: {
                distributor: distributorItems,
                retailer: retailerItems,
                timeline
            }
        });
    } catch (error) {
        console.error('Error getting product history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving product history',
            error: error.message
        });
    }
});

// Network health endpoint
app.get('/api/network/health', async (req, res) => {
    try {
        const networkStatus = {};

        for (const [chainName, chainConfig] of Object.entries(CHAINS)) {
            networkStatus[chainName] = {
                mainNode: await getNodeStatus(chainName, chainConfig.rpcPort),
                peerNodes: []
            };

            // Check peer nodes
            for (let i = 0; i < chainConfig.peerRpcPorts.length; i++) {
                try {
                    const peerStatus = await getNodeStatus(chainName, chainConfig.peerRpcPorts[i]);
                    networkStatus[chainName].peerNodes.push({
                        nodeId: i + 1,
                        ...peerStatus
                    });
                } catch (error) {
                    networkStatus[chainName].peerNodes.push({
                        nodeId: i + 1,
                        status: 'offline',
                        error: error.message
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            timestamp: Date.now(),
            network: networkStatus
        });
    } catch (error) {
        console.error('Error checking network health:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving network health',
            error: error.message
        });
    }
});

// Helper function to get node status
async function getNodeStatus(chainName, rpcPort) {
    try {
        // Check if node is online
        const infoResult = await executeCommand(chainName, 'getinfo', rpcPort);
        const info = JSON.parse(infoResult);

        // Get peer info
        const peerInfo = await executeCommand(chainName, 'getpeerinfo', rpcPort);
        const peers = JSON.parse(peerInfo);

        return {
            status: 'online',
            version: info.version,
            protocolversion: info.protocolversion,
            blockHeight: info.blocks,
            peers: peers.length
        };
    } catch (error) {
        return { status: 'offline', error: error.message };
    }
}

// Dashboard stats endpoint
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const stats = {
            blocks: {},
            transactions: {},
            streams: {},
            assets: {}
        };

        for (const chainName of Object.keys(CHAINS)) {
            // Get block count
            const blockCount = await executeCommandWithFailover(chainName, 'getblockcount');
            stats.blocks[chainName] = parseInt(blockCount);

            // Get transaction count (from mempool)
            const mempoolInfo = await executeCommandWithFailover(chainName, 'getmempoolinfo');
            const mempool = JSON.parse(mempoolInfo);
            stats.transactions[chainName] = mempool.size || 0;

            // Get stream count
            const streams = await executeCommandWithFailover(chainName, 'liststreams');
            const streamsData = JSON.parse(streams);
            stats.streams[chainName] = streamsData.length;

            // Get asset count
            const assets = await executeCommandWithFailover(chainName, 'listassets');
            const assetsData = JSON.parse(assets);
            stats.assets[chainName] = assetsData.length;
        }

        res.status(200).json({
            success: true,
            timestamp: Date.now(),
            stats
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving dashboard statistics',
            error: error.message
        });
    }
});

// Supply chain endpoints
app.get('/api/supply-chain/product/:productId/history', async (req, res) => {
    try {
        const { productId } = req.params;

        // Detailed product history across all chains
        const history = {
            manufacturing: [],
            distribution: [],
            retail: [],
            events: []
        };

        // Try to get manufacturing data from main-chain
        try {
            const mfgData = await executeCommandWithFailover(
                'main-chain',
                `liststreamkeyitems product_registry ${productId}`
            );
            const mfgItems = JSON.parse(mfgData || '[]');

            if (mfgItems.length > 0) {
                history.manufacturing = mfgItems.map(item => {
                    const data = JSON.parse(Buffer.from(item.data, 'hex').toString());
                    return {
                        timestamp: data.timestamp || item.blocktime,
                        txid: item.txid,
                        ...data
                    };
                });
            }
        } catch (error) {
            console.log(`No manufacturing data found for product ${productId}`);
        }

        // Get distribution data
        try {
            const distData = await executeCommandWithFailover(
                'distributor-chain',
                `liststreamkeyitems distributor_transactions ${productId}`
            );
            const distItems = JSON.parse(distData || '[]');

            if (distItems.length > 0) {
                history.distribution = distItems.map(item => {
                    const data = JSON.parse(Buffer.from(item.data, 'hex').toString());
                    return {
                        timestamp: data.timestamp || item.blocktime,
                        txid: item.txid,
                        ...data
                    };
                });
            }
        } catch (error) {
            console.log(`No distribution data found for product ${productId}`);
        }

        // Get retail data
        try {
            const retailData = await executeCommandWithFailover(
                'retailer-chain',
                `liststreamkeyitems retailer_transactions ${productId}`
            );
            const retailItems = JSON.parse(retailData || '[]');

            if (retailItems.length > 0) {
                history.retail = retailItems.map(item => {
                    const data = JSON.parse(Buffer.from(item.data, 'hex').toString());
                    return {
                        timestamp: data.timestamp || item.blocktime,
                        txid: item.txid,
                        ...data
                    };
                });
            }
        } catch (error) {
            console.log(`No retail data found for product ${productId}`);
        }

        // Combine all events in chronological order
        history.events = [
            ...history.manufacturing.map(item => ({ ...item, phase: 'manufacturing' })),
            ...history.distribution.map(item => ({ ...item, phase: 'distribution' })),
            ...history.retail.map(item => ({ ...item, phase: 'retail' }))
        ].sort((a, b) => a.timestamp - b.timestamp);

        res.status(200).json({
            success: true,
            productId,
            history
        });
    } catch (error) {
        console.error('Error getting supply chain product history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving supply chain product history',
            error: error.message
        });
    }
});

// Relay Merkle root
app.post('/api/relay/merkleroot', async (req, res) => {
    try {
        const { sourceChain, blockHeight } = req.body;

        if (!sourceChain || blockHeight === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Source chain and block height are required'
            });
        }

        // Make sure blockHeight is a number
        const height = parseInt(blockHeight, 10);
        if (isNaN(height)) {
            return res.status(400).json({
                success: false,
                message: 'Block height must be a valid integer'
            });
        }

        // Get the block hash for the given height
        const blockHashResult = await executeCommandWithFailover(sourceChain, `getblockhash ${height}`);
        const blockHash = blockHashResult.trim();

        // Get the block data to extract the merkle root
        const blockDataResult = await executeCommandWithFailover(sourceChain, `getblock ${blockHash} 1`);
        const blockData = JSON.parse(blockDataResult);

        // Extract merkle root
        const merkleRoot = blockData.merkleroot;

        // Store the merkle root on the main chain
        const key = `${sourceChain}_block_${height}`;
        const data = {
            sourceChain,
            blockHeight: height,
            blockHash,
            merkleRoot,
            timestamp: Date.now()
        };

        const hexData = Buffer.from(JSON.stringify(data)).toString('hex');

        // Store on main chain
        const txid = await executeCommandWithFailover(
            'main-chain',
            `publish sidechain_merkle_roots ${key} ${hexData}`
        );

        res.status(200).json({
            success: true,
            sourceChain,
            blockHeight: height,
            blockHash,
            merkleRoot,
            relayTxid: txid.trim()
        });
    } catch (error) {
        console.error('Error relaying Merkle root:', error);
        res.status(500).json({
            success: false,
            message: 'Error relaying Merkle root',
            error: error.message
        });
    }
});

// Verify transaction against Merkle root
app.post('/api/relay/verify', async (req, res) => {
    try {
        const { sourceChain, blockHash, transactionId, proof } = req.body;

        if (!sourceChain || !blockHash || !transactionId || !proof) {
            return res.status(400).json({
                success: false,
                message: 'Source chain, block hash, transaction ID, and proof are required'
            });
        }

        if (!/^[0-9a-f]{64}$/i.test(blockHash)) {
            return res.status(400).json({
              success: false,
              message: 'Invalid block hash format'
            });
          }
        // Get the block data to extract the merkle root
        const blockDataResult = await executeCommandWithFailover(
        sourceChain, 
        `getblock ${blockHash} 1`
        );
            const blockData = JSON.parse(blockDataResult);

        // Extract merkle root from block
        const merkleRootFromBlock = blockData.merkleroot;

        // Check if merkle root was relayed to the main chain
        const key = `${sourceChain}_block_${blockData.height}`;

        try {
            // Get the stored merkle root from main chain
            const storedMerkleData = await executeCommandWithFailover(
                'main-chain',
                `liststreamkeyitems sidechain_merkle_roots ${key}`
            );

            const storedData = JSON.parse(storedMerkleData);

            // Verify the transaction using the provided Merkle proof
            let currentHash = transactionId;

            // Apply the proof
            for (const step of proof) {
                if (step.position === 'left') {
                    currentHash = computeMerkleHash(step.hash, currentHash);
                } else {
                    currentHash = computeMerkleHash(currentHash, step.hash);
                }
            }

            // Final verification
            const verified = currentHash === merkleRootFromBlock;

            // Record the verification on the main chain
            const verificationData = {
                sourceChain,
                blockHash,
                blockHeight: blockData.height,
                transactionId,
                merkleRoot: merkleRootFromBlock,
                verified,
                timestamp: Date.now()
            };

            const hexVerificationData = Buffer.from(JSON.stringify(verificationData)).toString('hex');

            // Store verification result
            const verificationId = `${sourceChain}_tx_${transactionId.substring(0, 8)}`;

            const txid = await executeCommandWithFailover(
                'main-chain',
                `publish transaction_verifications ${verificationId} ${hexVerificationData}`
            );

            res.status(200).json({
                success: true,
                verified,
                transactionId,
                blockHash,
                sourceChain,
                verificationRecord: txid.trim()
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                message: 'Merkle root not found on main chain',
                error: error.message
            });
        }
    } catch (error) {
        console.error('Error verifying transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying transaction',
            error: error.message
        });
    }
});

// Helper function to compute Merkle hash
function computeMerkleHash(left, right) {
    return crypto.createHash('sha256')
        .update(crypto.createHash('sha256').update(`${left}${right}`).digest())
        .digest('hex');
}

// Record distributor transaction
app.post('/api/distributor/transaction', async (req, res) => {
    try {
        const { transactionType, productId, quantity, relatedEntity, additionalData } = req.body;

        if (!transactionType || !productId || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Transaction type, product ID, and quantity are required'
            });
        }

        // Create the transaction object
        const transaction = {
            transactionId: `DIST-TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            transactionType,
            productId,
            quantity,
            relatedEntity: relatedEntity || null,
            timestamp: Date.now(),
            status: 'PENDING',
            additionalData: additionalData || {}
        };

        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(transaction)).toString('hex');

        // Publish to distributor chain
        const txid = await executeCommandWithFailover(
            'distributor-chain',
            `publish distributor_transactions ${productId} ${hexData}`
        );

        res.status(201).json({
            success: true,
            message: 'Transaction recorded',
            transaction,
            txid
        });

    } catch (error) {
        console.error('Error recording distributor transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording transaction',
            error: error.message
        });
    }
});

// Record retailer transaction
app.post('/api/retailer/transaction', async (req, res) => {
    try {
        const { transactionType, productId, quantity, customerId, storeLocation, additionalData } = req.body;

        if (!transactionType || !productId || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Transaction type, product ID, and quantity are required'
            });
        }

        // Create the transaction object
        const transaction = {
            transactionId: `RETAIL-TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            transactionType,
            productId,
            quantity,
            customerId: customerId || null,
            storeLocation: storeLocation || null,
            timestamp: Date.now(),
            status: 'PENDING',
            additionalData: additionalData || {}
        };

        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(transaction)).toString('hex');

        // Publish to retailer chain
        const txid = await executeCommandWithFailover(
            'retailer-chain',
            `publish retailer_transactions ${productId} ${hexData}`
        );

        res.status(201).json({
            success: true,
            message: 'Transaction recorded',
            transaction,
            txid
        });

    } catch (error) {
        console.error('Error recording retailer transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording transaction',
            error: error.message
        });
    }
});

// Process batch transactions
app.post('/api/batch/transactions', async (req, res) => {
    try {
        const { chain, transactions } = req.body;

        if (!chain || !transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid chain name and transaction array are required'
            });
        }

        if (!Object.keys(CHAINS).includes(chain)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid chain specified'
            });
        }

        const results = [];
        let successCount = 0;

        for (const txn of transactions) {
            try {
                const { productId, transactionType, quantity, ...otherData } = txn;

                if (!productId || !transactionType || !quantity) {
                    results.push({
                        success: false,
                        error: 'Missing required fields'
                    });
                    continue;
                }

                // Create transaction object
                const transaction = {
                    transactionId: `${chain === 'distributor-chain' ? 'DIST' : 'RETAIL'}-TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                    productId,
                    transactionType,
                    quantity,
                    timestamp: Date.now(),
                    ...otherData
                };

                // Convert to hex
                const hexData = Buffer.from(JSON.stringify(transaction)).toString('hex');

                // Publish to appropriate stream
                const streamName = chain === 'distributor-chain' ? 'distributor_transactions' : 'retailer_transactions';
                const txid = await executeCommandWithFailover(
                    chain,
                    `publish ${streamName} ${productId} ${hexData}`
                );

                results.push({
                    success: true,
                    transactionId: transaction.transactionId,
                    txid
                });

                successCount++;
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Processed ${successCount} of ${transactions.length} transactions`,
            results
        });

    } catch (error) {
        console.error('Error processing batch transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing batch transactions',
            error: error.message
        });
    }
});

// Sync merkle roots endpoint
app.post('/api/sync/merkle-roots', async (req, res) => {
    try {
        const results = {
            distributor: [],
            retailer: []
        };

        // Sync from distributor chain
        const distributorBlocks = await executeCommandWithFailover('distributor-chain', 'getblockcount');
        const distributorBlockCount = parseInt(distributorBlocks);

        // Process the last 10 blocks or all if less than 10
        const startBlock = Math.max(1, distributorBlockCount - 10);

        for (let i = startBlock; i <= distributorBlockCount; i++) {
            try {
                // Get block hash
                const blockHashResult = await executeCommandWithFailover(
                    'distributor-chain',
                    `getblockhash ${i}`
                );

                // Get block data
                const blockDataResult = await executeCommandWithFailover(
                    'distributor-chain',
                    `getblock ${blockHashResult.trim()} 1`
                );
                const blockData = JSON.parse(blockDataResult);

                // Create merkle root record
                const merkleData = {
                    blockHeight: i,
                    blockHash: blockData.hash,
                    merkleRoot: blockData.merkleroot,
                    timestamp: blockData.time * 1000,
                    chainName: 'distributor-chain'
                };

                const hexMerkleData = Buffer.from(JSON.stringify(merkleData)).toString('hex');

                // Store on main chain
                const key = `distributor-chain_block_${i}`;
                const txid = await executeCommandWithFailover(
                    'main-chain',
                    `publish sidechain_merkle_roots ${key} ${hexMerkleData}`
                );

                results.distributor.push({
                    blockHeight: i,
                    txid: txid.trim()
                });
            } catch (error) {
                console.error(`Error syncing distributor block ${i}:`, error.message);
            }
        }

        // Sync from retailer chain
        const retailerBlocks = await executeCommandWithFailover('retailer-chain', 'getblockcount');
        const retailerBlockCount = parseInt(retailerBlocks);

        // Process the last 10 blocks or all if less than 10
        const retailerStartBlock = Math.max(1, retailerBlockCount - 10);

        for (let i = retailerStartBlock; i <= retailerBlockCount; i++) {
            try {
                // Get block hash
                const blockHashResult = await executeCommandWithFailover(
                    'retailer-chain',
                    `getblockhash ${i}`
                );

                // Get block data
                const blockDataResult = await executeCommandWithFailover(
                    'retailer-chain',
                    `getblock ${blockHashResult.trim()} 1`
                );
                const blockData = JSON.parse(blockDataResult);

                // Create merkle root record
                const merkleData = {
                    blockHeight: i,
                    blockHash: blockData.hash,
                    merkleRoot: blockData.merkleroot,
                    timestamp: blockData.time * 1000,
                    chainName: 'retailer-chain'
                };

                const hexMerkleData = Buffer.from(JSON.stringify(merkleData)).toString('hex');

                // Store on main chain
                const key = `retailer-chain_block_${i}`;
                const txid = await executeCommandWithFailover(
                    'main-chain',
                    `publish sidechain_merkle_roots ${key} ${hexMerkleData}`
                );

                results.retailer.push({
                    blockHeight: i,
                    txid: txid.trim()
                });
            } catch (error) {
                console.error(`Error syncing retailer block ${i}:`, error.message);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Merkle roots synced successfully',
            results
        });
    } catch (error) {
        console.error('Error syncing merkle roots:', error);
        res.status(500).json({
            success: false,
            message: 'Error syncing merkle roots',
            error: error.message
        });
    }
});

/**
 * Start block verification automation
 */
app.post('/api/automation/block-verification', async (req, res) => {
    try {
        const { action, intervalMinutes } = req.body;

        if (!action || (action !== 'start' && action !== 'stop')) {
            return res.status(400).json({
                success: false,
                message: 'Valid action (start or stop) is required'
            });
        }

        // Store the automation configuration
        global.automationConfig = {
            enabled: action === 'start',
            intervalMinutes: intervalMinutes || 10,
            lastRun: action === 'start' ? Date.now() : null
        };

        if (action === 'start') {
            // Clear any existing interval
            if (global.automationInterval) {
                clearInterval(global.automationInterval);
            }

            // Set up the automation interval
            const intervalMs = (intervalMinutes || 10) * 60 * 1000;
            global.automationInterval = setInterval(async () => {
                try {
                    console.log('Running automated block verification...');
                    await syncMerkleRoots();
                    global.automationConfig.lastRun = Date.now();
                } catch (error) {
                    console.error('Error in automated block verification:', error);
                }
            }, intervalMs);

            // Run immediately
            syncMerkleRoots().catch(error => {
                console.error('Error in initial block verification:', error);
            });

            res.status(200).json({
                success: true,
                message: `Block verification automation started with ${intervalMinutes} minute interval`,
                nextRun: new Date(Date.now() + intervalMs).toISOString()
            });
        } else {
            // Stop automation
            if (global.automationInterval) {
                clearInterval(global.automationInterval);
                global.automationInterval = null;
            }

            res.status(200).json({
                success: true,
                message: 'Block verification automation stopped'
            });
        }
    } catch (error) {
        console.error('Error setting up automation:', error);
        res.status(500).json({
            success: false,
            message: 'Error setting up automation',
            error: error.message
        });
    }
});

// Helper function for syncing Merkle roots
async function syncMerkleRoots() {
    const results = {
        distributor: [],
        retailer: []
    };

    // Sync from distributor chain
    const distributorBlocks = await executeCommandWithFailover('distributor-chain', 'getblockcount');
    const distributorBlockCount = parseInt(distributorBlocks);

    // Process the last 10 blocks or all if less than 10
    const startBlock = Math.max(1, distributorBlockCount - 10);

    for (let i = startBlock; i <= distributorBlockCount; i++) {
        try {
            // Get block hash
            const blockHashResult = await executeCommandWithFailover(
                'distributor-chain',
                `getblockhash ${i}`
            );

            // Get block data
            const blockDataResult = await executeCommandWithFailover(
                'distributor-chain',
                `getblock ${blockHashResult.trim()} 1`
            );
            const blockData = JSON.parse(blockDataResult);

            // Create merkle root record
            const merkleData = {
                blockHeight: i,
                blockHash: blockData.hash,
                merkleRoot: blockData.merkleroot,
                timestamp: blockData.time * 1000,
                chainName: 'distributor-chain'
            };

            const hexMerkleData = Buffer.from(JSON.stringify(merkleData)).toString('hex');

            // Store on main chain
            const key = `distributor-chain_block_${i}`;
            const txid = await executeCommandWithFailover(
                'main-chain',
                `publish sidechain_merkle_roots ${key} ${hexMerkleData}`
            );

            results.distributor.push({
                blockHeight: i,
                txid: txid.trim()
            });
        } catch (error) {
            console.error(`Error syncing distributor block ${i}:`, error.message);
        }
    }

    // Do the same for retailer chain
    const retailerBlocks = await executeCommandWithFailover('retailer-chain', 'getblockcount');
    const retailerBlockCount = parseInt(retailerBlocks);

    const retailerStartBlock = Math.max(1, retailerBlockCount - 10);

    for (let i = retailerStartBlock; i <= retailerBlockCount; i++) {
        // Similar implementation to distributor chain
        try {
            const blockHashResult = await executeCommandWithFailover('retailer-chain', `getblockhash ${i}`);
            const blockDataResult = await executeCommandWithFailover(
                'retailer-chain',
                `getblock ${blockHashResult.trim()} 1`
            );
            const blockData = JSON.parse(blockDataResult);

            const merkleData = {
                blockHeight: i,
                blockHash: blockData.hash,
                merkleRoot: blockData.merkleroot,
                timestamp: blockData.time * 1000,
                chainName: 'retailer-chain'
            };

            const hexMerkleData = Buffer.from(JSON.stringify(merkleData)).toString('hex');
            const key = `retailer-chain_block_${i}`;
            const txid = await executeCommandWithFailover(
                'main-chain',
                `publish sidechain_merkle_roots ${key} ${hexMerkleData}`
            );

            results.retailer.push({
                blockHeight: i,
                txid: txid.trim()
            });
        } catch (error) {
            console.error(`Error syncing retailer block ${i}:`, error.message);
        }
    }

    return results;
}

/**
 * Supply chain - Register product
 */
app.post('/api/supply-chain/register-product', async (req, res) => {
    try {
        const { productId, name, manufacturer, manufacturingDate, attributes } = req.body;

        if (!productId || !name || !manufacturer) {
            return res.status(400).json({
                success: false,
                message: 'Product ID, name, and manufacturer are required'
            });
        }

        // Create product registration object
        const registration = {
            productId,
            name,
            manufacturer,
            manufacturingDate: manufacturingDate || Date.now(),
            attributes: attributes || {},
            registrationDate: Date.now(),
            status: 'ACTIVE'
        };

        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(registration)).toString('hex');

        // Register on main chain
        const txid = await executeCommandWithFailover(
            'main-chain',
            `publish product_registry ${productId} ${hexData}`
        );

        res.status(201).json({
            success: true,
            message: 'Product registered successfully',
            registration,
            txid: txid.trim()
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
 * Supply chain - Record event
 */
app.post('/api/supply-chain/record-event', async (req, res) => {
    try {
        const { productId, eventType, location, handler, data } = req.body;

        if (!productId || !eventType) {
            return res.status(400).json({
                success: false,
                message: 'Product ID and event type are required'
            });
        }

        // Determine which chain to use based on event type
        let chain = 'main-chain';
        let streamName = 'product_events';

        if (['SHIPMENT', 'WAREHOUSE', 'PACKAGING'].includes(eventType)) {
            chain = 'distributor-chain';
            streamName = 'distributor_transactions';
        } else if (['SALE', 'RETURN', 'INVENTORY'].includes(eventType)) {
            chain = 'retailer-chain';
            streamName = 'retailer_transactions';
        }

        // Create event object
        const event = {
            eventId: `EVENT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            productId,
            eventType,
            location: location || 'UNKNOWN',
            handler: handler || 'SYSTEM',
            timestamp: Date.now(),
            data: data || {}
        };

        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(event)).toString('hex');

        // Record event
        const txid = await executeCommandWithFailover(
            chain,
            `publish ${streamName} ${productId} ${hexData}`
        );

        res.status(201).json({
            success: true,
            message: 'Event recorded successfully',
            event,
            chain,
            txid: txid.trim()
        });
    } catch (error) {
        console.error('Error recording event:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording event',
            error: error.message
        });
    }
});

/**
 * Rules - Create rule
 */
app.post('/api/rules/create', async (req, res) => {
    try {
        const { ruleName, description, triggerConditions, actions, enabled } = req.body;

        if (!ruleName || !triggerConditions || !actions) {
            return res.status(400).json({
                success: false,
                message: 'Rule name, trigger conditions, and actions are required'
            });
        }

        // Create rule object
        const rule = {
            ruleId: `RULE-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            ruleName,
            description: description || '',
            triggerConditions,
            actions,
            enabled: enabled !== false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Convert to hex
        const hexData = Buffer.from(JSON.stringify(rule)).toString('hex');

        // Store rule on main chain
        const txid = await executeCommandWithFailover(
            'main-chain',
            `publish business_rules "${ruleName}" ${hexData}`
          );

          res.status(201).json({
            success: true,
            message: 'Rule created successfully',
            rule,
            txid: txid.trim()
          });
        } catch (error) {
          console.error('Error creating rule:', error);
          res.status(500).json({
            success: false,
            message: 'Error creating rule',
            error: error.message
          });
    }
});

/**
 * Rules - Process rules
 */
app.post('/api/rules/process', async (req, res) => {
    try {
        const { event } = req.body;

        if (!event) {
            return res.status(400).json({
                success: false,
                message: 'Event object is required'
            });
        }

        // Get all rules from main chain
        const rulesData = await executeCommandWithFailover(
            'main-chain',
            'liststreamitems business_rules'
        );

        const rules = JSON.parse(rulesData).map(item => {
            return JSON.parse(Buffer.from(item.data, 'hex').toString());
        }).filter(rule => rule.enabled);

        // Process rules
        const results = [];

        for (const rule of rules) {
            try {
                const match = evaluateConditions(rule.triggerConditions, event);

                if (match) {
                    // Execute actions
                    const actionResults = await executeActions(rule.actions, event);

                    results.push({
                        ruleId: rule.ruleId,
                        ruleName: rule.ruleName,
                        matched: true,
                        actions: actionResults
                    });
                } else {
                    results.push({
                        ruleId: rule.ruleId,
                        ruleName: rule.ruleName,
                        matched: false
                    });
                }
            } catch (ruleError) {
                results.push({
                    ruleId: rule.ruleId,
                    ruleName: rule.ruleName,
                    error: ruleError.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Processed ${results.length} rules`,
            matchedRules: results.filter(r => r.matched).length,
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

// Helper function to evaluate rule conditions
function evaluateConditions(conditions, event) {
    for (const condition of conditions) {
        const { field, operator, value } = condition;
        const eventValue = event[field];

        if (eventValue === undefined) continue;

        switch (operator) {
            case '==':
                if (eventValue != value) return false;
                break;
            case '!=':
                if (eventValue == value) return false;
                break;
            case '>':
                if (!(eventValue > value)) return false;
                break;
            case '>=':
                if (!(eventValue >= value)) return false;
                break;
            case '<':
                if (!(eventValue < value)) return false;
                break;
            case '<=':
                if (!(eventValue <= value)) return false;
                break;
            case 'contains':
                if (!eventValue.includes(value)) return false;
                break;
        }
    }

    return true;
}

// Helper function to execute rule actions
async function executeActions(actions, event) {
    const results = [];

    for (const action of actions) {
        try {
            switch (action.type) {
                case 'notifyChain':
                    // Notify another chain
                    const notificationData = {
                        type: action.notificationType,
                        data: event,
                        timestamp: Date.now()
                    };

                    const hexNotification = Buffer.from(JSON.stringify(notificationData)).toString('hex');

                    const txid = await executeCommandWithFailover(
                        action.targetChain,
                        `publish notifications ${event.productId || 'system'} ${hexNotification}`
                    );

                    results.push({
                        type: action.type,
                        success: true,
                        txid: txid.trim()
                    });
                    break;

                // Add other action types as needed
            }
        } catch (error) {
            results.push({
                type: action.type,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Admin - Setup streams
 */
app.post('/api/admin/setup-streams', async (req, res) => {
    try {
        // Setup required streams on all chains
        await setupRequiredStreams();

        res.status(200).json({
            success: true,
            message: 'All required streams set up successfully'
        });
    } catch (error) {
        console.error('Error setting up streams:', error);
        res.status(500).json({
            success: false,
            message: 'Error setting up streams',
            error: error.message
        });
    }
});

/**
 * Setup required streams
 */
async function setupRequiredStreams() {
    const results = {
        'distributor-chain': [],
        'retailer-chain': [],
        'main-chain': []
    };

    // Define required streams for each chain
    const chainStreams = {
        'distributor-chain': [
            'distributor_transactions',
            'merkle_roots',
            'transaction_proofs',
            'asset_transfers',
            'asset_receipts',
            'notifications'
        ],
        'retailer-chain': [
            'retailer_transactions',
            'merkle_roots',
            'transaction_proofs',
            'asset_transfers',
            'asset_receipts',
            'notifications'
        ],
        'main-chain': [
            'sidechain_merkle_roots',
            'cross_chain_transfers',
            'cross_chain_verifications',
            'transaction_verifications',
            'business_rules',
            'product_registry',
            'product_events',
            'notifications'
        ]
    };

    // Create streams for each chain
    for (const [chain, streams] of Object.entries(chainStreams)) {
        for (const stream of streams) {
          try {
            // Try to create stream directly instead of checking first
            try {
              // Create stream
              const txid = await executeCommandWithFailover(
                chain,
                `create stream ${stream} '{"restrict":"write"}'`
              );
              
              // Subscribe to stream
              await executeCommandWithFailover(
                chain,
                `subscribe ${stream}`
              );
              
              results[chain].push({ 
                stream, 
                status: 'created',
                txid: txid.trim()
              });
            } catch (createError) {
              // Stream might already exist
              if (createError.message.includes("Stream with this name already exists")) {
                results[chain].push({ 
                  stream, 
                  status: 'already exists'
                });
              } else {
                throw createError;
              }
            }
          } catch (error) {
            results[chain].push({ 
              stream, 
              status: 'error',
              error: error.message
            });
          }
        }
      }

    return results;
}

/**
 * Cross-chain asset transfer
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

        if (!Object.keys(CHAINS).includes(sourceChain) || !Object.keys(CHAINS).includes(targetChain)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid chain specified'
            });
        }

        // Generate a unique transfer ID
        const transferId = `TRANSFER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        // 1. Lock assets on source chain
        const lockData = {
            assetName,
            quantity,
            targetChain,
            status: 'LOCKED',
            transferId,
            timestamp: Date.now(),
            metadata: metadata || {}
        };

        // Convert lock data to hex
        const hexLockData = Buffer.from(JSON.stringify(lockData)).toString('hex');

        // Record lock on source chain
        const lockTxid = await executeCommandWithFailover(
            sourceChain,
            `publish asset_transfers ${transferId} ${hexLockData}`
        );

        console.log(`Assets locked on ${sourceChain}, tx: ${lockTxid}`);

        // 2. Record the transfer intent on main chain for verification
        const mainChainData = {
            sourceChain,
            targetChain,
            assetName,
            quantity,
            transferId,
            status: 'IN_PROGRESS',
            sourceLockTxid: lockTxid,
            timestamp: Date.now()
        };

        const hexMainData = Buffer.from(JSON.stringify(mainChainData)).toString('hex');

        // Publish to main chain
        const mainTxid = await executeCommandWithFailover(
            'main-chain',
            `publish cross_chain_transfers ${transferId} ${hexMainData}`
        );

        console.log(`Transfer recorded on main-chain, tx: ${mainTxid}`);

        // 3. Create asset receipt on target chain
        const receiptData = {
            assetName,
            quantity,
            sourceChain,
            status: 'RECEIVED',
            transferId,
            mainReference: mainTxid,
            timestamp: Date.now(),
            metadata: metadata || {}
        };

        const hexReceiptData = Buffer.from(JSON.stringify(receiptData)).toString('hex');

        // Publish to target chain
        const receiptTxid = await executeCommandWithFailover(
            targetChain,
            `publish asset_receipts ${transferId} ${hexReceiptData}`
        );

        console.log(`Asset receipt created on ${targetChain}, tx: ${receiptTxid}`);

        // 4. Update main chain with completion status
        const completionData = {
            sourceChain,
            targetChain,
            assetName,
            quantity,
            transferId,
            status: 'COMPLETED',
            sourceLockTxid: lockTxid,
            targetReceiptTxid: receiptTxid,
            timestamp: Date.now()
        };

        const hexCompletionData = Buffer.from(JSON.stringify(completionData)).toString('hex');

        // Update on main chain
        const completionTxid = await executeCommandWithFailover(
            'main-chain',
            `publish cross_chain_transfers ${transferId}_completed ${hexCompletionData}`
        );

        // 5. Send notification to source chain about completion
        const notificationData = {
            type: 'TRANSFER_COMPLETED',
            transferId,
            targetChain,
            status: 'COMPLETED',
            timestamp: Date.now()
        };

        const hexNotificationData = Buffer.from(JSON.stringify(notificationData)).toString('hex');

        await executeCommandWithFailover(
            sourceChain,
            `publish notifications ${transferId} ${hexNotificationData}`
        );

        res.status(200).json({
            success: true,
            message: 'Asset transfer completed successfully',
            transferId,
            transactions: {
                sourceLock: lockTxid,
                mainRecord: mainTxid,
                targetReceipt: receiptTxid,
                completion: completionTxid
            },
            transfer: {
                sourceChain,
                targetChain,
                assetName,
                quantity,
                timestamp: Date.now()
            }
        });

    } catch (error) {
        console.error('Error in asset transfer:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing asset transfer',
            error: error.message
        });
    }
});

/**
 * Get transfer status
 */
app.get('/api/transfer/:transferId/status', async (req, res) => {
    try {
      const { transferId } = req.params;
      
      if (!transferId) {
        return res.status(400).json({
          success: false,
          message: 'Transfer ID is required'
        });
      }
      
      // Check main chain for transfer status
      try {
        const items = await executeCommandWithFailover(
          'main-chain',
          `liststreamkeyitems cross_chain_transfers ${transferId}`
        );
        
        // Fix: Handle empty response properly
        const parsedItems = JSON.parse(items || '[]');
        
        if (!parsedItems || parsedItems.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Transfer not found'
          });
        }
        
        // Get the transfer data - add proper null checks
        const transferData = parsedItems[0].data ? 
          JSON.parse(Buffer.from(parsedItems[0].data, 'hex').toString()) :
          { status: 'UNKNOWN' };
        
        // Check if completed
        const completedItems = await executeCommandWithFailover(
          'main-chain',
          `liststreamkeyitems cross_chain_transfers ${transferId}_completed`
        );
        
        let status = transferData.status;
        let completionData = null;
        
        // Fix: Parse completed items with proper checks
        const parsedCompletedItems = JSON.parse(completedItems || '[]');
        
        if (parsedCompletedItems && parsedCompletedItems.length > 0 && parsedCompletedItems[0].data) {
          completionData = JSON.parse(Buffer.from(parsedCompletedItems[0].data, 'hex').toString());
          status = completionData.status;
        }
        
        res.status(200).json({
          success: true,
          transferId,
          status,
          transferData,
          completionData
        });
      } catch (error) {
        if (error.message.includes('Stream with this name not found')) {
          return res.status(404).json({
            success: false,
            message: 'Transfer system not initialized'
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error getting transfer status:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving transfer status',
        error: error.message
      });
    }
  });

/**
 * Start the server
 */
app.listen(PORT, () => {
    console.log(`Relay API server running on port ${PORT}`);

    // Ensure required streams exist
    setupRequiredStreams().then(results => {
        console.log('Stream setup complete:', JSON.stringify(results, null, 2));
    }).catch(error => {
        console.error('Failed to set up streams:', error);
    });
});