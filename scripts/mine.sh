#!/bin/bash
# filepath: /home/lothrok/Documents/projects/dist-ledger/scripts/mine.sh
PROJECT_DIR="/home/lothrok/Documents/projects/dist-ledger"

function force_mine_blocks() {
  chain=$1
  count=$2
  
  echo "Checking mining permissions on $chain..."
  
  # First, get an address we can use
  ADDRESS=$(multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain getaddresses | grep -o '"[^"]*"' | head -1 | tr -d '"')
  
  if [ -z "$ADDRESS" ]; then
    echo "❌ No address found for $chain"
    return 1
  fi
  
  echo "Using address: $ADDRESS"
  
  # Check if address has mining permission
  HAS_MINE=$(multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain listpermissions mine $ADDRESS | grep -c "mine")
  
  if [ "$HAS_MINE" -eq 0 ]; then
    echo "⚠️ Address doesn't have mining permission, granting..."
    multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain grant $ADDRESS mine
    sleep 1
  fi
  
  # Try mining blocks using a different approach
  for i in $(seq 1 $count); do
    echo "Mining block $i on $chain..."
    
    # Method 1: Use publish to create a transaction (this will work if streams exist)
    echo "Attempting to mine with stream publish method..."
    STREAM_EXISTS=$(multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain liststreams | grep -c '"name" *: *"mining_helper"')
    
    if [ "$STREAM_EXISTS" -eq 0 ]; then
      echo "Creating mining_helper stream..."
      multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain create stream mining_helper true
      multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain subscribe mining_helper
      sleep 2
    fi
    
    # Publish to stream to create transaction
    RESULT=$(multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain publish mining_helper block_trigger "$(date +%s)" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
      echo "Published transaction to trigger block creation"
      sleep 2
      continue
    fi
    
    # Method 2: Alternative approach using admin permissions
    echo "Attempting alternative mining approach..."
    
    # Check if address has admin permission (needed to grant other permissions)
    HAS_ADMIN=$(multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain listpermissions admin $ADDRESS | grep -c "admin")
    
    if [ "$HAS_ADMIN" -eq 0 ]; then
      echo "⚠️ Address doesn't have admin permission, this may limit mining options"
    else
      # Create a new address and grant it receive permission
      NEW_ADDRESS=$(multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain getnewaddress)
      echo "Granting receive permission to $NEW_ADDRESS"
      multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain grant $NEW_ADDRESS receive
      sleep 1
      
      # Send a small amount to create a block
      multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain sendtoaddress $NEW_ADDRESS 0
      echo "Sent transaction to create a block"
      sleep 2
    fi
    
    # Method 3: Last resort - use setup runtime parameters
    echo "Setting mining parameters to force block creation..."
    multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain setupruntimeparams \
      '{"miningturnover":0.1,"mineemptyrounds":1,"miningrequirespeers":false}'
    sleep 3
  done
  
  # Get block count to verify
  BLOCKS=$(multichain-cli -datadir=$PROJECT_DIR/data/$chain $chain getblockcount)
  echo "Current block height on $chain: $BLOCKS"
}

echo "Force creating blocks on all chains..."
force_mine_blocks "main-chain" 2
force_mine_blocks "distributor-chain" 2
force_mine_blocks "retailer-chain" 2

echo "Creating necessary streams for application..."
curl -X POST http://localhost:3000/api/admin/setup-streams

echo "Checking block heights and streams..."
multichain-cli -datadir=$PROJECT_DIR/data/main-chain main-chain getblockcount
multichain-cli -datadir=$PROJECT_DIR/data/distributor-chain distributor-chain getblockcount
multichain-cli -datadir=$PROJECT_DIR/data/retailer-chain retailer-chain getblockcount

echo "Listing streams on distributor chain:"
multichain-cli -datadir=$PROJECT_DIR/data/distributor-chain distributor-chain liststreams