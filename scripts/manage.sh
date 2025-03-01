#!/bin/bash
# filepath: /home/lothrok/Documents/projects/dist-ledger/scripts/manage.sh

PROJECT_DIR="/home/lothrok/Documents/projects/dist-ledger"

# Port configurations for multiple nodes
declare -A PORTS=(
  # Original nodes
  ["distributor-chain-node0-net"]=7741
  ["distributor-chain-node0-rpc"]=7740
  ["retailer-chain-node0-net"]=7743
  ["retailer-chain-node0-rpc"]=7742
  ["main-chain-node0-net"]=7745
  ["main-chain-node0-rpc"]=7744
  
  # Additional peer nodes
  ["distributor-chain-node1-net"]=7751
  ["distributor-chain-node1-rpc"]=7750
  ["distributor-chain-node2-net"]=7761
  ["distributor-chain-node2-rpc"]=7760
  ["distributor-chain-node3-net"]=7771
  ["distributor-chain-node3-rpc"]=7770
  
  ["retailer-chain-node1-net"]=7753
  ["retailer-chain-node1-rpc"]=7752
  ["retailer-chain-node2-net"]=7763
  ["retailer-chain-node2-rpc"]=7762
  ["retailer-chain-node3-net"]=7773
  ["retailer-chain-node3-rpc"]=7772
  
  ["main-chain-node1-net"]=7755
  ["main-chain-node1-rpc"]=7754
  ["main-chain-node2-net"]=7765
  ["main-chain-node2-rpc"]=7764
  ["main-chain-node3-net"]=7775
  ["main-chain-node3-rpc"]=7774
)

# Default RPC credentials (UPDATE THESE!)
# Update this line near the top of your script
RPC_USER="multichainrpc"
RPC_PASSWORD="23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7"  # Use your actual password, not the placeholder

# Update the create_chains function to overwrite, not append
function create_chains() {
    echo "Creating blockchain parameter sets..."
    
    # Create distributor chain
    echo "Creating distributor chain..."
    multichain-util -datadir=${PROJECT_DIR}/data/distributor-chain create distributor-chain \
        -default-network-port=7741 \
        -default-rpc-port=7740 \
        -anyone-can-connect=true \
        -mining-requires-peers=false
    
    # Create retailer chain
    echo "Creating retailer chain..."
    multichain-util -datadir=${PROJECT_DIR}/data/retailer-chain create retailer-chain \
        -default-network-port=7743 \
        -default-rpc-port=7742 \
        -anyone-can-connect=true \
        -mining-requires-peers=false
    
    # Create main chain
    echo "Creating main chain..."
    multichain-util -datadir=${PROJECT_DIR}/data/main-chain create main-chain \
        -default-network-port=7745 \
        -default-rpc-port=7744 \
        -anyone-can-connect=true \
        -mining-requires-peers=false
    
    # Setup RPC credentials in config files - OVERWRITE not append
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo "Setting up RPC credentials for $chain..."
        echo "rpcuser=$RPC_USER" > ${PROJECT_DIR}/data/${chain}/${chain}/multichain.conf
        echo "rpcpassword=$RPC_PASSWORD" >> ${PROJECT_DIR}/data/${chain}/${chain}/multichain.conf
        # Ensure permissions are correct
        chmod 600 ${PROJECT_DIR}/data/${chain}/${chain}/multichain.conf
    done
    
    echo "All chains created successfully!"
}
function start_chains() {
    echo "Starting Distributor Chain node 0..."
    multichaind -datadir=${PROJECT_DIR}/data/distributor-chain distributor-chain -daemon
    
    echo "Starting Retailer Chain node 0..."
    multichaind -datadir=${PROJECT_DIR}/data/retailer-chain retailer-chain -daemon
    
    echo "Starting Main Chain node 0..."
    multichaind -datadir=${PROJECT_DIR}/data/main-chain main-chain -daemon
    
    # Allow chains time to start
    sleep 5
    
    # Check if chains are running
    if ! ps aux | grep multichaind | grep -v grep | grep -q "distributor-chain"; then
        echo "ERROR: Distributor chain failed to start."
        return 1
    fi
    
    if ! ps aux | grep multichaind | grep -v grep | grep -q "retailer-chain"; then
        echo "ERROR: Retailer chain failed to start."
        return 1
    fi
    
    if ! ps aux | grep multichaind | grep -v grep | grep -q "main-chain"; then
        echo "ERROR: Main chain failed to start."
        return 1
    fi
    
    echo "All chains started successfully."
}

