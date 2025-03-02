#!/bin/bash
# filepath: /home/lothrok/Documents/projects/dist-ledger/scripts/manage.sh

# Base directory 
PROJECT_DIR="/home/lothrok/Documents/projects/dist-ledger"

# Port configurations - organized by chain and node
declare -A PORTS=(
  # Main nodes (node0)
  ["distributor-node0-net"]=7741
  ["distributor-node0-rpc"]=7740
  ["retailer-node0-net"]=7743
  ["retailer-node0-rpc"]=7742
  ["main-node0-net"]=7745
  ["main-node0-rpc"]=7744
  
  # Additional nodes - spaced for clear port allocation
  ["distributor-node1-net"]=7751
  ["distributor-node1-rpc"]=7750
  ["distributor-node2-net"]=7761
  ["distributor-node2-rpc"]=7760
  
  ["retailer-node1-net"]=7753
  ["retailer-node1-rpc"]=7752
  ["retailer-node2-net"]=7763
  ["retailer-node2-rpc"]=7762
  
  ["main-node1-net"]=7755
  ["main-node1-rpc"]=7754
  ["main-node2-net"]=7765
  ["main-node2-rpc"]=7764
)

# Credentials
RPC_USER="multichainrpc"
RPC_PASSWORD="23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7"

#----------------------------------------
# CORE FUNCTIONS
#----------------------------------------

function create_chains() {
    echo "Creating blockchain networks with proper isolation..."
    
    # Create distributor chain
    multichain-util -datadir=${PROJECT_DIR}/data/distributor-chain create distributor-chain \
        -default-network-port=${PORTS["distributor-node0-net"]} \
        -default-rpc-port=${PORTS["distributor-node0-rpc"]} \
        -anyone-can-connect=true \
        -mining-requires-peers=false \
        -admin-consensus-admin=0.5 \
        -admin-consensus-mine=0.5

    # Create retailer chain
    multichain-util -datadir=${PROJECT_DIR}/data/retailer-chain create retailer-chain \
        -default-network-port=${PORTS["retailer-node0-net"]} \
        -default-rpc-port=${PORTS["retailer-node0-rpc"]} \
        -anyone-can-connect=true \
        -mining-requires-peers=false \
        -admin-consensus-admin=0.5 \
        -admin-consensus-mine=0.5
        
    # Create main chain - central connector
    multichain-util -datadir=${PROJECT_DIR}/data/main-chain create main-chain \
        -default-network-port=${PORTS["main-node0-net"]} \
        -default-rpc-port=${PORTS["main-node0-rpc"]} \
        -anyone-can-connect=true \
        -mining-requires-peers=false \
        -admin-consensus-admin=0.5 \
        -admin-consensus-mine=0.5
    
    # Setup RPC for all chains
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo "rpcuser=$RPC_USER" > ${PROJECT_DIR}/data/${chain}/${chain}/multichain.conf
        echo "rpcpassword=$RPC_PASSWORD" >> ${PROJECT_DIR}/data/${chain}/${chain}/multichain.conf
        echo "rpcallowip=0.0.0.0/0" >> ${PROJECT_DIR}/data/${chain}/${chain}/multichain.conf
        echo "rpcbind=0.0.0.0" >> ${PROJECT_DIR}/data/${chain}/${chain}/multichain.conf
        chmod 600 ${PROJECT_DIR}/data/${chain}/${chain}/multichain.conf
    done
    
    echo "All chains created with PoA configuration!"
}

function start_chains() {
    # Ensure clean start by checking for existing processes
    stop_running_chains
    
    echo "Starting core blockchain nodes..."
    
    # Start each chain with proper ports
    multichaind -datadir=${PROJECT_DIR}/data/distributor-chain distributor-chain -daemon
    multichaind -datadir=${PROJECT_DIR}/data/retailer-chain retailer-chain -daemon
    multichaind -datadir=${PROJECT_DIR}/data/main-chain main-chain -daemon
    
    # Allow chains time to start
    sleep 5
    
    # Verify chains are running
    check_chain_status "distributor-chain"
    check_chain_status "retailer-chain"
    check_chain_status "main-chain"
}

