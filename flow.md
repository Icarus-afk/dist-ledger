# MultiChain Setup Process

## Initial Setup

#### Make sure the script is executable
`chmod +x scripts/manage.sh`

#### 1. Reset everything (stops chains, deletes data, creates new chains)
`./scripts/manage.sh reset`

#### 2. Start the chains
`./scripts/manage.sh start`

#### 3. Set up PoA and streams
`./scripts/manage.sh setup`

### Multi-Node Setup (Optional)

#### 4. Set up multi-node environment
`./scripts/manage.sh setup_multi_node`

#### 5. Check that everything is running
`./scripts/manage.sh status
./scripts/manage.sh check_peers
`
### Using the Relay Node

#### Start the relay node
`npm start`

#### Test with a transaction
`curl -X POST http://localhost:3000/api/distributor/transaction \
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
`
#### Relay a Merkle root from the latest block
`BLOCK_HASH=$(curl -s http://localhost:3000/api/chain/distributor-chain/latest-block | grep -o '"hash":"[^"]*"' | head -1 | sed 's/"hash":"//;s/"//g')`

`curl -X POST http://localhost:3000/api/relay/merkleroot \
  -H "Content-Type: application/json" \
  -d "{
    \"sourceChain\": \"distributor-chain\",
    \"blockHash\": \"$BLOCK_HASH\"
  }"`



>[!Remember]
> - The `setup_multi_node` script is optional and is only needed if you want to set up a multi-node environment.
>- If you have already set up the multi-node environment, you can skip the `setup_multi_node` script.
>- The `status` and `check_peers` commands are used to check the status of the chains and the peers, respectively.

## Rerunning the chains and nodes

#### First, start the main nodes (node0 for each chain)
`./scripts/manage.sh start`

#### Then force connections which will also restart any peer nodes that aren't running
`./scripts/manage.sh force_connections`

#### Check all peers are connected properly
`./scripts/manage.sh check_peers`