function stop_chains() {
    echo "Stopping all chain nodes..."
    
    echo "Stopping original nodes..."
    multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD distributor-chain stop 2>/dev/null || true
    multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD retailer-chain stop 2>/dev/null || true
    multichain-cli -datadir=${PROJECT_DIR}/data/main-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD main-chain stop 2>/dev/null || true
    
    # Stop additional peers if they exist
    for node in {1..3}; do
        for chain in "distributor-chain" "retailer-chain" "main-chain"; do
            if [ -d "${PROJECT_DIR}/data/${chain}-node${node}" ]; then
                echo "Stopping ${chain} node ${node}..."
                multichain-cli -datadir=${PROJECT_DIR}/data/${chain}-node${node} -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD ${chain} stop 2>/dev/null || true
            fi
        done
    done
    
    # Wait for chains to stop
    sleep 3
    
    # Check if any multichaind processes are still running and force kill them if necessary
    RUNNING_PROCESSES=$(ps aux | grep multichaind | grep -v grep | awk '{print $2}')
    if [ ! -z "$RUNNING_PROCESSES" ]; then
        echo "Force killing remaining chain processes..."
        for pid in $RUNNING_PROCESSES; do
            kill -9 $pid 2>/dev/null || true
        done
    fi
    
    echo "All chains stopped."
}

function chain_status() {
    echo "Chain Status:"
    ps aux | grep multichaind | grep -v grep
    
    echo -e "\nNode status details:"
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo -e "\n${chain} status:"
        multichain-cli -datadir=${PROJECT_DIR}/data/${chain} -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD ${chain} getinfo 2>/dev/null || echo "${chain} is not running"
    done
}

