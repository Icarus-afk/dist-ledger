#!/bin/bash

PROJECT_DIR="/home/lothrok/Documents/projects/dist-ledger"
RPC_USER="multichainrpc"
RPC_PASSWORD="23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7"

# Port configurations
declare -A PORTS=(
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

# Print colored section headers
function print_header() {
    echo -e "\033[1;36m===== $1 =====\033[0m"
}

# Execute command on a specific chain
function run_command() {
    local chain="$1"
    local node="$2"  # 0 for main node, 1-3 for peer nodes
    local command="$3"
    
    local datadir="${PROJECT_DIR}/data/${chain}"
    local rpcport=${PORTS["${chain}-node0-rpc"]}
    
    if [ "$node" -ne 0 ]; then
        datadir="${PROJECT_DIR}/data/${chain}-node${node}"
        rpcport=${PORTS["${chain}-node${node}-rpc"]}
    fi
    
    multichain-cli -datadir=$datadir \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        -rpcport=$rpcport \
        $chain $command
}

# Create a test address and return it
function create_test_address() {
    local chain="$1"
    local node="$2"
    
    local address=$(run_command "$chain" "$node" "getnewaddress" | tr -d '\r\n')
    echo "$address"
}

# Mine blocks on a specific chain
# Update this function to work with PoA
function mine_blocks() {
    local chain="$1"
    local node="$2"
    local count="$3"
    
    echo "In PoA networks, blocks are created automatically by authorized nodes"
    echo "Creating a transaction to trigger block creation..."
    
    # Get an address for transaction
    local from_address=$(run_command "$chain" "$node" "getaddresses" | grep -o '"[^"]*"' | head -1 | tr -d '"')
    local to_address=$(run_command "$chain" "$node" "getnewaddress" | tr -d '\r\n')
    
    # Create transaction to trigger block creation
    run_command "$chain" "$node" "send \"$from_address\" \"$to_address\" 0.01" > /dev/null 2>&1 || echo "Couldn't create transaction"
    
    # Wait for block to be created
    echo "Waiting for block to be generated..."
    sleep 5
}

# ===== TEST CASES =====

# Test 1: Basic blockchain operations on each chain
function test_basic_operations() {
    print_header "TEST 1: Basic Blockchain Operations"
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo -e "\n\033[1;33mTesting $chain basic operations...\033[0m"
        
        # Check block height
        echo "Block height:"
        run_command "$chain" 0 "getblockcount"
        
        # Create new address
        echo "Creating new address:"
        local address=$(create_test_address "$chain" 0)
        echo "Created address: $address"
        
        # Mine blocks
        echo "Mining blocks:"
        mine_blocks "$chain" 0 1
        
        # Get info
        echo "Chain info:"
        run_command "$chain" 0 "getinfo"
    done
}

# Test 2: Transaction creation and verification
function test_transactions() {
    print_header "TEST 2: Transaction Testing"
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo -e "\n\033[1;33mTesting $chain transactions...\033[0m"
        
        # Get first address for sending
        local from_address=$(run_command "$chain" 0 "getaddresses" | grep -o '"[^"]*"' | head -1 | tr -d '"')
        echo "From address: $from_address"
        
        # Create destination address
        local to_address=$(create_test_address "$chain" 0)
        echo "To address: $to_address"
        
        # Check balance
        echo "Balance before transaction:"
        run_command "$chain" 0 "getaddressbalances \"$from_address\""
        
        # Send transaction
        echo "Sending transaction:"
        local txid=$(run_command "$chain" 0 "send \"$from_address\" \"$to_address\" 1")
        echo "Transaction ID: $txid"
        
        # Mine block to confirm transaction
        mine_blocks "$chain" 0 1
        
        # Check transaction
        echo "Transaction details:"
        run_command "$chain" 0 "gettransaction $txid"
        
        # Check new balance
        echo "Balance after transaction:"
        run_command "$chain" 0 "getaddressbalances \"$from_address\""
        run_command "$chain" 0 "getaddressbalances \"$to_address\""
    done
}

# Test 3: Stream operations
function test_streams() {
    print_header "TEST 3: Stream Operations"
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo -e "\n\033[1;33mTesting $chain streams...\033[0m"
        
        # List streams
        echo "Available streams:"
        run_command "$chain" 0 "liststreams"
        
        # Determine stream name based on chain
        local stream_name=""
        if [ "$chain" == "distributor-chain" ]; then
            stream_name="distributor_transactions"
        elif [ "$chain" == "retailer-chain" ]; then
            stream_name="retailer_transactions"
        elif [ "$chain" == "main-chain" ]; then
            stream_name="sidechain_merkle_roots"
        fi
        
        # Only proceed if stream exists
        if run_command "$chain" 0 "liststreams" | grep -q "$stream_name"; then
            echo "Publishing to $stream_name stream:"
            local timestamp=$(date +%s)
            local json_data="{\"test_data\":\"Stream test at $timestamp\",\"value\":123}"
            
            # Create hex data
            local hex_data=$(echo -n "$json_data" | xxd -p | tr -d '\n')
            
            # Publish to stream
            local txid=$(run_command "$chain" 0 "publish $stream_name test_key $hex_data")
            echo "Published with txid: $txid"
            
            # Mine block to confirm
            mine_blocks "$chain" 0 1
            
            # Check stream items
            echo "Stream items:"
            run_command "$chain" 0 "liststreamitems $stream_name"
        else
            echo "Stream $stream_name not found on $chain"
        fi
    done
}

# Test 4: Node synchronization
function test_node_sync() {
    print_header "TEST 4: Node Synchronization"
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo -e "\n\033[1;33mTesting $chain node synchronization...\033[0m"
        
        # Get main node block height
        local main_height=$(run_command "$chain" 0 "getblockcount" | tr -d '\r\n')
        echo "Main node block height: $main_height"
        
        # Check peer nodes
        for node in {1..3}; do
            # Check if node exists
            if [ -d "${PROJECT_DIR}/data/${chain}-node${node}" ]; then
                echo "Checking ${chain}-node${node}..."
                
                # Get node block height
                local node_height=$(run_command "$chain" "$node" "getblockcount" 2>/dev/null || echo "Node not running")
                echo "Node $node block height: $node_height"
                
                # Mine a block on this node
                echo "Mining block on node $node..."
                run_command "$chain" "$node" "generate 1" || echo "Failed to mine on node $node"
                
                # Check updated heights
                local new_node_height=$(run_command "$chain" "$node" "getblockcount" 2>/dev/null || echo "Node not running")
                echo "Node $node new height: $new_node_height"
                
                # Wait for main node to sync
                echo "Waiting for main node to sync..."
                sleep 5
                
                local new_main_height=$(run_command "$chain" 0 "getblockcount" | tr -d '\r\n')
                echo "Main node new height: $new_main_height"
                
                # Compare
                if [ "$new_main_height" -ge "$new_node_height" ]; then
                    echo -e "\033[1;32mSynchronization successful!\033[0m"
                else
                    echo -e "\033[1;31mSynchronization failed!\033[0m"
                fi
            else
                echo "Node $node not found for $chain"
            fi
            
            # Only test the first available node to keep the test shorter
            break
        done
    done
}

# Test 5: Cross-chain operations
function test_cross_chain() {
    print_header "TEST 5: Cross-Chain Operations"
    
    echo -e "\033[1;33mTesting distributor-chain to main-chain relay...\033[0m"
    
    # Create transaction on distributor chain
    echo "Creating transaction on distributor-chain..."
    local from_address=$(run_command "distributor-chain" 0 "getaddresses" | grep -o '"[^"]*"' | head -1 | tr -d '"')
    local to_address=$(create_test_address "distributor-chain" 0)
    local txid=$(run_command "distributor-chain" 0 "send \"$from_address\" \"$to_address\" 0.1")
    echo "Transaction ID: $txid"
    
    # Mine block to confirm
    mine_blocks "distributor-chain" 0 1
    
    # Get block info
    echo "Getting block info:"
    local block_height=$(run_command "distributor-chain" 0 "getblockcount" | tr -d '\r\n')
    local block_hash=$(run_command "distributor-chain" 0 "getblockhash $block_height" | tr -d '\r\n')
    echo "Block height: $block_height, hash: $block_hash"
    
    # Get Merkle root for this block
    echo "Getting Merkle root:"
    local block_data=$(run_command "distributor-chain" 0 "getblock $block_hash")
    echo "$block_data" | grep merkleroot
    
    # Check if root was relayed to main chain
    echo "Checking main chain for relayed data..."
    run_command "main-chain" 0 "liststreamitems sidechain_merkle_roots" | grep -B 5 -A 5 "$block_hash" || echo "Merkle root not found in main chain yet. Relay might be pending."
    
    # Mine a block on main chain to help confirm relays
    mine_blocks "main-chain" 0 1
    
    # Check again
    echo "Checking main chain again..."
    run_command "main-chain" 0 "liststreamitems sidechain_merkle_roots" | grep -B 5 -A 5 "$block_hash" || echo "Merkle root not found in main chain. Cross-chain relay might not be working."
}

# Main function to run all tests
function run_all_tests() {
    print_header "STARTING COMPREHENSIVE BLOCKCHAIN TESTS"
    
    echo "Running tests at $(date)"
    echo "Project directory: $PROJECT_DIR"
    
    # Run each test
    test_basic_operations
    test_transactions
    test_streams
    test_node_sync
    test_cross_chain
    
    print_header "TESTS COMPLETED"
    echo "Tests finished at $(date)"
}

# Command line parsing
if [ -z "$1" ]; then
    # No arguments, show help
    echo "Blockchain Test Script"
    echo "Usage: $0 [test]"
    echo
    echo "Available tests:"
    echo "  basic       - Test basic blockchain operations"
    echo "  tx          - Test transaction creation and verification"
    echo "  streams     - Test stream operations"
    echo "  sync        - Test node synchronization"
    echo "  cross       - Test cross-chain operations"
    echo "  all         - Run all tests (default)"
    echo
    echo "Example: $0 tx"
    exit 0
fi

case "$1" in
    basic)
        test_basic_operations
        ;;
    tx)
        test_transactions
        ;;
    streams)
        test_streams
        ;;
    sync)
        test_node_sync
        ;;
    cross)
        test_cross_chain
        ;;
    all)
        run_all_tests
        ;;
    *)
        run_all_tests
        ;;
esac

exit 0