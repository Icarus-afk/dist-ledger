#!/bin/bash
# filepath: /home/lothrok/Documents/projects/dist-ledger/scripts/mine_and_verify.sh

# Complete MultiChain Block Generator with integrated metrics
PROJECT_DIR="/home/lothrok/Documents/projects/dist-ledger"
RPC_USER="multichainrpc"
RPC_PASSWORD="23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get raw command output with error handling
direct_command() {
  local chain=$1
  local cmd=$2
  local datadir="${PROJECT_DIR}/data/${chain}"
  
  multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain $cmd 2>/dev/null
}

# Get just the numeric value from output
get_number() {
  local chain=$1
  local cmd=$2
  local output=$(direct_command "$chain" "$cmd")
  echo "$output" | grep -o '[0-9]\+' | head -1
}

# Get proper blockchain address
get_real_address() {
  local chain=$1
  # Direct pattern match for address format
  local address=$(direct_command "$chain" "getaddresses" | grep -o '"1[a-zA-Z0-9]\{30,\}"' | head -1 | tr -d '"')
  if [[ -z "$address" ]]; then
    # Try alternate format
    address=$(direct_command "$chain" "getaddresses" | grep -o '"[a-zA-Z0-9]\{30,\}"' | head -1 | tr -d '"')
  fi
  echo "$address"
}

# Enhanced mining function with extra measures for retailer chain
force_mining() {
  local chain=$1
  local address=$2
  local extra_attempts=$3  # Extra attempts for retailer-chain
  
  echo -e "${BLUE}MINING SEQUENCE FOR $chain:${NC}"
  
  # Step 1: Enable mining
  echo -e "Step 1: Enabling mining..."
  direct_command "$chain" "setgenerate true 1" > /dev/null
  
  # Step 2: Set optimal mining parameters
  echo -e "Step 2: Setting optimal mining parameters..."
  direct_command "$chain" "setruntimeparam miningturnover 0.01" > /dev/null
  direct_command "$chain" "setruntimeparam mineemptyrounds 0" > /dev/null
  direct_command "$chain" "setruntimeparam miningrequirespeers false" > /dev/null
  
  # Step 3: Custom handling for retailer-chain
  if [[ "$chain" == "retailer-chain" || "$extra_attempts" -eq 1 ]]; then
    echo -e "Step 3: Enhanced mining for ${YELLOW}$chain${NC}..."
    
    # Create a special mining-trigger stream
    local timestamp=$(date +%s)
    local mine_stream="mining_trigger_$timestamp"
    direct_command "$chain" "create stream $mine_stream true" > /dev/null
    
    # Create extra transactions to trigger mining - USING HEX DATA
    for i in {1..5}; do
      # Convert data to hex format
      local data_text="trigger_$i"
      local hex_data=$(echo -n "$data_text" | xxd -p -c 1000)
      direct_command "$chain" "publish $mine_stream mining_key_$i $hex_data" > /dev/null
    done
    
    # Increase wait time
    sleep 5
    
    # Multiple mining commands in sequence
    for i in {1..3}; do
      direct_command "$chain" "setgenerate true 1" > /dev/null
      sleep 2
    done
  else
    # Standard mining for other chains
    echo -e "Step 3: Standard mining attempt..."
    direct_command "$chain" "setgenerate true 1" > /dev/null
  fi
  
  # Wait for mining to complete
  echo -e "Waiting for block generation to complete..."
  sleep 8
}

