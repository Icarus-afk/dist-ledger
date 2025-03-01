
### Project Title

**Utilizing Multichain Technology to Enhance Efficiency in Supply Chain Management**

---

### 1. **Introduction**

This document outlines the functional requirements for a blockchain-based supply chain management system utilizing a multichain architecture with the following components:

- Distributor Sidechain
- Retailer Sidechain
- Mainchain
- Relay Node for cross-chain communication
- Off-chain storage for large and sensitive data

The system ensures secure, private, and verifiable data sharing between participants while maintaining operational efficiency, data integrity, and privacy.

---

### 2. **System Overview**

#### 2.1 Objective

The system facilitates secure and efficient supply chain management by:

- Storing detailed participant-specific data in **sidechains**.
- Sharing summarized, verifiable data with a **mainchain**.
- Using **relay nodes** for fault-tolerant cross-chain communication.
- Leveraging **off-chain storage** for large datasets.

#### 2.2 Key Features

- **Privacy**: Sensitive data remains private within sidechains.
- **Data Integrity**: Merkle proofs validate cross-chain data exchanges.
- **Scalability**: Modular architecture allows for new participants or functionalities.
- **Efficiency**: Relay nodes and off-chain storage reduce on-chain data load.

---

### 3. **Functional Requirements**

#### 3.1 Distributor Sidechain

**Responsibilities**:

1. Record procurement, inventory management, quality checks, and shipment updates.
2. Generate Merkle roots summarizing transaction batches.
3. Share Merkle roots with the Mainchain via the Relay Node.

**Data Schema**: **Block Schema**:

| Attribute           | Type      | Description                                                    |
| ------------------- | --------- | -------------------------------------------------------------- |
| Block ID            | String    | Unique identifier for the block (e.g., `DIST-BLOCK-001`).      |
| Previous Block Hash | String    | Hash of the previous block in the chain.                       |
| Timestamp           | Timestamp | Time of block creation.                                        |
| Transaction Count   | Integer   | Number of transactions in the block.                           |
| Merkle Root         | String    | Root of the Merkle tree summarizing transactions in the block. |
| Validator Signature | String    | Validator's digital signature.                                 |

**Transaction Schema**:

| Attribute      | Type      | Description                                                                |
| -------------- | --------- | -------------------------------------------------------------------------- |
| Transaction ID | String    | Unique identifier for the transaction (e.g., `DIST-TXN-1234`).             |
| Type           | Enum      | Type of transaction: `PROCUREMENT`, `INVENTORY_UPDATE`, `SHIPMENT_UPDATE`. |
| Related Entity | String    | Reference to Manufacturer or Retailer ID.                                  |
| Product ID     | String    | Identifier for the product.                                                |
| Quantity       | Integer   | Quantity involved in the transaction.                                      |
| Status         | String    | Status of the transaction: `PENDING`, `COMPLETED`.                         |
| Timestamp      | Timestamp | Time the transaction was created.                                          |

**Behaviour**:

1. **Data Recording**:
    - Records transactions in blocks until the transaction limit is reached (e.g., 10 transactions).
    - Validates each transaction locally before adding it to the chain.
2. **Merkle Root Generation**:
    - Batches transactions into a Merkle tree and computes the root.
3. **Data Sharing**:
    - Sends Merkle roots and related metadata to the Mainchain via the Relay Node.

---

#### 3.2 Retailer Sidechain

**Responsibilities**:

1. Record inventory updates, customer orders, and sales data.
2. Request shipment proofs from the Distributor Sidechain.
3. Generate Merkle roots for transaction summaries.

**Data Schema**: **Block Schema**:  
(Same structure as Distributor Sidechain)

**Transaction Schema**:

| Attribute      | Type      | Description                                                               |
| -------------- | --------- | ------------------------------------------------------------------------- |
| Transaction ID | String    | Unique identifier for the transaction.                                    |
| Type           | Enum      | Type of transaction: `INVENTORY_UPDATE`, `CUSTOMER_ORDER`, `SALE_RECORD`. |
| Product ID     | String    | Identifier for the product.                                               |
| Quantity       | Integer   | Quantity involved in the transaction.                                     |
| Related Entity | String    | Reference to Distributor ID or Customer ID.                               |
| Timestamp      | Timestamp | Time the transaction was created.                                         |

**Behaviour**:

1. **Data Recording**:
    - Tracks inventory received, updates stock levels, and records sales.
2. **Data Verification**:
    - Uses Merkle proofs from the Distributor Sidechain for shipment validation.
3. **Merkle Root Generation**:
    - Summarizes transaction data into a Merkle tree and sends the root to the Mainchain.

---

#### 3.3 Mainchain

**Responsibilities**:

1. Validate and store Merkle roots from Distributor and Retailer Sidechains.
2. Facilitate cross-chain data verification.
3. Implement PoA-based consensus for block validation.

**Data Schema**:

|Attribute|Type|Description|
|---|---|---|
|Block ID|String|Unique identifier for the block (e.g., `MAIN-BLOCK-001`).|
|Previous Block Hash|String|Hash of the previous block in the chain.|
|Timestamp|Timestamp|Time of block creation.|
|Sidechain Roots|List|List of Merkle roots received from sidechains.|
|Validator Signature|String|Digital signature of the validator confirming the block’s validity.|

**Behaviour**:

1. **Merkle Root Validation**:
    - Verifies Merkle roots and validator signatures from sidechains.
2. **Consensus Mechanism**:
    - Implements a PoA mechanism with trusted validators.
3. **Cross-Chain Verification**:
    - Provides validated Merkle roots to sidechains for verification requests.

---

#### 3.4 Relay Node

**Responsibilities**:

1. Act as an intermediary between sidechains and the Mainchain.
2. Handle Merkle proof validation and fault detection.

**Behaviour**:

1. **Data Validation**:
    - Validates Merkle proofs before sending data to the Mainchain.
2. **Fault Detection**:
    - Detects mismatches in Merkle proofs or hash values and triggers rollbacks.
3. **Data Sharing**:
    - Facilitates secure cross-chain data sharing between sidechains.

---

#### 3.5 Off-Chain Storage

**Responsibilities**:

1. Store large datasets like quality control reports and shipment logs.
2. Provide references (e.g., hashes, IPFS CIDs) for on-chain transactions.

**Data Schema**:

|Attribute|Type|Description|
|---|---|---|
|File Hash|String|Hash of the file stored off-chain (e.g., SHA-256).|
|Storage Identifier|String|Reference to the file’s location (e.g., IPFS CID or cloud URL).|
|Access Metadata|JSON|Permissions for accessing the file.|

**Behaviour**:

1. **Data Storage**:
    - Files are hashed and stored off-chain.
2. **Access Control**:
    - Permissions are enforced based on user roles.
3. **Integrity Verification**:
    - File hashes are compared to on-chain references to ensure integrity.

---
### 4 **Validator Design and Assignment**

#### 4.1. Distributor Sidechain Validators

**Role**: Validate and sign blocks containing distributor-specific transactions.

- **Who**:
    
    - **Supply Chain Management Team**: Specifically, individuals or departments responsible for procurement, inventory updates, and quality checks.
    - **Trusted Distributor Nodes**: Authorized nodes within the distributor’s private blockchain network.
- **Why**:
    
    - The supply chain team understands the data flow for procurement and shipments, ensuring accurate and validated transactions.
    - Trusted distributor nodes add redundancy and ensure a consensus mechanism is maintained.

---

#### 4.2. Retailer Sidechain Validators

**Role**: Validate and sign blocks related to retail operations such as inventory updates, sales records, and customer orders.

- **Who**:
    
    - **Retailer Operations Team**: Departments responsible for managing sales, inventory, and customer orders.
    - **Authorized Retailer Nodes**: Trusted blockchain nodes within the retailer’s network.