# Replace the current mine_block function with this updated version
function mine_block() {
    local chain=$1
    local datadir=$2
    
    # Get the address for mining
    local ADDRESS=$(multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain getaddresses | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
    
    if [ -z "$ADDRESS" ]; then
        echo "ERROR: Could not get address for $chain"
        return 1
    fi
    
    echo "Mining block in $chain using address $ADDRESS..."
    
    # Try different mining methods in order of preference
    if multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain generate 1 2>/dev/null; then
        echo "Successfully mined block using 'generate'"
        return 0
    elif multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain generatetoaddress 1 "$ADDRESS" 2>/dev/null; then
        echo "Successfully mined block using 'generatetoaddress'"
        return 0
    elif multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain setgenerate true 1 2>/dev/null; then
        echo "Successfully mined block using 'setgenerate'"
        return 0
    else
        echo "WARNING: Could not mine block using any method. Mining may require special permissions."
        # Continue anyway - the grant might still work without an immediate block
        return 1
    fi
}
function setup_poa() {
    echo "Setting up Proof of Authority (PoA)..."
    
    # Get node addresses
    echo "Getting node addresses..."
    DISTRIBUTOR_ADDRESS=$(multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD distributor-chain getaddresses | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
    RETAILER_ADDRESS=$(multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD retailer-chain getaddresses | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
    MAIN_ADDRESS=$(multichain-cli -datadir=${PROJECT_DIR}/data/main-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD main-chain getaddresses | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
    
    echo "Distributor address: $DISTRIBUTOR_ADDRESS"
    echo "Retailer address: $RETAILER_ADDRESS"
    echo "Main chain address: $MAIN_ADDRESS"
    
    if [ -z "$DISTRIBUTOR_ADDRESS" ] || [ -z "$RETAILER_ADDRESS" ] || [ -z "$MAIN_ADDRESS" ]; then
        echo "Error: Could not retrieve addresses. Make sure chains are running."
        return 1
    fi
    
    # Grant mine permissions (for block creation) and admin permissions
    echo "Granting validator permissions (PoA setup)..."
    multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD distributor-chain grant "$DISTRIBUTOR_ADDRESS" "mine,admin"
    multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD retailer-chain grant "$RETAILER_ADDRESS" "mine,admin"
    multichain-cli -datadir=${PROJECT_DIR}/data/main-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD main-chain grant "$MAIN_ADDRESS" "mine,admin"
    
    # Generate initial blocks to make permissions active
    echo "Generating initial blocks to activate permissions..."
    mine_block "distributor-chain" "${PROJECT_DIR}/data/distributor-chain"
    mine_block "retailer-chain" "${PROJECT_DIR}/data/retailer-chain"
    mine_block "main-chain" "${PROJECT_DIR}/data/main-chain"
    
    echo "PoA setup complete!"
}

function verify_nodes() {
    echo "Verifying node connections..."
    
    for node in {1..3}; do
        for chain in "distributor-chain" "retailer-chain" "main-chain"; do
            NODE_DIR="${PROJECT_DIR}/data/${chain}-node${node}"
            
            if [ -d "${NODE_DIR}/${chain}" ]; then
                echo "Testing ${chain} node ${node}..."
                
                # Try to get info from the node
                if multichain-cli -datadir=${NODE_DIR} -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD ${chain} getinfo >/dev/null 2>&1; then
                    echo "${chain} node ${node} is running and responding"
                    
                    # Check if the node was granted permissions
                    PERMISSIONS=$(multichain-cli -datadir=${NODE_DIR} -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD ${chain} listpermissions connect | grep "connect")
                    if [ -z "$PERMISSIONS" ]; then
                        echo "WARNING: ${chain} node ${node} does not have connect permissions"
                    else
                        echo "${chain} node ${node} has connect permissions"
                    fi
                else
                    echo "ERROR: ${chain} node ${node} is not responding to RPC commands"
                fi
            fi
        done
    done
}

function setup_streams() {
    echo "Setting up streams for transactions and Merkle roots..."
    
    # Create streams on distributor chain
    echo "Creating streams on distributor chain..."
    multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD distributor-chain create stream distributor_transactions '{"restrict":"write"}'
    multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD distributor-chain create stream merkle_roots '{"restrict":"write"}'
    
    # Create streams on retailer chain
    echo "Creating streams on retailer chain..."
    multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD retailer-chain create stream retailer_transactions '{"restrict":"write"}'
    multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD retailer-chain create stream merkle_roots '{"restrict":"write"}'
    
    # Create streams on main chain
    echo "Creating streams on main chain..."
    multichain-cli -datadir=${PROJECT_DIR}/data/main-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD main-chain create stream sidechain_merkle_roots '{"restrict":"write"}'
    multichain-cli -datadir=${PROJECT_DIR}/data/main-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD main-chain create stream cross_chain_verifications '{"restrict":"write"}'
    
    # Subscribe to the streams
    echo "Subscribing to streams..."
    multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD distributor-chain subscribe distributor_transactions
    multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD distributor-chain subscribe merkle_roots
    
    multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD retailer-chain subscribe retailer_transactions
    multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD retailer-chain subscribe merkle_roots
    
    multichain-cli -datadir=${PROJECT_DIR}/data/main-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD main-chain subscribe sidechain_merkle_roots
    multichain-cli -datadir=${PROJECT_DIR}/data/main-chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD main-chain subscribe cross_chain_verifications
    
    # Generate blocks to confirm stream creation
    echo "Generating blocks to confirm stream creation..."
    mine_block "distributor-chain" "${PROJECT_DIR}/data/distributor-chain"
    mine_block "retailer-chain" "${PROJECT_DIR}/data/retailer-chain"
    mine_block "main-chain" "${PROJECT_DIR}/data/main-chain"
    
    echo "Streams setup complete!"
}

function add_validator() {
    if [ "$#" -ne 2 ]; then
        echo "Usage: $0 add_validator <chain-name> <address>"
        return 1
    fi
    
    local chain=$1
    local address=$2
    
    echo "Adding validator to $chain..."
    multichain-cli -datadir=${PROJECT_DIR}/data/$chain -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain grant "$address" "mine,admin"
    echo "Validator added to $chain: $address"
}

function create_peer_nodes() {
    echo "Creating additional peer nodes for each chain..."
    
    # Make sure original nodes are running with blocks
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        if ! ps aux | grep multichaind | grep -v grep | grep -q "$chain"; then
            echo "ERROR: Original $chain node is not running. Start it first with ./manage.sh start"
            return 1
        fi
        
        # Check block height
        BLOCKS=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain} -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD ${chain} getblockcount)
        echo "${chain} blocks: $BLOCKS"
    done
    
    # Get connection details for original nodes
    echo "Getting connection details for original nodes..."
    
    # Define proper connection addresses
    DIST_ADDR="distributor-chain@192.168.0.102:7741"
    RETAIL_ADDR="retailer-chain@192.168.0.102:7743" 
    MAIN_ADDR="main-chain@192.168.0.102:7745"
    
    echo "Original distributor node: $DIST_ADDR"
    echo "Original retailer node: $RETAIL_ADDR"
    echo "Original main node: $MAIN_ADDR"
    
    # Pre-grant connect permissions to ANY address (this makes connecting easier)
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo "Enabling anyone-can-connect on $chain..."
        multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            $chain setruntimeparam anyone-can-connect=true
    done
    
    # Create each node one by one and verify it's working before proceeding
    for node in {1..3}; do
        # DISTRIBUTOR CHAIN NODES
        echo "Creating distributor-chain node $node..."
        mkdir -p ${PROJECT_DIR}/data/distributor-chain-node${node}
        
        # Write config first to ensure proper RPC settings
        mkdir -p ${PROJECT_DIR}/data/distributor-chain-node${node}/distributor-chain
        echo "rpcuser=$RPC_USER" > ${PROJECT_DIR}/data/distributor-chain-node${node}/distributor-chain/multichain.conf
        echo "rpcpassword=$RPC_PASSWORD" >> ${PROJECT_DIR}/data/distributor-chain-node${node}/distributor-chain/multichain.conf
        echo "rpcport=${PORTS["distributor-chain-node${node}-rpc"]}" >> ${PROJECT_DIR}/data/distributor-chain-node${node}/distributor-chain/multichain.conf
        echo "rpcallowip=0.0.0.0/0" >> ${PROJECT_DIR}/data/distributor-chain-node${node}/distributor-chain/multichain.conf
        echo "rpcbind=0.0.0.0" >> ${PROJECT_DIR}/data/distributor-chain-node${node}/distributor-chain/multichain.conf
        chmod 600 ${PROJECT_DIR}/data/distributor-chain-node${node}/distributor-chain/multichain.conf
        
        # Connect with explicit parameters
        multichaind $DIST_ADDR \
            -datadir=${PROJECT_DIR}/data/distributor-chain-node${node} \
            -port=${PORTS["distributor-chain-node${node}-net"]} \
            -rpcport=${PORTS["distributor-chain-node${node}-rpc"]} \
            -rpcuser=$RPC_USER \
            -rpcpassword=$RPC_PASSWORD \
            -daemon
        
        sleep 5 # Give it time to start
        
        # RETAILER CHAIN NODES
        echo "Creating retailer-chain node $node..."
        mkdir -p ${PROJECT_DIR}/data/retailer-chain-node${node}
        
        # Write config first
        mkdir -p ${PROJECT_DIR}/data/retailer-chain-node${node}/retailer-chain
        echo "rpcuser=$RPC_USER" > ${PROJECT_DIR}/data/retailer-chain-node${node}/retailer-chain/multichain.conf
        echo "rpcpassword=$RPC_PASSWORD" >> ${PROJECT_DIR}/data/retailer-chain-node${node}/retailer-chain/multichain.conf
        echo "rpcport=${PORTS["retailer-chain-node${node}-rpc"]}" >> ${PROJECT_DIR}/data/retailer-chain-node${node}/retailer-chain/multichain.conf
        echo "rpcallowip=0.0.0.0/0" >> ${PROJECT_DIR}/data/retailer-chain-node${node}/retailer-chain/multichain.conf
        echo "rpcbind=0.0.0.0" >> ${PROJECT_DIR}/data/retailer-chain-node${node}/retailer-chain/multichain.conf
        chmod 600 ${PROJECT_DIR}/data/retailer-chain-node${node}/retailer-chain/multichain.conf
        
        # Connect with explicit parameters
        multichaind $RETAIL_ADDR \
            -datadir=${PROJECT_DIR}/data/retailer-chain-node${node} \
            -port=${PORTS["retailer-chain-node${node}-net"]} \
            -rpcport=${PORTS["retailer-chain-node${node}-rpc"]} \
            -rpcuser=$RPC_USER \
            -rpcpassword=$RPC_PASSWORD \
            -daemon
            
        sleep 5 # Give it time to start
        
        # MAIN CHAIN NODES
        echo "Creating main-chain node $node..."
        mkdir -p ${PROJECT_DIR}/data/main-chain-node${node}
        
        # Write config first
        mkdir -p ${PROJECT_DIR}/data/main-chain-node${node}/main-chain
        echo "rpcuser=$RPC_USER" > ${PROJECT_DIR}/data/main-chain-node${node}/main-chain/multichain.conf
        echo "rpcpassword=$RPC_PASSWORD" >> ${PROJECT_DIR}/data/main-chain-node${node}/main-chain/multichain.conf
        echo "rpcport=${PORTS["main-chain-node${node}-rpc"]}" >> ${PROJECT_DIR}/data/main-chain-node${node}/main-chain/multichain.conf
        echo "rpcallowip=0.0.0.0/0" >> ${PROJECT_DIR}/data/main-chain-node${node}/main-chain/multichain.conf
        echo "rpcbind=0.0.0.0" >> ${PROJECT_DIR}/data/main-chain-node${node}/main-chain/multichain.conf
        chmod 600 ${PROJECT_DIR}/data/main-chain-node${node}/main-chain/multichain.conf
        
        # Connect with explicit parameters
        multichaind $MAIN_ADDR \
            -datadir=${PROJECT_DIR}/data/main-chain-node${node} \
            -port=${PORTS["main-chain-node${node}-net"]} \
            -rpcport=${PORTS["main-chain-node${node}-rpc"]} \
            -rpcuser=$RPC_USER \
            -rpcpassword=$RPC_PASSWORD \
            -daemon
            
        sleep 5 # Give it time to start
    done
    
    # Check which nodes actually started
    echo "Checking status of started nodes:"
    for node in {1..3}; do
        for chain in "distributor-chain" "retailer-chain" "main-chain"; do
            if pgrep -f "multichaind.*${chain}-node${node}" > /dev/null; then
                echo "${chain} node ${node}: RUNNING"
            else
                echo "${chain} node ${node}: NOT RUNNING"
                # Try to see why it's not running
                if [ -f "${PROJECT_DIR}/data/${chain}-node${node}/${chain}/debug.log" ]; then
                    echo "Last 5 lines of debug log:"
                    tail -5 "${PROJECT_DIR}/data/${chain}-node${node}/${chain}/debug.log"
                fi
            fi
        done
    done
}

function force_connections() {
    echo "Forcing peer connections..."
    
    # First ensure all nodes are running
    for node in {1..3}; do
        for chain in "distributor-chain" "retailer-chain" "main-chain"; do
            if ! pgrep -f "multichaind.*${chain}-node${node}" > /dev/null; then
                echo "Restarting ${chain} node ${node}..."
                multichaind -datadir=${PROJECT_DIR}/data/${chain}-node${node} ${chain} -daemon
                sleep 3
            fi
        done
    done

    # Get proper IP:port format for connections
    DIST_IP_PORT="192.168.0.102:7741"
    RETAIL_IP_PORT="192.168.0.102:7743"
    MAIN_IP_PORT="192.168.0.102:7745"
    
    echo "Distributor connect address: $DIST_IP_PORT"
    echo "Retailer connect address: $RETAIL_IP_PORT"
    echo "Main chain connect address: $MAIN_IP_PORT"
    
    # For each peer node, explicitly connect to the main node
    for node in {1..3}; do
        echo "Forcing connections for node $node..."
        
        # Connect distributor peer to main distributor - use "onetry" for immediate connection attempt
        if [ -d "${PROJECT_DIR}/data/distributor-chain-node${node}/distributor-chain" ]; then
            echo "Connecting distributor-chain node $node to main distributor node..."
            multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain-node${node} \
                -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                -rpcport=${PORTS["distributor-chain-node${node}-rpc"]} \
                distributor-chain addnode "$DIST_IP_PORT" "onetry"
        fi
        
        # Connect retailer peer to main retailer
        if [ -d "${PROJECT_DIR}/data/retailer-chain-node${node}/retailer-chain" ]; then
            echo "Connecting retailer-chain node $node to main retailer node..."
            multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain-node${node} \
                -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                -rpcport=${PORTS["retailer-chain-node${node}-rpc"]} \
                retailer-chain addnode "$RETAIL_IP_PORT" "onetry"
        fi
        
        # Connect main chain peer to main chain main
        if [ -d "${PROJECT_DIR}/data/main-chain-node${node}/main-chain" ]; then
            echo "Connecting main-chain node $node to main chain node..."
            multichain-cli -datadir=${PROJECT_DIR}/data/main-chain-node${node} \
                -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                -rpcport=${PORTS["main-chain-node${node}-rpc"]} \
                main-chain addnode "$MAIN_IP_PORT" "onetry"
        fi
    done
    
    echo "Connection attempts completed. Waiting for connections to establish..."
    sleep 10  # Give more time for connections to establish
}

function add_peer_validators() {
    echo "Adding peer nodes as validators..."
    
    for node in {1..3}; do
        for chain in "distributor-chain" "retailer-chain" "main-chain"; do
            echo "Getting address for ${chain} node ${node}..."
            
            # Specify datadir and port correctly
            ADDRESS=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain}-node${node} \
                     -rpcport=${PORTS["${chain}-node${node}-rpc"]} \
                     -rpcuser=$RPC_USER \
                     -rpcpassword=$RPC_PASSWORD \
                     ${chain} getaddresses 2>/dev/null | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
            
            if [ -z "$ADDRESS" ]; then
                echo "WARNING: Could not get address for ${chain} node ${node}"
                # Check if node is running
                if ! pgrep -f "${chain}-node${node}" > /dev/null; then
                    echo "Node appears to be down. Attempting restart..."
                    multichaind -datadir=${PROJECT_DIR}/data/${chain}-node${node} ${chain} -daemon
                    sleep 3
                    # Try again
                    ADDRESS=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain}-node${node} \
                             -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                             ${chain} getaddresses 2>/dev/null | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
                    if [ -z "$ADDRESS" ]; then
                        echo "Still could not get address after restart. Skipping."
                        continue
                    fi
                else
                    continue
                fi
            fi
            
            echo "${chain} node ${node} address: $ADDRESS"
            
            # Grant permissions on the original node
            echo "Granting permissions to ${chain} node ${node}..."
            multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
                          -rpcuser=$RPC_USER \
                          -rpcpassword=$RPC_PASSWORD \
                          ${chain} grant "$ADDRESS" "connect,send,receive,mine,admin"
        done
    done
    
    # Generate blocks to confirm permission changes
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo "Generating block for ${chain} to confirm permissions..."
        mine_block "$chain" "${PROJECT_DIR}/data/${chain}"
    done
    
    echo "All peer validators added!"
}

