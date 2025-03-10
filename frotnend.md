# TechChain API Mapping

This document maps all API endpoints available in the relay service for frontend integration.

## Authentication Endpoints

| Endpoint | Method | Request Data | Response Data | Frontend Component |
|----------|--------|--------------|---------------|-------------------|
| `/api/login` | POST | `{ entityId, password }` | `{ success, message, entity: { id, type, name, role, apiKey }, profile }` | AuthLayout/Login |
| `/api/register/manufacturer` | POST | `{ name, contactInfo, location, password }` | `{ success, message, entity: { id, name, apiKey } }` | AuthLayout/Register |
| `/api/register/distributor` | POST | `{ name, contactInfo, location, password }` | `{ success, message, entity: { id, name, apiKey } }` | AuthLayout/Register |
| `/api/register/retailer` | POST | `{ name, contactInfo, location, password }` | `{ success, message, entity: { id, name, apiKey } }` | AuthLayout/Register |

## Manufacturer Endpoints

| Endpoint | Method | Request Data | Response Data | Frontend Component |
|----------|--------|--------------|---------------|-------------------|
| `/api/products/register` | POST | `{ name, description, category, specifications, quantity, unitPrice }` | `{ success, productId, name, serialNumberCount, merkleRoot, txid }` | ManufacturerProducts/NewProduct |
| `/api/products/:productId` | GET | - | `{ success, product }` | ManufacturerProducts/ProductDetail |
| `/api/products/:productId/serial-numbers` | GET | - | `{ success, productId, serialNumbers, count }` | ManufacturerProducts/ProductDetail |
| `/api/manufacturer/products/:productId/serials` | GET | - | `{ success, productId, productName, serialNumbers, count, merkleRoot }` | ManufacturerProducts/ProductDetail |
| `/api/manufacturer/sensitive-data/:productId` | GET | - | `{ success, productId, productName, manufacturingData }` | ManufacturerProducts/ProductDetail |

## Distributor Endpoints

| Endpoint | Method | Request Data | Response Data | Frontend Component |
|----------|--------|--------------|---------------|-------------------|
| `/api/distributor/receive-from-manufacturer` | POST | `{ productId, serialNumbers, manufacturerId }` | `{ success, receiptId, productId, quantity, txid }` | DistributorInventory/ReceiveInventory |
| `/api/distributor/shipment/create` | POST | `{ productId, serialNumbers, retailerId, shipmentDetails }` | `{ success, shipmentId, productId, retailerId, quantity }` | DistributorShipments/NewShipment |
| `/api/distributor/shipments` | GET | - | `{ success, distributorId, shipments }` | DistributorShipments |
| `/api/distributor/inventory` | GET | - | `{ success, distributorId, inventory }` | DistributorInventory |
| `/api/distributor/shipment/:shipmentId/logistics` | GET | - | `{ success, shipmentId, logistics }` | DistributorShipments/ShipmentDetail |

## Retailer Endpoints

| Endpoint | Method | Request Data | Response Data | Frontend Component |
|----------|--------|--------------|---------------|-------------------|
| `/api/retailer/receive-from-distributor` | POST | `{ shipmentId, productId, serialNumbers, distributorId }` | `{ success, receiptId, productId, quantity, txid }` | RetailerInventory/ReceiveInventory |
| `/api/retailer/inventory` | GET | - | `{ success, retailerId, inventory }` | RetailerInventory |
| `/api/retailer/sales/record` | POST | `{ productId, serialNumber, price, customerId, customerInfo, paymentDetails }` | `{ success, saleId, productId, serialNumber, txid }` | RetailerSales/NewSale |
| `/api/retailer/sales/history` | GET | - | `{ success, retailerId, sales }` | RetailerSales |
| `/api/retailer/sales/:saleId/customer-data` | GET | - | `{ success, saleId, customerData }` | RetailerSales/SaleDetail |
| `/api/retailer/sales/daily-summary` | POST | `{ date, salesData }` | `{ success, summaryId, date, merkleRoot }` | RetailerSales/Summary |
| `/api/retailer/returns/process` | POST | `{ saleId, productId, serialNumber, reason }` | `{ success, returnId, saleId, productId, serialNumber }` | RetailerReturns/ProcessReturn |
| `/api/retailer/returns/history` | GET | - | `{ success, retailerId, returns }` | RetailerReturns/History |

## Verification Endpoints

| Endpoint | Method | Request Data | Response Data | Frontend Component |
|----------|--------|--------------|---------------|-------------------|
| `/api/verify/product/:serialNumber` | GET | - | `{ success, serialNumber, productId, productInfo, currentLocation, authenticity }` | VerifyProduct |
| `/api/verify/product/:serialNumber/merkle-proof` | GET | - | `{ success, verified, merkleRoot, registeredRoot, rootsMatch, proof, productName }` | VerifyProduct/Detail |

## Data Structures
- Common Response Objects
- Product Object
- Inventory Item
- Sale Record
- Return Record
- Shipment Record

## Authentication Flow
1. User submits login credentials via `/api/login`
2. On success, store API key and entity info in localStorage
3. Include API key in all subsequent requests via x-api-key header
4. Redirect to the appropriate dashboard based on entity type

## Entity-Specific Pages

### Manufacturer
- Products list and creation
- Transfer history
- Sensitive manufacturing data access

### Distributor
- Inventory management
- Receive from manufacturer
- Create shipments to retailer
- Shipment history

### Retailer
- Inventory management
- Receive from distributor
- Sales recording
- Returns processing
- Sales reports

### Public
- Product verification by serial number

```
frontend/
├── public/
│   └── assets/
│       └── logo.svg
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── Tabs.jsx
│   │   │   └── Chart.jsx
│   ├── hooks/
│   │   └── useApi.js
│   ├── layouts/
│   │   ├── AuthLayout.jsx
│   │   ├── DashboardLayout.jsx
│   │   └── VerificationLayout.jsx
│   ├── pages/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   │   └── Index.jsx
│   │   ├── manufacturer/
│   │   │   ├── Products.jsx
│   │   │   └── Transfers.jsx
│   │   ├── distributor/
│   │   │   ├── Inventory.jsx
│   │   │   └── Shipments.jsx
│   │   ├── retailer/
│   │   │   ├── Inventory.jsx
│   │   │   ├── Sales.jsx
│   │   │   └── Returns.jsx
│   │   └── verification/
│   │       └── VerifyProduct.jsx
│   ├── services/
│   │   └── api.js
│   ├── App.jsx
│   ├── routes.jsx
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js

```