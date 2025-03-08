1. Core System Functions
Chain Management
initializeChain(chainType) - Initialize specific blockchain (main, distributor, retailer)
connectChains() - Establish connections between the three chains
getChainStatus(chainName) - Get current status and metrics for a chain
verifyChainIntegrity(chainName) - Verify blockchain integrity
Authentication & Authorization
registerEntity(entityType, entityDetails) - Register a new participant
authenticateEntity(entityId, credentials) - Authenticate participant
authorizeAction(entityId, actionType, resource) - Check permissions
Merkle Tree Functions
generateMerkleTree(transactions) - Create Merkle tree from transactions
getMerkleRoot(treeData) - Extract root hash
generateMerkleProof(tree, transactionIndex) - Generate proof for specific transaction
verifyMerkleProof(root, proof, transaction) - Verify transaction inclusion
2. Main Chain APIs
Product Registration
POST /api/products/register - Register new product

Input: product details, specifications, quantity
Output: productId, serial number range, registration confirmation
GET /api/products/{productId} - Get product details

Output: complete product information
POST /api/products/{productId}/merkle - Generate Merkle tree for product batch

Output: Merkle root, batch verification data
Cross-Chain Coordination
POST /api/main/chainroots - Store Merkle roots from sidechains

Input: chainId, blockId, merkleRoot
Output: verification status
GET /api/main/verify/transaction - Verify transaction across chains

Input: transactionId, chainId
Output: verification status, proof
GET /api/main/product/history/{serialNumber} - Get complete product history

Output: full chain of custody
3. Distributor Chain APIs
Receiving Management
POST /api/distributor/receive-from-manufacturer - Record receipt of goods

Input: productId, quantity, serialNumbers, manufacturerId
Output: receipt confirmation, transaction details
GET /api/distributor/pending-shipments - List pending incoming shipments

Output: pending shipments from manufacturers
GET /api/distributor/received-shipments - List completed receipts

Output: history of received shipments
Inventory Management
GET /api/distributor/inventory - Get current inventory

Output: stock levels by product
POST /api/distributor/inventory/update - Update inventory levels

Input: productId, quantityChange, reason
Output: updated inventory status
POST /api/distributor/inventory/audit - Perform inventory audit

Input: audit details, stock counts
Output: discrepancies, audit results
Shipment Management
POST /api/distributor/shipment/create - Create outbound shipment to retailer

Input: productIds, quantities, serialNumbers, retailerId
Output: shipmentId, tracking information
GET /api/distributor/shipments - List all shipments

Output: shipment history with status
PUT /api/distributor/shipment/{shipmentId}/status - Update shipment status

Input: status, statusDetails
Output: updated shipment record
Dashboard and Analytics
GET /api/distributor/dashboard - Get dashboard data

Output: inventory summary, pending shipments, recent activity
GET /api/distributor/analytics/inventory - Inventory movement analytics

Output: inventory turnover, stock levels over time
4. Retailer Chain APIs
Receiving Management
POST /api/retailer/receive-from-distributor - Record receipt from distributor

Input: shipmentId, productIds, quantities, serialNumbers, distributorId
Output: receipt confirmation
GET /api/retailer/pending-receipts - List pending deliveries

Output: expected shipments from distributors
Inventory Management
GET /api/retailer/inventory - Get store inventory

Output: current stock by product/location
POST /api/retailer/inventory/update - Update inventory

Input: productId, quantityChange, reason
Output: updated inventory status
Sales Recording
POST /api/retailer/sales/record - Record customer sale

Input: productId, serialNumber, quantity, price, customerId
Output: sale confirmation, warranty activation
GET /api/retailer/sales/history - Get sales history

Output: historical sales records
POST /api/retailer/sales/daily-summary - Submit daily sales summary

Input: date, aggregated sales data
Output: confirmation, merkle root for verification
Returns and Exchanges
POST /api/retailer/returns/process - Process customer return

Input: saleId, productId, serialNumber, reason
Output: return confirmation, updated inventory
GET /api/retailer/returns/history - Get returns history

Output: processed returns
5. Cross-Chain Verification Functions
verifyProductProvenance(serialNumber) - Trace product through supply chain
verifyTransactionAcrossChains(transactionId) - Verify transaction across multiple chains
syncMerkleRoots() - Synchronize Merkle roots across chains
generateCrossChainProof(sourceChain, targetChain, transactionId) - Generate proof valid across chains
6. Event Handlers
onProductRegistered(productData) - Handle new product registration
onShipmentCreated(shipmentData) - Handle new shipment creation
onProductReceived(receiptData) - Handle product receipt
onProductSold(saleData) - Handle product sale to customer
onInventoryChanged(inventoryData) - Handle inventory updates
onBlockCreated(blockData) - Handle new block creation
onMerkleRootGenerated(rootData) - Handle new Merkle root
7. Database Functions
storeTransaction(chainId, transaction) - Store transaction in database
queryTransactionHistory(filters) - Query transaction history
updateTransactionStatus(transactionId, status) - Update transaction status
linkCrossChainTransactions(transactionIds) - Link related transactions across chains
8. Helper Functions
generateSerialNumbers(productId, quantity) - Generate unique serial numbers
validateSerialNumbers(serialNumbers) - Validate serial number format and uniqueness
calculateInventoryMetrics(inventoryData) - Calculate inventory KPIs
formatTransactionForBlock(transactionData) - Format transaction for blockchain
signTransaction(transactionData, privateKey) - Sign transaction with entity key
1. Core System Functions
Chain Management
initializeChain(chainType) - Initialize specific blockchain (main, distributor, retailer)
connectChains() - Establish connections between the three chains
getChainStatus(chainName) - Get current status and metrics for a chain
verifyChainIntegrity(chainName) - Verify blockchain integrity
Authentication & Authorization
registerEntity(entityType, entityDetails) - Register a new participant
authenticateEntity(entityId, credentials) - Authenticate participant
authorizeAction(entityId, actionType, resource) - Check permissions
Merkle Tree Functions
generateMerkleTree(transactions) - Create Merkle tree from transactions
getMerkleRoot(treeData) - Extract root hash
generateMerkleProof(tree, transactionIndex) - Generate proof for specific transaction
verifyMerkleProof(root, proof, transaction) - Verify transaction inclusion
2. Main Chain APIs
Product Registration
POST /api/products/register - Register new product