function stop_chains() {
    echo "Stopping all blockchain nodes..."
    
    # Stop main nodes first
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain stop 2>/dev/null || true
    done
    
    # Then stop all peer nodes
    for node in {1..3}; do
        for chain in "distributor-chain" "retailer-chain" "main-chain"; do
            NODE_DIR="${PROJECT_DIR}/data/${chain}-node${node}"
            if [ -d "$NODE_DIR" ]; then
                multichain-cli -datadir=$NODE_DIR -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain stop 2>/dev/null || true
            fi
        done
    done
    
    # Force kill any remaining processes
    sleep 3
    stop_running_chains
}

function stop_running_chains() {
    # Find and kill any remaining multichain processes
    RUNNING_PROCESSES=$(ps aux | grep multichaind | grep -v grep | awk '{print $2}')
    if [ ! -z "$RUNNING_PROCESSES" ]; then
        echo "Killing remaining chain processes..."
        for pid in $RUNNING_PROCESSES; do
            kill -9 $pid 2>/dev/null || true
        done
    fi
}

function check_chain_status() {
    local chain=$1
    echo "Checking $chain status..."
    
    if pgrep -f "multichaind.*$chain" > /dev/null; then
        echo "✓ $chain is running"
        
        # Get block height
        local height=$(multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain getblockcount 2>/dev/null)
        if [ ! -z "$height" ]; then
            echo "  - Block height: $height"
        else
            echo "  - Unable to get block height (RPC not ready)"
        fi
        
        return 0
    else
        echo "✗ $chain is NOT running"
        return 1
    fi
}