- **Why**:
    
    - Retailer operations teams ensure that sales and inventory data are correctly validated.
    - Trusted nodes within the retailer’s sidechain provide decentralized validation for fault tolerance.

---

#### 4.3. Mainchain Validators

**Role**: Validate Merkle roots submitted by sidechains and ensure cross-chain data integrity.

- **Who**:
    
    - **Trusted Representatives from Each Stakeholder**:
        - One validator from the distributor side.
        - One validator from the retailer side.
        - Optional: Third-party neutral validators (e.g., auditors, regulatory bodies).
    - **Relay Node as a Validator**:
        - In some setups, the Relay Node can act as a validator by checking Merkle roots and signing blocks on the mainchain.
- **Why**:
    
    - Including trusted representatives ensures transparency and fairness in cross-chain validation.
    - A third-party validator can add an extra layer of trust and accountability.

---

#### 4.4. Validator Selection Process

1. **Criteria for Validators**:
    
    - **Technical Capability**: Validators must have the infrastructure to participate in the blockchain network.
    - **Trustworthiness**: Validators are selected from trusted entities or personnel within the organization.
    - **Availability**: Validators should be online and available to validate transactions in real-time.
2. **Consensus Mechanism**:
    
    - The sidechains and mainchain use **Proof of Authority (PoA)**, meaning only authorized validators can sign blocks.
    - Validators are assigned by roles and permissions in a permissioned blockchain system like Hyperledger Fabric.

---

#### 4.5. Example Assignment for Validators

|Chain|Validators|Role|
|---|---|---|
|Distributor Sidechain|Distributor Supply Chain Team|Validate procurement, inventory, and shipment blocks.|
|Retailer Sidechain|Retailer Operations Team|Validate sales and inventory transactions.|
|Mainchain|Representatives from both stakeholders, Optional: Relay Node|Validate Merkle roots and cross-chain integrity.|

---

#### 4.6 .Security for Validators

1. **Digital Signatures**:
    
    - Validators sign blocks and Merkle roots using their private keys.
    - Other participants verify signatures with the corresponding public keys.
2. **Role-Based Access Control**:
    
    - Only designated validators can validate and sign blocks.
    - Permissioning ensures unauthorized nodes cannot participate.
3. **Auditing**:
    
    - All validator actions are logged for transparency and accountability.
    - Logs include block signing, approvals, and validation timestamps.
### 5. **Integration and Workflows**

#### 5.1 Cross-Chain Data Verification Workflow

1. Distributor sends a shipment update Merkle root to the Mainchain.
2. Retailer requests verification of the shipment from the Distributor Sidechain.
3. Relay Node facilitates verification using the Merkle proof.
4. Mainchain confirms the proof against the stored Merkle root.

#### 5.2 Off-Chain Data Retrieval Workflow

1. Distributor stores a quality control report off-chain and records its hash on-chain.
2. Retailer requests access to the report.
3. Relay Node verifies the request and provides the file reference.
4. Retailer retrieves the file and verifies its integrity using the on-chain hash.

---

### 6. **Security and Fault Tolerance**

1. **Encryption**:
    - All communication between components uses TLS for secure data transfer.
2. **Role-Based Access Control**:
    - Permissions are enforced for on-chain and off-chain data access.
3. **Fault Detection**:
    - Relay Node identifies mismatched hashes and triggers rollbacks.
4. **Auditing**:
    - All transactions and data access requests are logged for auditing.

---

### 7. **Implementation Plan**

1. **Blockchain Framework**:
    - Use Hyperledger Fabric or Ethereum-based private blockchain for sidechains and Mainchain.
2. **Relay Node**:
    - Implement as a gRPC microservice for communication between chains.
3. **Off-Chain Storage**:
    - Use IPFS for decentralized storage or AWS S3 for centralized storage.



