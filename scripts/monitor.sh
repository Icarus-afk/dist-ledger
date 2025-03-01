#!/bin/bash

PROJECT_DIR="/home/lothrok/Documents/projects/dist-ledger"
RPC_USER="multichainrpc"
RPC_PASSWORD="23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7"

# Port configurations - copied from manage.sh
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

function print_header() {
    local title="$1"
    echo -e "\033[1;34m═════════════════════════════════════════════════════════════\033[0m"
    echo -e "\033[1;34m   $title\033[0m"
    echo -e "\033[1;34m═════════════════════════════════════════════════════════════\033[0m"
}

function print_section() {
    local title="$1"
    echo -e "\033[1;32m▶ $title\033[0m"
    echo -e "\033[1;32m────────────────────────────────────────────────────────────\033[0m"
}

function check_node_status() {
    print_section "Node Status"
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        # Check main node
        if pgrep -f "multichaind.*${chain}[^-]" > /dev/null; then
            echo -e "\033[1;32m✓\033[0m ${chain} (main): \033[1;32mRUNNING\033[0m"
        else
            echo -e "\033[1;31m✗\033[0m ${chain} (main): \033[1;31mSTOPPED\033[0m"
        fi
        
        # Check peer nodes
        for node in {1..3}; do
            if pgrep -f "multichaind.*${chain}-node${node}" > /dev/null; then
                echo -e "\033[1;32m✓\033[0m ${chain}-node${node}: \033[1;32mRUNNING\033[0m"
            else
                echo -e "\033[1;31m✗\033[0m ${chain}-node${node}: \033[1;31mSTOPPED\033[0m"
            fi
        done
    done
}

function check_block_heights() {
    print_section "Block Heights"
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        BLOCKS=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            ${chain} getblockcount 2>/dev/null || echo "ERROR")
        
        echo -e "${chain}: \033[1;33m${BLOCKS}\033[0m blocks"
        
        # Show peer nodes block heights
        for node in {1..3}; do
            if [ -d "${PROJECT_DIR}/data/${chain}-node${node}/${chain}" ]; then
                NODE_BLOCKS=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain}-node${node} \
                    -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                    -rpcport=${PORTS["${chain}-node${node}-rpc"]} \
                    ${chain} getblockcount 2>/dev/null || echo "ERROR")
                echo -e "  └─ ${chain}-node${node}: \033[1;36m${NODE_BLOCKS}\033[0m blocks"
            fi
        done
    done
}

function check_peer_connections() {
    print_section "Peer Connections"
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        PEERS=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            ${chain} getpeerinfo 2>/dev/null | grep -c "\"addr\"" || echo "0")
        
        echo -e "${chain}: \033[1;33m${PEERS}\033[0m connected peers"
        
        # Show actual peer connections
        if [ "$PEERS" -gt 0 ]; then
            multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
                -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                ${chain} getpeerinfo | grep -A 1 "\"addr\"" | head -10
        fi
    done
}

function check_recent_transactions() {
    print_section "Recent Transactions"
    
    for chain in "distributor-chain" "retailer-chain" "main-chain"; do
        echo -e "${chain}:"
        
        TX_COUNT=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            ${chain} getmempoolinfo 2>/dev/null | grep size | sed 's/.*: \([0-9]*\).*/\1/' || echo "0")
        
        echo -e "  ├─ Mempool: \033[1;33m${TX_COUNT}\033[0m pending transactions"
        
        # Show latest transactions
        LAST_BLOCK=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
            -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
            ${chain} getblockcount 2>/dev/null || echo "0")
        
        if [ "$LAST_BLOCK" != "0" ] && [ "$LAST_BLOCK" != "ERROR" ]; then
            BLOCK_HASH=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
                -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                ${chain} getblockhash ${LAST_BLOCK} 2>/dev/null || echo "")
                
            if [ -n "$BLOCK_HASH" ]; then
                TX_LIST=$(multichain-cli -datadir=${PROJECT_DIR}/data/${chain} \
                    -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
                    ${chain} getblock ${BLOCK_HASH} 2>/dev/null | grep -A 15 "\"tx\"" | grep "\"" | head -5)
                
                echo -e "  └─ Latest block transactions:"
                echo "$TX_LIST" | sed 's/^/      /'
            fi
        fi
    done
}

function check_stream_activity() {
    print_section "Stream Activity"
    
    # Check distributor chain streams
    echo -e "Distributor Chain Streams:"
    multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        distributor-chain liststreams | grep name | head -5 | sed 's/^/  /'
    
    # Sample the distributor_transactions stream if it exists
    echo -e "\n  Most recent distributor_transactions:"
    multichain-cli -datadir=${PROJECT_DIR}/data/distributor-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        distributor-chain liststreamitems distributor_transactions 2>/dev/null | grep -A 2 "\"key\"" | head -6 | sed 's/^/    /' || echo "    No items found"
    
    # Check main chain streams for relay activity
    echo -e "\nMain Chain Relay Streams:"
    multichain-cli -datadir=${PROJECT_DIR}/data/main-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        main-chain liststreams | grep name | grep -E 'merkle|cross|sidechain' | sed 's/^/  /'
    
    echo -e "\n  Most recent sidechain_merkle_roots entries:"
    multichain-cli -datadir=${PROJECT_DIR}/data/main-chain \
        -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD \
        main-chain liststreamitems sidechain_merkle_roots 2>/dev/null | grep -A 2 "\"key\"" | head -6 | sed 's/^/    /' || echo "    No items found"
}

function monitor_all() {
    clear
    print_header "MultiChain Network Monitor ($(date '+%Y-%m-%d %H:%M:%S'))"
    check_node_status
    echo
    check_block_heights
    echo
    check_peer_connections
    echo
    check_recent_transactions
    echo
    check_stream_activity
}

function show_usage() {
    echo "MultiChain Network Monitor"
    echo "Usage: $0 [option]"
    echo
    echo "Options:"
    echo "  status     - Show node status"
    echo "  blocks     - Show block heights"
    echo "  peers      - Show peer connections"
    echo "  txs        - Show recent transactions"
    echo "  streams    - Show stream activity"
    echo "  all        - Show all information (default)"
    echo "  live       - Live monitoring mode with refresh"
    echo "  help       - Show this help message"
}

# Process command line arguments
case "$1" in
    status)
        check_node_status
        ;;
    blocks)
        check_block_heights
        ;;
    peers)
        check_peer_connections
        ;;
    txs)
        check_recent_transactions
        ;;
    streams)
        check_stream_activity
        ;;
    all)
        monitor_all
        ;;
    live)
        while true; do
            monitor_all
            echo -e "\nRefreshing in 10 seconds... (Press Ctrl+C to exit)"
            sleep 10
        done
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        monitor_all
        ;;
esac

exit 0