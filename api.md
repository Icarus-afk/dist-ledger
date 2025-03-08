# TechChain API Reference Guide

## AUTHENTICATION
Most endpoints require API key authentication:

- Include in request header: `x-api-key: YOUR_API_KEY`
- API keys are issued when entities register with the system
- Each entity type (manufacturer, distributor, retailer) has access to specific endpoints

## REGISTRATION ENDPOINTS

### REGISTER MANUFACTURER
- **POST** `/api/register/manufacturer`
- No authentication required
- Request body: `{"name": "Company Name", "contactInfo": {...}, "location": "..."}`
- Response: Returns manufacturer ID and API key for future authentication

### REGISTER DISTRIBUTOR
- **POST** `/api/register/distributor`
- No authentication required
- Request body: `{"name": "Company Name", "contactInfo": {...}, "location": "..."}`
- Response: Returns distributor ID and API key

### REGISTER RETAILER
- **POST** `/api/register/retailer`
- No authentication required
- Request body: `{"name": "Store Name", "contactInfo": {...}, "location": "..."}`
- Response: Returns retailer ID and API key

## MANUFACTURER ENDPOINTS

### REGISTER PRODUCT
- **POST** `/api/products/register`
- Auth: Manufacturer API key
- Request body: `{"name": "Product Name", "description": "...", "category": "...", "specifications": {...}, "quantity": 100}`
- Response: Returns product ID, generated serial numbers, and Merkle root

### GET PRODUCT SERIAL NUMBERS
- **GET** `/api/products/{productId}/serial-numbers`
- Auth: Manufacturer API key
- Response: Returns list of serial numbers for the specific product

### TRANSFER PRODUCT TO DISTRIBUTOR
- **POST** `/api/manufacturer/transfer`
- Auth: Manufacturer API key
- Request body: `{"productId": "...", "distributorId": "...", "serialNumbers": [...], "shipmentDetails": {...}}`
- Response: Returns transfer confirmation and transaction ID

## DISTRIBUTOR ENDPOINTS

### CONFIRM PRODUCT RECEIPT
- **POST** `/api/distributor/receive`
- Auth: Distributor API key
- Request body: `{"transferId": "...", "serialNumbers": [...]}`
- Response: Returns receipt confirmation

### CHECK INVENTORY
- **GET** `/api/distributor/inventory`
- Auth: Distributor API key
- Response: Returns current inventory with product details

### TRANSFER TO RETAILER
- **POST** `/api/distributor/transfer`
- Auth: Distributor API key
- Request body: `{"productId": "...", "retailerId": "...", "serialNumbers": [...], "shipmentDetails": {...}}`
- Response: Returns transfer confirmation and transaction ID

## RETAILER ENDPOINTS

### CONFIRM PRODUCT RECEIPT
- **POST** `/api/retailer/receive`
- Auth: Retailer API key
- Request body: `{"transferId": "...", "serialNumbers": [...]}`
- Response: Returns receipt confirmation

### REGISTER PRODUCT SALE
- **POST** `/api/retailer/sales/register`
- Auth: Retailer API key
- Request body: `{"serialNumber": "...", "saleDetails": {...}, "customerInfo": {...}}`
- Response: Returns sale confirmation and transaction ID

### PROCESS PRODUCT RETURN
- **POST** `/api/retailer/returns/process`
- Auth: Retailer API key
- Request body: `{"serialNumber": "...", "returnReason": "...", "condition": "..."}`
- Response: Returns return confirmation and updated inventory status

### GENERATE DAILY SALES SUMMARY
- **GET** `/api/retailer/sales/daily-summary?date=YYYY-MM-DD`
- Auth: Retailer API key
- Response: Returns aggregated sales data for specified date

## VERIFICATION ENDPOINTS

### VERIFY PRODUCT AUTHENTICITY
- **GET** `/api/verify/product/{serialNumber}`
- No authentication required
- Response: Returns product authenticity status and basic product details

### GET PRODUCT MERKLE PROOF
- **GET** `/api/verify/product/{serialNumber}/merkle-proof`
- No authentication required
- Response: Returns cryptographic proof of product authenticity and verification result

### GET PRODUCT HISTORY
- **GET** `/api/verify/product/{serialNumber}/history`
- No authentication required
- Response: Returns timeline of product journey through supply chain

## SYSTEM DIAGNOSTIC ENDPOINTS

### GET PRODUCT DATA
- **GET** `/api/system/diagnostic/product/{productId}`
- Admin access only
- Response: Returns raw product data from blockchain including Merkle root information

### GET ENTITY STATUS
- **GET** `/api/system/entities/{entityType}/{entityId}/status`
- Admin access only
- Response: Returns entity information and all associated streams/transactions