function auto_grant_permissions() {
    echo "Auto-granting permissions to all peer nodes..."
    
    # Wait for nodes to initialize completely
    sleep 5
    
    for node in {1..3}; do
        for chain in "distributor-chain" "retailer-chain" "main-chain"; do
            # Extract the address from the wallet.dat of each node
            echo "Getting address for ${chain} node ${node}..."
            NODE_DIR="${PROJECT_DIR}/data/${chain}-node${node}"
            
            # First check if node is running
            if ! pgrep -f "multichaind.*${chain}-node${node}" > /dev/null; then
                echo "Starting ${chain} node ${node}..."
                multichaind -datadir=${NODE_DIR} ${chain} -daemon
                sleep 3
            fi
            
            # Get the node's address
            ADDRESS=$(multichain-cli -datadir=${NODE_DIR} -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD ${chain} getaddresses | grep -o '"[^"]*"' | head -1 | sed 's/"//g')
            
            if [ -z "$ADDRESS" ]; then
                echo "WARNING: Could not get address for ${chain} node ${node}"
                continue
            fi
            
            echo "${chain} node ${node} address: $ADDRESS"
            
            # Grant permissions on the main node
            echo "Granting permissions to ${chain} node ${node}..."
            multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
                -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                ${chain} grant "$ADDRESS" "connect,send,receive,mine,admin"
                
            # Mine a block to confirm permissions
            echo "Mining block to confirm permissions for ${chain}..."
            mine_block "${chain}" "${PROJECT_DIR}/data/${chain}"
            sleep 2
        done
    done
    
    echo "All permissions granted. Waiting for permissions to take effect..."
    sleep 5
}

