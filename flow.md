# MultiChain Setup Process

## Initial Setup

# Make sure the script is executable
chmod +x scripts/manage.sh

# 1. Reset everything (stops chains, deletes data, creates new chains)
./scripts/manage.sh reset

# 2. Start the chains
./scripts/manage.sh start

# 3. Set up PoA and streams
./scripts/manage.sh setup

## Multi-Node Setup (Optional)

# 4. Set up multi-node environment
./scripts/manage.sh setup_multi_node

# 5. Check that everything is running
./scripts/manage.sh status
./scripts/manage.sh check_peers

## Using the Relay Node

# Start the relay node
npm start

# Test with a transaction
curl -X POST http://localhost:3000/api/distributor/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "transactionType": "RECEIVE",
    "productId": "PROD001",
    "quantity": 100,
    "relatedEntity": "MANF001",
    "additionalData": {
      "qualityCheck": "passed",
      "deliveryNote": "DN12345"
    }
  }'

# Relay a Merkle root from the latest block
BLOCK_HASH=$(curl -s http://localhost:3000/api/chain/distributor-chain/latest-block | grep -o '"hash":"[^"]*"' | head -1 | sed 's/"hash":"//;s/"//g')

curl -X POST http://localhost:3000/api/relay/merkleroot \
  -H "Content-Type: application/json" \
  -d "{
    \"sourceChain\": \"distributor-chain\",
    \"blockHash\": \"$BLOCK_HASH\"
  }"