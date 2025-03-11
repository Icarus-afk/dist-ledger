#!/bin/bash
# filepath: /home/lothrok/Documents/projects/dist-ledger/scripts/chain_analytics.sh

# Script to measure average transaction and block creation times
PROJECT_DIR="/home/lothrok/Documents/projects/dist-ledger"
RPC_USER="multichainrpc"
RPC_PASSWORD="23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Direct command execution
execute_cmd() {
  local chain=$1
  local cmd=$2
  local datadir="${PROJECT_DIR}/data/${chain}"
  
  multichain-cli -datadir=$datadir -rpcuser=$RPC_USER -rpcpassword=$RPC_PASSWORD $chain $cmd 2>/dev/null
}

# Get clean number from output
get_number() {
  local output="$1"
  echo "$output" | grep -o '[0-9]\+' | head -1
}

# Calculate average block creation time
calculate_block_time() {
  local chain=$1
  local block_count=10  # Number of recent blocks to analyze
  
  echo -e "${BLUE}Analyzing recent blocks in $chain...${NC}"
  
  # Get current block height
  local height=$(get_number "$(execute_cmd "$chain" "getblockcount")")
  
  # Adjust count if chain doesn't have enough blocks
  if [[ $height -lt $block_count ]]; then
    block_count=$height
  fi
  
  # Calculate start and end blocks
  local end_block=$height
  local start_block=$((end_block - block_count + 1))
  
  # Collect block times
  local block_times=()
  local prev_time=""
  
  for ((i=start_block; i<=end_block; i++)); do
    # Get block hash
    local block_hash=$(execute_cmd "$chain" "getblockhash $i" | tr -d '"')
    
    # Get block data
    local block_data=$(execute_cmd "$chain" "getblock $block_hash")
    
    # Extract timestamp
    local time=$(echo "$block_data" | grep -o '"time"[ :]*[0-9]*' | grep -o '[0-9]*')
    
    # Calculate time difference
    if [[ -n "$prev_time" && -n "$time" ]]; then
      local diff=$((time - prev_time))
      block_times+=($diff)
    fi
    
    prev_time=$time
  done
  
  # Calculate average block time
  local sum=0
  local count=0
  
  for t in "${block_times[@]}"; do
    sum=$((sum + t))
    count=$((count + 1))
  done
  
  if [[ $count -gt 0 ]]; then
    local avg=$(echo "scale=2; $sum / $count" | bc)
    echo "$avg"
  else
    echo "N/A"
  fi
}