function check_peers() {
    echo "Checking peers for each chain..."
    
    echo "Distributor Chain Peers:"
    multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        distributor-chain getpeerinfo | grep -A 2 "\"addr\""
    
    echo "Retailer Chain Peers:"
    multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        retailer-chain getpeerinfo | grep -A 2 "\"addr\""
    
    echo "Main Chain Peers:"
    multichain-cli -datadir=${PROJECT_DIR}/data/main-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        main-chain getpeerinfo | grep -A 2 "\"addr\""
    
    echo -e "\nPeer count for each chain:"
    DIST_COUNT=$(multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        distributor-chain getpeerinfo | grep -c "\"addr\"")
    
    RETAIL_COUNT=$(multichain-cli -datadir=${PROJECT_DIR}/data/retailer-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        retailer-chain getpeerinfo | grep -c "\"addr\"")
    
    MAIN_COUNT=$(multichain-cli -datadir=${PROJECT_DIR}/data/main-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        main-chain getpeerinfo | grep -c "\"addr\"")
    
    echo "Distributor: $DIST_COUNT"
    echo "Retailer: $RETAIL_COUNT"
    echo "Main: $MAIN_COUNT"
}

function reset_all() {
    echo "Stopping all chain nodes..."
    stop_chains
    
    echo "Removing all chain data..."
    
    # Delete original chain data
    rm -rf ${PROJECT_DIR}/data/distributor-chain
    rm -rf ${PROJECT_DIR}/data/retailer-chain
    rm -rf ${PROJECT_DIR}/data/main-chain
    
    # Delete peer nodes data
    for node in {1..3}; do
        for chain in "distributor-chain" "retailer-chain" "main-chain"; do
            rm -rf ${PROJECT_DIR}/data/${chain}-node${node}
        done
    done
    
    echo "Re-creating basic chain directories..."
    mkdir -p ${PROJECT_DIR}/data/distributor-chain
    mkdir -p ${PROJECT_DIR}/data/retailer-chain
    mkdir -p ${PROJECT_DIR}/data/main-chain
    
    # Create new chains
    create_chains
    
    echo "All data has been reset and chains created. Now you can:"
    echo "1. Run './manage.sh start' to start fresh chains"
    echo "2. Run './manage.sh setup' to configure PoA and streams"
    echo "3. Run './manage.sh setup_multi_node' to create peer nodes"
}