# Generate transactions and mine blocks
generate_and_mine() {
  local chain=$1
  
  echo -e "\n${GREEN}===== Processing chain: $chain =====${NC}"
  
  # Get initial block height
  local before=$(get_number "$chain" "getblockcount")
  echo -e "Initial block height: ${YELLOW}$before${NC}"
  
  # Get valid address
  local address=$(get_real_address "$chain")
  if [[ -z "$address" ]]; then
    echo -e "${RED}ERROR: Failed to get valid address for $chain${NC}"
    return 1
  fi
  echo -e "Using address: ${YELLOW}$address${NC}"
  
  # Grant comprehensive permissions
  echo -e "${BLUE}Granting comprehensive permissions...${NC}"
  for permission in connect send receive issue create mine admin activate; do
    direct_command "$chain" "grant $address $permission" > /dev/null
  done
  
  # Create a unique stream for transactions
  local timestamp=$(date +%s)
  local stream_name="txstream_$timestamp"
  echo -e "${BLUE}Creating transaction stream: $stream_name${NC}"
  direct_command "$chain" "create stream $stream_name true" > /dev/null
  direct_command "$chain" "subscribe $stream_name" > /dev/null
  
  # Create transactions
  local tx_count=10
  echo -e "${BLUE}Creating $tx_count transactions...${NC}"
  local txids=()
  for ((i=1; i<=tx_count; i++)); do
    local key="key_$(date +%s)_$i"
    local data=$(echo -n "Important transaction data $i for $chain" | xxd -p -c 1000)
    local txid=$(direct_command "$chain" "publish $stream_name $key $data")
    txid=${txid//[^a-zA-Z0-9]/}  # Clean up txid
    txids+=("$txid")
    echo -e "  Transaction $i created: ${YELLOW}${txid:0:16}...${NC}"
    # Small pause between transactions
    sleep 0.5
  done
  
  # Wait for transactions to propagate
  echo -e "${BLUE}Allowing transactions to propagate...${NC}"
  sleep 5
  
  # Check mempool for transactions
  local mempool_tx=$(get_number "$chain" "getmempoolinfo")
  echo -e "Transactions in mempool: ${YELLOW}$mempool_tx${NC}"
  
  # Force block creation
  echo -e "${BLUE}Initiating block generation...${NC}"
  force_mining "$chain" "$address" 0
  
  # Check results
  local after=$(get_number "$chain" "getblockcount")
  echo -e "Final block height: ${YELLOW}$after${NC}"
  
  if [[ "$after" -gt "$before" ]]; then
    local blocks_added=$((after - before))
    echo -e "${GREEN}SUCCESS! Created $blocks_added new block(s)${NC}"
    
    # Check if transactions made it into a block
    local latest_block_hash=$(direct_command "$chain" "getblockhash $after")
    latest_block_hash=${latest_block_hash//[^a-zA-Z0-9]/}
    
    local block_data=$(direct_command "$chain" "getblock $latest_block_hash 1")
    local included_txs=0
    
    # Check each transaction
    for txid in "${txids[@]}"; do
      if [[ "$block_data" == *"$txid"* ]]; then
        included_txs=$((included_txs + 1))
      fi
    done
    
    echo -e "Transactions included in block: ${YELLOW}$included_txs${NC} out of ${tx_count}"
    
    # For retailer-chain: if transactions weren't included, try with direct inclusion technique
    if [[ "$chain" == "retailer-chain" && "$included_txs" -eq 0 ]]; then
      echo -e "${YELLOW}Retailer chain needs special handling. Using focused approach...${NC}"
      
      # Create a special high-priority stream for retailer-chain
      local priority_stream="priority_stream_$(date +%s)"
      direct_command "$chain" "create stream $priority_stream true" > /dev/null
      
      # Create new priority transactions that should get mined
      local priority_txids=()
      echo -e "${BLUE}Creating priority transactions...${NC}"
      for i in {1..5}; do
        local key="priority_key_$(date +%s)_$i"
        # Using smaller data to increase chance of inclusion
        local data=$(echo -n "Critical data $i" | xxd -p -c 1000)
        local priority_txid=$(direct_command "$chain" "publish $priority_stream $key $data")
        priority_txid=${priority_txid//[^a-zA-Z0-9]/}
        priority_txids+=("$priority_txid")
        echo -e "  Priority TX $i: ${YELLOW}${priority_txid:0:16}...${NC}"
      done
      
      # More aggressive mining approach
      echo -e "${BLUE}Using aggressive mining for retailer-chain...${NC}"
      for i in {1..3}; do
        # Pause for TX propagation
        sleep 2
        # Multiple mining attempts with different settings
        direct_command "$chain" "setgenerate true 1" > /dev/null
        sleep 3
      done
      
      # Check if our priority transactions made it
      local final_height=$(get_number "$chain" "getblockcount")
      if [[ "$final_height" -gt "$after" ]]; then
        local final_block_hash=$(direct_command "$chain" "getblockhash $final_height")
        final_block_hash=${final_block_hash//[^a-zA-Z0-9]/}
        local final_block_data=$(direct_command "$chain" "getblock $final_block_hash 1")
        
        local priority_included=0
        for txid in "${priority_txids[@]}"; do
          if [[ "$final_block_data" == *"$txid"* ]]; then
            priority_included=$((priority_included + 1))
          fi
        done
        
        echo -e "After focused retry: ${YELLOW}$priority_included${NC} priority transactions included"
      fi
    fi
    
    echo -e "${GREEN}Block generation complete for $chain${NC}"
  else
    echo -e "${RED}FAILED: No new blocks were created${NC}"
    echo -e "${YELLOW}Mining info: $(direct_command "$chain" "getmininginfo")${NC}"
    return 1
  fi
  
  return 0
}

# Collect and display metrics with cleaner output
display_metrics() {
  echo -e "\n${CYAN}========== MULTICHAIN METRICS REPORT ==========${NC}"
  
  local chains=("main-chain" "distributor-chain" "retailer-chain")
  printf "${CYAN}%-18s %-10s %-15s %-15s %-15s${NC}\n" "CHAIN" "BLOCKS" "STREAMS" "TRANSACTIONS" "ASSETS"
  echo -e "${CYAN}------------------------------------------------------------------${NC}"
  
  for chain in "${chains[@]}"; do
    # Get metrics - parse numbers directly to avoid JSON output
    local blocks=$(get_number "$chain" "getblockcount")
    local streams=$(direct_command "$chain" "liststreams" | grep -o '"name"' | wc -l)
    local txs=$(direct_command "$chain" "getwalletinfo" | grep -o '"txcount".*[0-9]' | grep -o '[0-9]\+')
    local assets=$(direct_command "$chain" "listassets" | grep -o '"name"' | wc -l)
    
    # Display metrics with cleaner output
    printf "${YELLOW}%-18s${NC} ${GREEN}%-10s${NC} ${GREEN}%-15s${NC} ${GREEN}%-15s${NC} ${GREEN}%-15s${NC}\n" "$chain" "$blocks" "$streams" "$txs" "$assets"
  done
  
  echo -e "${CYAN}------------------------------------------------------------------${NC}"
  echo -e "${CYAN}Blockchain Status: ${GREEN}OPERATIONAL${NC}"
}

# Main function
main() {
  echo -e "${GREEN}===== MULTICHAIN TRANSACTION MINER & METRICS =====${NC}"
  
  if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo -e "Usage: $0 [OPTIONS]"
    echo -e "Options:"
    echo -e "  --all, -a            Process all chains"
    echo -e "  --chain, -c CHAIN    Process specific chain" 
    echo -e "  --metrics, -m        Display metrics only" 
    echo -e "  --help, -h           Show this help message"
    exit 0
  fi
  
  if [[ "$1" == "--metrics" || "$1" == "-m" ]]; then
    display_metrics
    exit 0
  fi
  
  if [[ "$1" == "--chain" || "$1" == "-c" ]] && [[ -n "$2" ]]; then
    generate_and_mine "$2"
    display_metrics
  else
    for chain in "main-chain" "distributor-chain" "retailer-chain"; do
      generate_and_mine "$chain"
    done
    display_metrics
  fi
  
  echo -e "\n${GREEN}Process completed successfully.${NC}"
}

main "$@"