Input: product details, specifications, quantity
Output: productId, serial number range, registration confirmation
GET /api/products/{productId} - Get product details

Output: complete product information
POST /api/products/{productId}/merkle - Generate Merkle tree for product batch

Output: Merkle root, batch verification data
Cross-Chain Coordination
POST /api/main/chainroots - Store Merkle roots from sidechains

Input: chainId, blockId, merkleRoot
Output: verification status
GET /api/main/verify/transaction - Verify transaction across chains

Input: transactionId, chainId
Output: verification status, proof
GET /api/main/product/history/{serialNumber} - Get complete product history

Output: full chain of custody
3. Distributor Chain APIs
Receiving Management
POST /api/distributor/receive-from-manufacturer - Record receipt of goods

Input: productId, quantity, serialNumbers, manufacturerId
Output: receipt confirmation, transaction details
GET /api/distributor/pending-shipments - List pending incoming shipments

Output: pending shipments from manufacturers
GET /api/distributor/received-shipments - List completed receipts

Output: history of received shipments
Inventory Management
GET /api/distributor/inventory - Get current inventory

Output: stock levels by product
POST /api/distributor/inventory/update - Update inventory levels

Input: productId, quantityChange, reason
Output: updated inventory status
POST /api/distributor/inventory/audit - Perform inventory audit

Input: audit details, stock counts
Output: discrepancies, audit results
Shipment Management
POST /api/distributor/shipment/create - Create outbound shipment to retailer

Input: productIds, quantities, serialNumbers, retailerId
Output: shipmentId, tracking information
GET /api/distributor/shipments - List all shipments

Output: shipment history with status
PUT /api/distributor/shipment/{shipmentId}/status - Update shipment status

Input: status, statusDetails
Output: updated shipment record
Dashboard and Analytics
GET /api/distributor/dashboard - Get dashboard data

Output: inventory summary, pending shipments, recent activity
GET /api/distributor/analytics/inventory - Inventory movement analytics

Output: inventory turnover, stock levels over time
4. Retailer Chain APIs
Receiving Management
POST /api/retailer/receive-from-distributor - Record receipt from distributor

Input: shipmentId, productIds, quantities, serialNumbers, distributorId
Output: receipt confirmation
GET /api/retailer/pending-receipts - List pending deliveries

Output: expected shipments from distributors
Inventory Management
GET /api/retailer/inventory - Get store inventory

Output: current stock by product/location
POST /api/retailer/inventory/update - Update inventory

Input: productId, quantityChange, reason
Output: updated inventory status
Sales Recording
POST /api/retailer/sales/record - Record customer sale

Input: productId, serialNumber, quantity, price, customerId
Output: sale confirmation, warranty activation
GET /api/retailer/sales/history - Get sales history

Output: historical sales records
POST /api/retailer/sales/daily-summary - Submit daily sales summary

Input: date, aggregated sales data
Output: confirmation, merkle root for verification
Returns and Exchanges
POST /api/retailer/returns/process - Process customer return

Input: saleId, productId, serialNumber, reason
Output: return confirmation, updated inventory
GET /api/retailer/returns/history - Get returns history

Output: processed returns
5. Cross-Chain Verification Functions
verifyProductProvenance(serialNumber) - Trace product through supply chain
verifyTransactionAcrossChains(transactionId) - Verify transaction across multiple chains
syncMerkleRoots() - Synchronize Merkle roots across chains
generateCrossChainProof(sourceChain, targetChain, transactionId) - Generate proof valid across chains
6. Event Handlers
onProductRegistered(productData) - Handle new product registration
onShipmentCreated(shipmentData) - Handle new shipment creation
onProductReceived(receiptData) - Handle product receipt
onProductSold(saleData) - Handle product sale to customer
onInventoryChanged(inventoryData) - Handle inventory updates
onBlockCreated(blockData) - Handle new block creation
onMerkleRootGenerated(rootData) - Handle new Merkle root
7. Database Functions
storeTransaction(chainId, transaction) - Store transaction in database
queryTransactionHistory(filters) - Query transaction history
updateTransactionStatus(transactionId, status) - Update transaction status
linkCrossChainTransactions(transactionIds) - Link related transactions across chains
8. Helper Functions
generateSerialNumbers(productId, quantity) - Generate unique serial numbers
validateSerialNumbers(serialNumbers) - Validate serial number format and uniqueness
calculateInventoryMetrics(inventoryData) - Calculate inventory KPIs
formatTransactionForBlock(transactionData) - Format transaction for blockchain
signTransaction(transactionData, privateKey) - Sign transaction with entity key