# Measure transaction times by creating new transactions and tracking confirmation
measure_tx_time() {
  local chain=$1
  local tx_count=5  # Number of transactions to test
  
  echo -e "\n${GREEN}===== Measuring Transaction Time for $chain =====${NC}"
  
  # Get a valid address
  local address=$(execute_cmd "$chain" "getaddresses" | grep -o '"[a-zA-Z0-9]\{30,\}"' | head -1 | tr -d '"')
  echo -e "Using address: ${YELLOW}$address${NC}"
  
  # Create a test stream
  local timestamp=$(date +%s)
  local stream_name="timing_test_$timestamp"
  execute_cmd "$chain" "create stream $stream_name true" > /dev/null
  execute_cmd "$chain" "subscribe $stream_name" > /dev/null
  
  # Track transaction times
  local tx_times=()
  local tx_ids=()
  local start_times=()
  
  # Create transactions and record start time
  echo -e "${BLUE}Creating $tx_count transactions...${NC}"
  for ((i=1; i<=tx_count; i++)); do
    local start_time=$(date +%s)
    local key="key_$timestamp_$i"
    local data=$(echo -n "Timing test $i" | xxd -p -c 1000)
    
    local txid=$(execute_cmd "$chain" "publish $stream_name $key $data" | tr -d '"')
    
    tx_ids+=("$txid")
    start_times+=($start_time)
    echo -e "  Transaction $i created: ${YELLOW}${txid:0:16}...${NC}"
    
    # Small pause between transactions
    sleep 0.5
  done
  
  # Force mining to include our transactions
  echo -e "${BLUE}Mining to confirm transactions...${NC}"
  execute_cmd "$chain" "setruntimeparam miningturnover 0.01" > /dev/null
  execute_cmd "$chain" "setruntimeparam mineemptyrounds 0" > /dev/null
  execute_cmd "$chain" "setgenerate true 1" > /dev/null
  
  # Wait for blocks to be generated
  echo -e "${BLUE}Waiting for confirmation...${NC}"
  sleep 15
  
  # Check confirmation status and calculate times
  echo -e "${BLUE}Checking confirmation status...${NC}"
  local confirmed=0
  local total_time=0
  
  for ((i=0; i<tx_count; i++)); do
    local txid="${tx_ids[$i]}"
    local start_time="${start_times[$i]}"
    
    # Get transaction info
    local tx_data=$(execute_cmd "$chain" "getrawtransaction $txid 1")
    
    # Check if confirmed (has confirmations)
    local confirmations=$(echo "$tx_data" | grep -o '"confirmations"[ :]*[0-9]*' | grep -o '[0-9]*')
    
    if [[ -n "$confirmations" && "$confirmations" -gt 0 ]]; then
      local block_hash=$(echo "$tx_data" | grep -o '"blockhash"[ :]*"[^"]*"' | grep -o '"[^"]*"' | tail -1 | tr -d '"')
      local block_data=$(execute_cmd "$chain" "getblock $block_hash")
      local block_time=$(echo "$block_data" | grep -o '"time"[ :]*[0-9]*' | grep -o '[0-9]*')
      
      local tx_time=$((block_time - start_time))
      total_time=$((total_time + tx_time))
      confirmed=$((confirmed + 1))
      echo -e "  Transaction ${i+1}: ${GREEN}Confirmed in $tx_time seconds${NC}"
    else
      echo -e "  Transaction ${i+1}: ${RED}Not confirmed${NC}"
    fi
  done
  
  # Calculate average confirmation time
  if [[ $confirmed -gt 0 ]]; then
    local avg_time=$(echo "scale=2; $total_time / $confirmed" | bc)
    echo -e "${GREEN}Average transaction time: ${WHITE}$avg_time seconds${NC}"
    echo "$avg_time"
  else
    echo -e "${RED}No transactions were confirmed${NC}"
    echo "N/A"
  fi
}

# Show comprehensive performance report
generate_performance_report() {
  echo -e "\n${CYAN}========== BLOCKCHAIN PERFORMANCE REPORT ==========${NC}"
  
  # Table header
  printf "${CYAN}%-18s %-20s %-25s${NC}\n" "CHAIN" "AVG BLOCK TIME (s)" "AVG TRANSACTION TIME (s)"
  echo -e "${CYAN}--------------------------------------------------------------------${NC}"
  
  # Process each chain
  for chain in "main-chain" "distributor-chain" "retailer-chain"; do
    echo -e "${YELLOW}Analyzing $chain...${NC}"
    
    # Calculate block time
    local block_time=$(calculate_block_time "$chain")
    
    # Measure transaction time
    local tx_time=$(measure_tx_time "$chain")
    
    # Display results
    printf "${YELLOW}%-18s${NC} ${GREEN}%-20s${NC} ${GREEN}%-25s${NC}\n" "$chain" "$block_time" "$tx_time"
  done
  
  echo -e "${CYAN}--------------------------------------------------------------------${NC}"
  echo -e "${CYAN}Report generated on:${NC} $(date)"
}

# Main function
main() {
  echo -e "${GREEN}===== MULTICHAIN PERFORMANCE ANALYTICS =====${NC}"
  
  if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo -e "Usage: $0 [OPTIONS]"
    echo -e "Options:"
    echo -e "  --all, -a            Analyze all chains"
    echo -e "  --chain, -c CHAIN    Analyze specific chain"
    echo -e "  --help, -h           Show this help message"
    exit 0
  fi
  
  if [[ "$1" == "--chain" || "$1" == "-c" ]] && [[ -n "$2" ]]; then
    echo -e "${BLUE}Analyzing chain: $2${NC}"
    local block_time=$(calculate_block_time "$2")
    local tx_time=$(measure_tx_time "$2")
    
    echo -e "\n${CYAN}=== Performance Summary for $2 ===${NC}"
    echo -e "${YELLOW}Average block time:${NC} ${GREEN}$block_time seconds${NC}"
    echo -e "${YELLOW}Average transaction time:${NC} ${GREEN}$tx_time seconds${NC}"
  else
    generate_performance_report
  fi
  
  echo -e "\n${GREEN}Performance analysis completed.${NC}"
}

main "$@"