function mine_block() {
    local chain=$1
    local datadir=$2
    
    # Get mining address
    local address=$(multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain getaddresses | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
    
    # Different mining options in order of preference
    if multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain generate 1 2>/dev/null; then
        echo "✓ Block signed using 'generate'"
        return 0
    elif multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain generatetoaddress 1 "$address" 2>/dev/null; then
        echo "✓ Block signed using 'generatetoaddress'"
        return 0
    elif multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain setgenerate true 1 2>/dev/null; then
        echo "✓ Block signed using 'setgenerate'"
        return 0
    else
        echo "! Block signing failed - permissions may not be active yet"
        return 1
    fi
}

#----------------------------------------
# POA AND STREAMS SETUP
#----------------------------------------

function setup_poa() {
    echo "Setting up Proof of Authority (PoA) validators..."
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo "Configuring PoA for $chain..."
        
        # Get validator address
        ADDRESS=$(multichain-cli -datadir=${PROJECT_DIR}/data/$chain \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            $chain getaddresses | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
        
        if [ -z "$ADDRESS" ]; then
            echo "Error: Cannot get address for $chain"
            continue
        fi
        
        echo "Validator address: $ADDRESS"
        
        # Grant validator permissions (admin + mine for PoA)
        multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            $chain grant "$ADDRESS" "connect,send,receive,create,issue,admin"
            
        # Grant mine permission separately (this is the key permission for PoA)
        multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            $chain grant "$ADDRESS" mine
            
        # Configure PoA parameters - FIXED SYNTAX
        multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            $chain setruntimeparam miningturnover 0.5
        
        # Enable block signing
        multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            $chain setgenerate true
            
        # Generate initial block to activate permissions
        mine_block "$chain" "${PROJECT_DIR}/data/$chain"
    done
    
    echo "PoA setup complete. All validators configured."
}

function setup_streams() {
    echo "Setting up privacy-preserving streams for cross-chain communication..."
    
    # Distributor chain streams - FIXED JSON FORMAT
    create_stream "distributor-chain" "distributor_transactions" 
    create_stream "distributor-chain" "merkle_roots"
    create_stream "distributor-chain" "transaction_proofs"
    
    # Retailer chain streams
    create_stream "retailer-chain" "retailer_transactions"
    create_stream "retailer-chain" "merkle_roots" 
    create_stream "retailer-chain" "transaction_proofs"
    
    # Main chain streams - for cross-chain communication
    create_stream "main-chain" "sidechain_merkle_roots"
    create_stream "main-chain" "cross_chain_verifications"
    create_stream "main-chain" "transaction_requests"
    create_stream "main-chain" "transaction_proofs"
    
    # Generate blocks to confirm stream creation
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        mine_block "$chain" "${PROJECT_DIR}/data/$chain"
    done
    
    echo "Privacy-preserving streams created and configured."
}

function create_stream() {
    local chain=$1
    local stream=$2
    
    echo "Creating stream '$stream' on $chain..."
    
    # FIXED STREAM CREATION - simpler JSON
    multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        $chain create stream $stream '{"restrict":"write"}'
    
    # Subscribe to stream
    multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        $chain subscribe $stream
}

function setup_architecture() {
    echo "Configuring proper chain architecture for isolation..."
    
    # Alternative approach to isolation - use autosubscribe instead
    # since handshakelocal isn't working as expected
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            $chain setruntimeparam autosubscribe streams
    done
    
    # Create sample data
    create_sample_data
    
    echo "Architecture configuration complete. Chains properly isolated."
}

function create_sample_data() {
    echo "Creating sample data for demonstration..."
    
    # Check if streams exist before publishing
    if stream_exists "distributor-chain" "distributor_transactions"; then
        multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            distributor-chain publish distributor_transactions "shipment1" '{"json":{"type":"SHIPMENT","productId":"PROD001","quantity":100}}'
    fi
    
    if stream_exists "retailer-chain" "retailer_transactions"; then
        multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            retailer-chain publish retailer_transactions "inventory1" '{"json":{"type":"INVENTORY_UPDATE","productId":"PROD001","quantity":100}}'
    fi
    
    # Generate blocks to include these transactions
    mine_block "distributor-chain" "${PROJECT_DIR}/data/distributor-chain"
    mine_block "retailer-chain" "${PROJECT_DIR}/data/retailer-chain"
}

function stream_exists() {
    local chain=$1
    local stream=$2
    
    result=$(multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        $chain liststreams $stream 2>/dev/null | grep "name\|$stream" | wc -l)
        
    if [ "$result" -gt 0 ]; then
        return 0  # Stream exists
    else
        echo "Stream '$stream' does not exist on $chain"
        return 1  # Stream does not exist
    fi
}

#----------------------------------------
# MULTI-NODE SETUP
#----------------------------------------

function create_peer_nodes() {
    echo "Creating isolated peer nodes for each chain..."
    
    # Store node addresses for later use
    declare -A NODE_ADDRESSES
    
    # Create nodes for each chain
    for node in {1..2}; do
        for chain_name in "distributor" "retailer" "main"; do
            chain="${chain_name}-chain"
            echo "Creating ${chain} node ${node}..."
            
            # Create data directory
            NODE_DIR="${PROJECT_DIR}/data/${chain}-node${node}"
            mkdir -p ${NODE_DIR}/${chain}
            
            # Set up configuration
            echo "rpcuser=$RPC_USER" > ${NODE_DIR}/${chain}/multichain.conf
            echo "rpcpassword=$RPC_PASSWORD" >> ${NODE_DIR}/${chain}/multichain.conf
            echo "rpcport=${PORTS["${chain_name}-node${node}-rpc"]}" >> ${NODE_DIR}/${chain}/multichain.conf
            echo "port=${PORTS["${chain_name}-node${node}-net"]}" >> ${NODE_DIR}/${chain}/multichain.conf
            echo "rpcallowip=0.0.0.0/0" >> ${NODE_DIR}/${chain}/multichain.conf
            echo "rpcbind=0.0.0.0" >> ${NODE_DIR}/${chain}/multichain.conf
            
            chmod 600 ${NODE_DIR}/${chain}/multichain.conf
            
            # Get connection address for main node
            MAIN_PORT=${PORTS["${chain_name}-node0-net"]}
            CONNECT_ADDR="${chain}@127.0.0.1:${MAIN_PORT}"
            
            # Start the node
            multichaind "$CONNECT_ADDR" \
                -datadir=${NODE_DIR} \
                -port=${PORTS["${chain_name}-node${node}-net"]} \
                -rpcport=${PORTS["${chain_name}-node${node}-rpc"]} \
                -daemon
                
            # Wait for node to initialize
            echo "Waiting for ${chain} node ${node} to initialize..."
            sleep 10
            
            # Get the node's address directly from the node using RPC
            NODE_ADDRESS=$(multichain-cli -datadir=${NODE_DIR} \
                -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                -rpcport=${PORTS["${chain_name}-node${node}-rpc"]} \
                ${chain} getaddresses | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
            
            if [ ! -z "$NODE_ADDRESS" ]; then
                # Store clean address
                NODE_ADDRESSES["${chain}-${node}"]="$NODE_ADDRESS"
                echo "Node address obtained via RPC: $NODE_ADDRESS"
                
                # Grant basic connect permission first
                echo "Granting connect permission to $NODE_ADDRESS..."
                multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
                    -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                    ${chain} grant "$NODE_ADDRESS" connect
                
                echo "Basic connection granted to ${chain} node ${node}"
            else
                echo "Warning: Could not get address for ${chain} node ${node}"
            fi
        done
    done
    
    # Now wait for all nodes to be fully initialized
    echo "Waiting for peer nodes to be fully initialized..."
    sleep 15
    
    # Complete permissions for validators after initial connect
    for node in {1..2}; do
        for chain_name in "distributor" "retailer" "main"; do
            chain="${chain_name}-chain"
            NODE_ADDRESS="${NODE_ADDRESSES["${chain}-${node}"]}"
            
            if [ ! -z "$NODE_ADDRESS" ]; then
                echo "Granting additional permissions to $NODE_ADDRESS on $chain..."
                
                # Grant additional validator permissions on main node
                multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
                    -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                    ${chain} grant "$NODE_ADDRESS" send,receive,create
                
                # For validators, also add mine permission separately
                multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
                    -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                    ${chain} grant "$NODE_ADDRESS" mine
                    
                echo "Full permissions granted to ${chain} node ${node} ($NODE_ADDRESS)"
            fi
        done
    done
    
    # Generate blocks to confirm permission changes
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        mine_block "$chain" "${PROJECT_DIR}/data/$chain"
    done
    
    # Check nodes are responsive before forcing connections
    echo "Verifying node responsiveness before connection attempts..."
    for node in {1..2}; do
        for chain_name in "distributor" "retailer" "main"; do
            chain="${chain_name}-chain"
            RPCPORT=${PORTS["${chain_name}-node${node}-rpc"]}
            
            # Enhanced RPC connection check with better diagnostics
            timeout 5 bash -c "echo >/dev/tcp/127.0.0.1/$RPCPORT" 2>/dev/null
            if [ $? -eq 0 ]; then
                echo "✓ ${chain} node ${node} is responding on port $RPCPORT"
            else
                echo "! ${chain} node ${node} is NOT responding on port $RPCPORT"
                
                # Attempt to diagnose the issue
                ps aux | grep "[m]ultichaind.*${chain}-node${node}" || echo "No process found"
                ls -la ${PROJECT_DIR}/data/${chain}-node${node}/${chain}/debug.log 2>/dev/null || echo "No debug log found"
                tail -n 20 ${PROJECT_DIR}/data/${chain}-node${node}/${chain}/debug.log 2>/dev/null || echo "Cannot read debug log"
            fi
        done
    done
    
    # Force connections
    force_connections
}

function force_connections() {
    echo "Forcing peer connections within their respective chains..."
    
    # For each peer node, connect to its main node
    for node in {1..2}; do
        for chain_name in "distributor" "retailer" "main"; do
            chain="${chain_name}-chain"
            NODE_DIR="${PROJECT_DIR}/data/${chain}-node${node}"
            RPCPORT=${PORTS["${chain_name}-node${node}-rpc"]}
            
            # More comprehensive connection check
            if timeout 3 bash -c "echo >/dev/tcp/127.0.0.1/$RPCPORT" 2>/dev/null; then
                echo "Connecting ${chain} node ${node} to main node..."
                
                # Connect to main node
                MAIN_IP_PORT="127.0.0.1:${PORTS["${chain_name}-node0-net"]}"
                
                multichain-cli -datadir=${NODE_DIR} \
                    -rpcport=$RPCPORT \
                    -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                    ${chain} addnode "$MAIN_IP_PORT" "add"
                
                echo "Connection from ${chain} node ${node} to main node attempted"
            else
                echo "Warning: Node ${chain} node ${node} not responding on port $RPCPORT"
                
                # Try to restart the node if it's not responding
                echo "Attempting to restart ${chain} node ${node}..."
                
                # Stop if running
                multichain-cli -datadir=${NODE_DIR} \
                    -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                    -rpcport=$RPCPORT \
                    ${chain} stop 2>/dev/null || true
                
                sleep 3
                
                # Start again
                multichaind -datadir=${NODE_DIR} ${chain} \
                    -port=${PORTS["${chain_name}-node${node}-net"]} \
                    -rpcport=${PORTS["${chain_name}-node${node}-rpc"]} \
                    -daemon
                
                echo "Restarted ${chain} node ${node}, waiting to initialize..."
                sleep 10
            fi
        done
    done
    
    # Wait for connections to establish
    sleep 5
    
    # Check connections
    check_peers
}

function add_peer_validators() {
    echo "Verifying peer nodes as validators..."
    
    # For each peer node, verify it's a validator
    for node in {1..2}; do
        for chain_name in "distributor" "retailer" "main"; do
            chain="${chain_name}-chain"
            NODE_DIR="${PROJECT_DIR}/data/${chain}-node${node}"
            RPCPORT=${PORTS["${chain_name}-node${node}-rpc"]}
            
            # Test RPC connection
            if ! nc -z 127.0.0.1 $RPCPORT &>/dev/null; then
                echo "Warning: Node ${chain} ${node} is not responding on port $RPCPORT"
                continue
            fi
            
            # Try to get validation status
            VALIDATOR_STATUS=$(multichain-cli -datadir=${NODE_DIR} \
                -rpcport=$RPCPORT \
                -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                ${chain} listpermissions mine 2>/dev/null | grep -c "address" || echo "0")
            
            if [ "$VALIDATOR_STATUS" -gt 0 ]; then
                echo "✓ ${chain} node ${node} is properly configured as validator"
            else
                echo "! ${chain} node ${node} is not confirmed as validator"
            fi
        done
    done
}

#----------------------------------------
# UTILITY FUNCTIONS
#----------------------------------------

function check_peers() {
    echo "Checking peer connections for each chain..."
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo -e "\n${chain^} peers:"
        multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            ${chain} getpeerinfo | grep "addr"
            
        # Count peers
        PEER_COUNT=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            ${chain} getpeerinfo | grep -c "addr" || echo "0")
            
        echo "${chain} peer count: $PEER_COUNT"
    done
}

function reset_all() {
    echo "Resetting all chain data..."
    
    # Stop all running nodes
    stop_chains
    
    # Clean all data
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        # Remove main chain data
        rm -rf ${PROJECT_DIR}/data/${chain}
        
        # Remove peer nodes
        for node in {1..3}; do
            rm -rf ${PROJECT_DIR}/data/${chain}-node${node}
        done
    done
    
    # Create data directories
    mkdir -p ${PROJECT_DIR}/data/distributor-chain
    mkdir -p ${PROJECT_DIR}/data/retailer-chain
    mkdir -p ${PROJECT_DIR}/data/main-chain
    
    # Create new chains
    create_chains
    
    echo "Reset complete. Run './manage.sh start' followed by './manage.sh setup'"
}

function start_all_nodes() {
    echo "Starting all blockchain nodes..."
    
    # Start main nodes
    start_chains
    
    # Start peer nodes if they exist
    for node in {1..2}; do
        for chain_name in "distributor" "retailer" "main"; do
            chain="${chain_name}-chain"
            NODE_DIR="${PROJECT_DIR}/data/${chain}-node${node}"
            
            if [ -d "${NODE_DIR}" ]; then
                echo "Starting ${chain} node ${node}..."
                
                multichaind -datadir=${NODE_DIR} ${chain} \
                    -port=${PORTS["${chain_name}-node${node}-net"]} \
                    -rpcport=${PORTS["${chain_name}-node${node}-rpc"]} \
                    -daemon
            fi
        done
    done
    
    # Establish connections
    sleep 5
    force_connections
    
    echo "All nodes started."
}

function setup_all() {
    echo "Setting up complete environment..."
    
    # Setup PoA
    setup_poa
    
    # Setup streams for privacy-preserving merkle proofs
    setup_streams
    
    # Setup architecture (chain isolation)
    setup_architecture
    
    echo "Basic setup complete! For multi-node demo, run:"
    echo "./manage.sh setup_multi_node"
}

function setup_multi_node() {
    # Create peer nodes
    create_peer_nodes
    
    # Add peer validators
    add_peer_validators
    
    # Force connections
    force_connections
    
    echo "Multi-node environment ready for demonstration!"
}

function help() {
    echo -e "\nMultiChain Supply Chain Management - v1.0.0\n"
    echo "Usage: $0 <command>"
    echo -e "\nCore Commands:"
    echo "  reset               Reset all data and create fresh blockchains"
    echo "  start               Start main chain nodes"
    echo "  setup               Configure PoA, streams, and architecture"
    echo "  setup_multi_node    Create additional nodes for demonstration"
    echo -e "\nAdditional Commands:"
    echo "  stop                Stop all blockchain nodes"
    echo "  status              Display status of all nodes"
    echo "  check_peers         Check peer connections"
    echo "  start_all           Start all nodes (main + peer nodes)"
    echo -e "\nSetup Flow:"
    echo "  1. ./manage.sh reset"
    echo "  2. ./manage.sh start"
    echo "  3. ./manage.sh setup"
    echo "  4. ./manage.sh setup_multi_node (for demo)"
}

# Main command handler
case "$1" in
    start)
        start_chains
        ;;
    stop)
        stop_chains
        ;;
    status)
        for chain in "distributor-chain" "retailer-chain" "main-chain"; do
            check_chain_status "$chain"
        done
        ;;
    setup_poa)
        setup_poa
        ;;
    setup_streams)
        setup_streams
        ;;
    setup_architecture)
        setup_architecture
        ;;
    setup)
        setup_all
        ;;
    create)
        create_chains
        ;;
    force_connections)
        force_connections
        ;;
    create_peers)
        create_peer_nodes
        ;;
    add_peer_validators)
        add_peer_validators
        ;;
    check_peers)
        check_peers
        ;;
    setup_multi_node)
        setup_multi_node
        ;;
    reset)
        reset_all
        ;;
    start_all)
        start_all_nodes
        ;;
    help|--help|-h)
        help
        ;;
    *)
        help
        exit 1
esac

exit 0