function setup_all() {
    setup_poa
    setup_streams
}

function setup_multi_node() {
    # First, make sure chains are running with blocks
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        # Check if chain is running
        if ! ps aux | grep multichaind | grep -v grep | grep -q "$chain"; then
            echo "ERROR: $chain is not running. Start chains with ./manage.sh start first."
            return 1
        fi
        
        # Check block height
        BLOCKS=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain} -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD ${chain} getblockcount)
        echo "${chain} blocks: $BLOCKS"
        if [ "$BLOCKS" -lt 1 ]; then
            echo "Mining first block for ${chain}..."
            mine_block "$chain" "${PROJECT_DIR}/data/${chain}"
        fi
    done
    
    # Pre-grant permissions to make connecting easier
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo "Setting ${chain} to allow anyone to connect temporarily..."
        multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            ${chain} setruntimeparam anyone-can-connect=true
    done
    
    echo "Creating peer nodes..."
    create_peer_nodes
    
    echo "Granting permissions to peer nodes..."
    auto_grant_permissions
    
    echo "Forcing connections between nodes..."
    force_connections
    
    # Turn off anyone-can-connect now that we have permissions
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo "Restoring ${chain} connection security..."
        multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            ${chain} setruntimeparam anyone-can-connect=false
    done
    
    echo "Checking peer connections..."
    check_peers
}

function help() {
    echo "MultiChain Management Script"
    echo "============================="
    echo "Usage: $0 <command>"
    echo ""
    echo "Available commands:"
    echo "  start               Start main chain nodes"
    echo "  stop                Stop all running chain nodes"
    echo "  status              Display status of all nodes"
    echo "  restart             Restart main chain nodes"
    echo "  setup_poa           Configure Proof of Authority"
    echo "  setup_streams       Create and configure streams"
    echo "  setup               Run both setup_poa and setup_streams"
    echo "  create              Create blockchain parameters only"
    echo "  add_validator       Add a new validator address (params: <chain-name> <address>)"
    echo "  create_peers        Create additional peer nodes"
    echo "  force_connections   Force connections between nodes"
    echo "  add_peer_validators Add peer nodes as validators"
    echo "  check_peers         Check peer connections"
    echo "  setup_multi_node    Complete setup of multi-node environment"
    echo "  auto_permissions    Auto-grant permissions to all peer nodes"
    echo "  reset               Reset all data and create fresh blockchains"
    echo "  help                Show this help message"
    echo ""
    echo "Setup process flow:"
    echo "  1. ./manage.sh reset"
    echo "  2. ./manage.sh start"
    echo "  3. ./manage.sh setup"
    echo "  4. ./manage.sh setup_multi_node (optional for multi-node)"
}

case "$1" in
    start)
        start_chains
        ;;
    stop)
        stop_chains
        ;;
    status)
        chain_status
        ;;
    restart)
        stop_chains
        sleep 2
        start_chains
        ;;
    setup_poa)
        setup_poa
        ;;
    setup_streams)
        setup_streams
        ;;
    setup)
        setup_all
        ;;
    create)
        create_chains
        ;;
    add_validator)
        add_validator "$2" "$3"
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
    auto_grant_permissions)
        auto_grant_permissions
        ;;
    setup_multi_node)
        setup_multi_node
        ;;
    reset)
        reset_all
        ;;
    help)
        help
        ;;
    *)
        help
        exit 1
esac

exit 0