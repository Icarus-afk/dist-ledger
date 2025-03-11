#!/bin/bash
# filepath: /home/lothrok/Documents/projects/dist-ledger/scripts/test_test.sh

# Test suite for test.sh script
# This script checks the functionality of the blockchain metrics collection tool

# Original script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_SCRIPT="${SCRIPT_DIR}/test.sh"
PROJECT_DIR="/home/lothrok/Documents/projects/dist-ledger"

# Test metrics
PASSED=0
FAILED=0
TOTAL=0

# Output colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

#----------------------------------------
# TEST INFRASTRUCTURE
#----------------------------------------

# Print test header
print_header() {
  echo -e "\n${YELLOW}===============================================${NC}"
  echo -e "${YELLOW}$1${NC}"
  echo -e "${YELLOW}===============================================${NC}"
}

# Record test result
assert() {
  local test_name="$1"
  local condition="$2"
  local message="$3"
  
  TOTAL=$((TOTAL + 1))
  
  if eval "$condition"; then
    echo -e "${GREEN}✓ PASS${NC}: $test_name"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $test_name"
    echo -e "      $message"
    FAILED=$((FAILED + 1))
  fi
}

# Create mock data directories
setup_mock_environment() {
  print_header "Setting up test environment"
  
  # Create test directories
  mkdir -p "${PROJECT_DIR}/test_data/main-chain"
  mkdir -p "${PROJECT_DIR}/test_data/distributor-chain"
  mkdir -p "${PROJECT_DIR}/test_data/retailer-chain"
  
  # Mock multichain-cli results
  mkdir -p /tmp/mock_commands
  
  echo "Test environment setup complete"
}

# Clean up test data
teardown_mock_environment() {
  print_header "Cleaning up test environment"
  
  # Remove test directories
  rm -rf "${PROJECT_DIR}/test_data"
  rm -rf /tmp/mock_commands
  
  echo "Test environment cleaned up"
}

# Create a mock response for multichain-cli commands
create_mock_response() {
  local command="$1"
  local response="$2"
  local hash=$(echo "$command" | md5sum | cut -d' ' -f1)
  
  echo "$response" > "/tmp/mock_commands/$hash"
}

#----------------------------------------
# MOCK DATA GENERATORS
#----------------------------------------

# Generate mock chain data
generate_mock_chain_data() {
  local chain=$1
  
  # Mock getblockchaininfo response
  create_mock_response "getblockchaininfo" '{
    "chain": "'$chain'",
    "blocks": 42,
    "headers": 42,
    "bestblockhash": "007f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f",
    "difficulty": 0.01234567,
    "verificationprogress": 1,
    "chainwork": "0000000000000000000000000000000000000000000000000000000000000000"
  }'
  
  # Mock getmininginfo response
  create_mock_response "getmininginfo" '{
    "blocks": 42,
    "currentblocksize": 1000,
    "currentblocktx": 5,
    "difficulty": 0.01234567,
    "errors": "",
    "genproclimit": -1,
    "networkhashps": 1234.56789,
    "pooledtx": 0,
    "testnet": false,
    "chain": "'$chain'",
    "generate": true
  }'
  
  # Mock getmempoolinfo response
  create_mock_response "getmempoolinfo" '{
    "size": 3,
    "bytes": 3250,
    "usage": 6680,
    "maxmempool": 300000000,
    "mempoolminfee": 0.00001000
  }'
  
  # Mock getinfo response
  create_mock_response "getinfo" '{
    "version": "2.0",
    "protocolversion": 20000,
    "chainname": "'$chain'",
    "description": "Test chain",
    "protocol": "multichain",
    "port": 7740,
    "setupblocks": 60,
    "nodeaddress": "'$chain'@127.0.0.1:7740",
    "burnaddress": "1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXZtHrm",
    "balance": 0.00000000,
    "reindex": false,
    "blocks": 42,
    "timeoffset": 0,
    "connections": 2,
    "proxy": "",
    "difficulty": 0.01234567,
    "testnet": false,
    "keypoololdest": 1611868045,
    "keypoolsize": 101,
    "paytxfee": 0.00000000,
    "relayfee": 0.00000000,
    "errors": ""
  }'
  
  # Mock liststreams response
  create_mock_response "liststreams" '[
    {
      "name": "root",
      "createtxid": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "streamref": "0-0-0",
      "open": true,
      "details": {
        "kind": "root"
      },
      "subscribed": true,
      "synchronized": true,
      "items": 1,
      "confirmed": 1,
      "keys": 0,
      "publishers": 1
    },
    {
      "name": "merkle_roots",
      "createtxid": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "streamref": "0-0-1",
      "open": true,
      "details": {},
      "subscribed": true,
      "synchronized": true,
      "items": 5,
      "confirmed": 5, 
      "keys": 5,
      "publishers": 1
    },
    {
      "name": "transaction_proofs",
      "createtxid": "7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
      "streamref": "0-0-2", 
      "open": true,
      "details": {},
      "subscribed": true,
      "synchronized": true,
      "items": 3,
      "confirmed": 3,
      "keys": 3, 
      "publishers": 1
    }
  ]'
  
  # Mock liststreamitems response for merkle_roots
  create_mock_response "liststreamitems merkle_roots 1" '[
    {
      "publishers": ["1ABC123DEF456GHI789"],
      "key": "merkle_root_1",
      "data": "7b227369676e6174757265223a22307834313530222c226d65726b6c65526f6f74223a22307866666661227d",
      "confirmations": 10,
      "blockheight": 32,
      "txid": "abcdef1234567890",
      "vout": 0,
      "time": 1624304461
    }
  ]'
  
  # Mock liststreamitems response for transaction_proofs
  create_mock_response "liststreamitems transaction_proofs 1" '[
    {
      "publishers": ["1DEF456GHI789ABC123"],
      "key": "tx_proof_1",
      "data": "7b2270726f6f66223a5b2230783432222c22307834332225d",
      "confirmations": 8,
      "blockheight": 34,
      "txid": "1234567890abcdef",
      "vout": 0,
      "time": 1624305000
    }
  ]'
  
  # Mock liststreamitems for sidechain_merkle_roots
  if [ "$chain" == "main-chain" ]; then
    create_mock_response "liststreamitems sidechain_merkle_roots 20" '[
      {
        "publishers": ["1MAIN123DEF456GHI789"],
        "key": "shipment_001",
        "data": "7b226d65726b6c65526f6f74223a22307835353535222c22636861696e223a2264697374726962757461722d636861696e227d",
        "confirmations": 15,
        "blockheight": 27,
        "txid": "5678901234abcdef",
        "vout": 0,
        "time": 1624300000
      },
      {
        "publishers": ["1MAIN123DEF456GHI789"],
        "key": "shipment_002",
        "data": "7b226d65726b6c65526f6f74223a22307836363636222c22636861696e223a2264697374726962757461722d636861696e227d",
        "confirmations": 12,
        "blockheight": 30,
        "txid": "abcdef5678901234",
        "vout": 0,
        "time": 1624302000
      }
    ]'
    
    # Mock liststreamitems for cross_chain_verifications
    create_mock_response "liststreamitems cross_chain_verifications 20" '[
      {
        "publishers": ["1MAIN123DEF456GHI789"],
        "key": "verification_001",
        "data": "7b227665726966696564223a747275652c226368616c6c656e6765223a66616c73657d",
        "confirmations": 10,
        "blockheight": 32,
        "txid": "9012345678abcdef",
        "vout": 0,
        "time": 1624304000
      },
      {
        "publishers": ["1MAIN123DEF456GHI789"],
        "key": "verification_002",
        "data": "7b227665726966696564223a747275652c226368616c6c656e6765223a66616c73657d",
        "confirmations": 8,
        "blockheight": 34,
        "txid": "cdef90123456789a",
        "vout": 0,
        "time": 1624306000
      }
    ]'
  fi
  
  # Create mock block data for the last 10 blocks
  for i in {0..9}; do
    local block_height=$((42 - i))
    local block_hash="000000000000000000000000000000000000000000000000000000000000$i"
    
    # Mock getblockhash response
    create_mock_response "getblockhash $block_height" "$block_hash"
    
    # Mock getblock response
    local timestamp=$((1624300000 + i * 600))
    local tx_count=$((1 + i % 5))
    
    local tx_array="["
    for j in $(seq 1 $tx_count); do
      tx_array+="\"tx_hash_${i}_${j}\""
      if [ "$j" -lt "$tx_count" ]; then
        tx_array+=","
      fi
    done
    tx_array+="]"
    
    create_mock_response "getblock $block_hash" '{
      "hash": "'$block_hash'",
      "confirmations": '$i',
      "height": '$block_height',
      "time": '$timestamp',
      "tx": '$tx_array',
      "chainwork": "0000000000000000000000000000000000000000000000000000000000000000"
    }'
  done
}

#----------------------------------------
# UTILITY FUNCTION TESTS
#----------------------------------------

test_parse_json() {
  print_header "Testing parse_json function"
  
  # Extract parse_json function from test.sh
  source <(grep -A 20 "parse_json()" "$TEST_SCRIPT")
  
  # Test basic parsing
  local json='{"name":"test","value":42}'
  assert "Parse simple string value" "[ \"$(parse_json \"$json\" \".name\" \"default\")\" = \"test\" ]" \
    "Expected 'test', got '$(parse_json "$json" ".name" "default")'"
  
  assert "Parse simple numeric value" "[ \"$(parse_json \"$json\" \".value\" \"0\")\" = \"42\" ]" \
    "Expected '42', got '$(parse_json "$json" ".value" "0")'"
    
  # Test with missing key
  assert "Parse missing key should return default" "[ \"$(parse_json \"$json\" \".missing\" \"default\")\" = \"default\" ]" \
    "Expected 'default', got '$(parse_json "$json" ".missing" "default")'"
    
  # Test with complex JSON
  local complex_json='{"data":{"metrics":{"height":100,"difficulty":1.234}},"status":"ok"}'
  assert "Parse nested value with simple pattern" \
    "echo \"$complex_json\" | grep -o '\"height\":[^,}]*' | sed 's/.*: *//' | tr -d '\"' | grep -q '100'" \
    "Failed to extract height value using simplified parsing"
}

test_timestamp_to_date() {
  print_header "Testing timestamp_to_date function"
  
  # Extract timestamp_to_date function from test.sh
  source <(grep -A 2 "timestamp_to_date()" "$TEST_SCRIPT")
  
  # Test conversion (note: this is timezone dependent)
  local timestamp=1624300000
  local expected_date=$(date -d "@$timestamp" "+%Y-%m-%d %H:%M:%S")
  
  assert "Convert timestamp to date" \
    "[ \"$(timestamp_to_date \"$timestamp\")\" = \"$expected_date\" ]" \
    "Expected '$expected_date', got '$(timestamp_to_date "$timestamp")'"
}

test_is_number() {
  print_header "Testing is_number function"
  
  # Extract is_number function from test.sh
  source <(grep -A 2 "is_number()" "$TEST_SCRIPT")
  
  # Test various inputs
  assert "is_number with integer" "is_number 42" "Expected 42 to be recognized as a number"
  assert "is_number with decimal" "is_number 3.14" "Expected 3.14 to be recognized as a number"
  assert "is_number with string" "! is_number abc" "Expected 'abc' NOT to be recognized as a number"
  assert "is_number with empty string" "! is_number ''" "Expected empty string NOT to be recognized as a number"
  assert "is_number with alpha-numeric" "! is_number '42abc'" "Expected '42abc' NOT to be recognized as a number"
}

#----------------------------------------
# MOCK THE MULTICHAIN-CLI COMMAND
#----------------------------------------

mock_multichain_cli() {
  # Create a mock multichain-cli script
  cat > /tmp/multichain-cli << 'EOF'
#!/bin/bash

# Skip all params until we find the command
command=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -datadir=*|-rpc*=*|*-chain)
      shift
      ;;
    *)
      command="$1"
      shift
      if [[ $# -gt 0 ]]; then
        command="$command $1"
      fi
      break
      ;;
  esac
done

# Return mock data based on command
hash=$(echo "$command" | md5sum | cut -d' ' -f1)
if [[ -f "/tmp/mock_commands/$hash" ]]; then
  cat "/tmp/mock_commands/$hash"
else
  echo "{\"error\":\"No mock data for command: $command\", \"hash\":\"$hash\"}"
fi
EOF

  chmod +x /tmp/multichain-cli
  
  # Modify PATH to use our mock
  export PATH="/tmp:$PATH"
}

#----------------------------------------
# TEST CLI METRICS COLLECTION
#----------------------------------------

test_collect_chain_metrics() {
  print_header "Testing collect_chain_metrics function"
  
  # Generate mock data for chains
  generate_mock_chain_data "main-chain"
  
  # Mock the pgrep command for check_running
  mock_check_running() {
    cat > /tmp/pgrep << 'EOF'
#!/bin/bash
# Mock pgrep to always return a process for blockchain nodes
if [[ "$*" == *multichaind.*-chain* ]]; then
  echo "12345"
  exit 0
else
  exit 1
fi
EOF
    chmod +x /tmp/pgrep
  }
  
  # Mock the ps command for resource metrics
  mock_ps() {
    cat > /tmp/ps << 'EOF'
#!/bin/bash
# Mock ps to return resource usage data
echo "%CPU %MEM VSZ RSS"
echo "2.5 1.3 123456 54321"
EOF
    chmod +x /tmp/ps
  }
  
  # Mock the du command
  mock_du() {
    cat > /tmp/du << 'EOF'
#!/bin/bash
# Mock du to return disk usage
echo "125M /some/path"
EOF
    chmod +x /tmp/du
  }
  
  # Patch the original script to use our test metrics functions
  cp "$TEST_SCRIPT" "/tmp/test_metrics_patched.sh"
  
  # Run the metrics collection function and capture output
  (
    # Add our mocks to the PATH
    mock_check_running
    mock_ps
    mock_du
    export PATH="/tmp:$PATH"
    
    # Source the script to get access to functions
    source "/tmp/test_metrics_patched.sh"
    
    # Run the function
    output=$(collect_chain_metrics "main-chain" "7744")
    
    # Check if key metrics appear in output
    assert "Chain height reported" "echo \"$output\" | grep -q \"Chain height: 42\"" \
      "Expected to see chain height in output"
      
    assert "Difficulty reported" "echo \"$output\" | grep -q \"difficulty\"" \
      "Expected to see difficulty in output"
      
    assert "Block time analysis included" "echo \"$output\" | grep -q \"Block Time Analysis\"" \
      "Expected to see Block Time Analysis section"
      
    assert "Transaction throughput reported" "echo \"$output\" | grep -q \"Transaction Throughput\"" \
      "Expected to see Transaction Throughput section"
      
    assert "Stream metrics reported" "echo \"$output\" | grep -q \"Stream Metrics\"" \
      "Expected to see Stream Metrics section"
      
    assert "System resources reported" "echo \"$output\" | grep -q \"System Resources\"" \
      "Expected to see System Resources section"
  )
}

test_collect_merkle_metrics() {
  print_header "Testing collect_merkle_metrics function"
  
  # Generate mock data for main chain focusing on Merkle proof data
  generate_mock_chain_data "main-chain"
  
  # Mock the curl command for API response times
  mock_curl() {
    cat > /tmp/curl << 'EOF'
#!/bin/bash
# Mock curl to return timing information
if [[ "$*" == *-w* ]]; then
  echo "0.123"
else
  echo "{\"success\":true,\"verified\":true}"
fi
EOF
    chmod +x /tmp/curl
  }
  
  # Mock the pgrep command to simulate API running
  mock_pgrep_api() {
    cat > /tmp/pgrep << 'EOF'
#!/bin/bash
# Mock pgrep to show relay.js is running
if [[ "$*" == *"node.*relay.js"* ]]; then
  echo "12346"
  exit 0
else
  # For blockchain nodes
  if [[ "$*" == *multichaind.*-chain* ]]; then
    echo "12345"
    exit 0
  fi
  exit 1
fi
EOF
    chmod +x /tmp/pgrep
  }
  
  # Patch the original script to use our test metrics functions
  cp "$TEST_SCRIPT" "/tmp/test_metrics_patched.sh"
  
  # Run the metrics collection function and capture output
  (
    # Add our mocks to the PATH
    mock_curl
    mock_pgrep_api
    export PATH="/tmp:$PATH"
    
    # Source the script to get access to functions
    source "/tmp/test_metrics_patched.sh"
    
    # Run the function
    output=$(collect_merkle_metrics)
    
    # Check if key merkle metrics appear in output
    assert "Merkle root count reported" "echo \"$output\" | grep -q \"Found 2 Merkle root registrations\"" \
      "Expected to see Merkle root count in output"
      
    assert "Cross-chain verifications reported" "echo \"$output\" | grep -q \"Found 2 cross-chain verifications\"" \
      "Expected to see cross-chain verification count in output"
      
    assert "API verification times reported" "echo \"$output\" | grep -q \"API Verification Response Times\"" \
      "Expected to see API response time section"
      
    assert "Merkle proof verification time reported" "echo \"$output\" | grep -q \"Merkle proof verification\"" \
      "Expected to see Merkle proof verification timing in output"
  )
}

#----------------------------------------
# INTEGRATION TEST
#----------------------------------------

test_full_script_execution() {
  print_header "Testing full script execution"
  
  # Generate mock data for all chains
  generate_mock_chain_data "main-chain"
  generate_mock_chain_data "distributor-chain"
  generate_mock_chain_data "retailer-chain"
  
  # Set up all necessary mocks
  mock_multichain_cli
  
  # Mock the pgrep command
  cat > /tmp/pgrep << 'EOF'
#!/bin/bash
# Mock pgrep to show all chains running
if [[ "$*" == *"node.*relay.js"* ]]; then
  echo "12346"
  exit 0
elif [[ "$*" == *multichaind.*-chain* ]]; then
  echo "12345"
  exit 0
else
  exit 1
fi
EOF
  chmod +x /tmp/pgrep
  
  # Mock the ps command
  cat > /tmp/ps << 'EOF'
#!/bin/bash
# Mock ps to return resource usage data
echo "%CPU %MEM VSZ RSS"
echo "2.5 1.3 123456 54321"
EOF
  chmod +x /tmp/ps
  
  # Mock the du command
  cat > /tmp/du << 'EOF'
#!/bin/bash
# Mock du to return disk usage
echo "125M /some/path"
EOF
  chmod +x /tmp/du
  
  # Mock the curl command
  cat > /tmp/curl << 'EOF'
#!/bin/bash
# Mock curl to return timing information
echo "0.123"
EOF
  chmod +x /tmp/curl
  
  # Run the full script with output capture
  (
    export PATH="/tmp:$PATH"
    output=$("$TEST_SCRIPT" --chain main)
    
    assert "Script completes successfully" "[ $? -eq 0 ]" \
      "Script exited with non-zero status"
      
    assert "Main chain metrics shown" "echo \"$output\" | grep -q \"main-chain Metrics\"" \
      "Expected to see main-chain metrics section"
      
    assert "Merkle metrics shown" "echo \"$output\" | grep -q \"Merkle Tree Performance Metrics\"" \
      "Expected to see Merkle tree metrics section"
  )
  
  # Test with JSON output flag
  (
    export PATH="/tmp:$PATH"
    "$TEST_SCRIPT" --json &>/dev/null
    assert "JSON format option accepted" "[ $? -eq 0 ]" \
      "Script failed when JSON format requested"
  )
  
  # Test with output file
  (
    export PATH="/tmp:$PATH"
    "$TEST_SCRIPT" --output /tmp/metrics_output.log &>/dev/null
    assert "Output file option works" "[ -f /tmp/metrics_output.log ]" \
      "Expected output file was not created"
    
    # Clean up
    rm -f /tmp/metrics_output.log
  )
}

#----------------------------------------
# CREATE ACTUAL TRANSACTION TEST 
#----------------------------------------

test_create_actual_transaction() {
  print_header "Testing with actual transaction (if chains are running)"
  
  # Check if chains are actually running before attempting this test
  if ! pgrep -f "multichaind.*main-chain" > /dev/null; then
    echo -e "${YELLOW}Skipping real transaction test - chains not running${NC}"
    return 0
  fi
  
  echo "Creating test transaction on main chain..."
  
  # Create an actual transaction by publishing to the main chain's merkle_roots stream
  (
    # Try to publish a test item
    TXID=$(multichain-cli -datadir="${PROJECT_DIR}/data/main-chain" \
      -rpcuser="multichainrpc" -rpcpassword="23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7" \
      main-chain publish sidechain_merkle_roots test_merkle_root \
      '{"json":{"merkleRoot":"0x1234test","timestamp":"'$(date +%s)'"}}' 2>/dev/null)
    
    # Check if transaction was created
    if [ ! -z "$TXID" ] && [ ${#TXID} -gt 10 ]; then
      assert "Transaction successfully created" "true" ""
      
      # Mine a block to confirm the transaction
      multichain-cli -datadir="${PROJECT_DIR}/data/main-chain" \
        -rpcuser="multichainrpc" -rpcpassword="23RwteDXLwo6hUpifeuNg5KYXte6XFR5JaokAQAfs7E7" \
        main-chain generate 1 >/dev/null 2>&1
      
      # Wait for block to be mined
      sleep 5
      
      # Now run the test script with normal path to see if it detects our transaction
      output=$("$TEST_SCRIPT" -c main 2>/dev/null)
      
      assert "Test transaction detected" "echo \"$output\" | grep -q \"test_merkle_root\"" \
        "Created transaction was not detected by the metrics script"
    else
      echo -e "${YELLOW}Could not create test transaction, skipping detection test${NC}"
    fi
  )
}

#----------------------------------------
# MAIN TEST RUNNER
#----------------------------------------

main() {
  # Create header
  echo -e "${YELLOW}====================================================${NC}"
  echo -e "${YELLOW}   Blockchain Metrics Test Script Test Suite v1.0${NC}"
  echo -e "${YELLOW}====================================================${NC}"
  
  # Setup test environment
  setup_mock_environment
  
  # Unit tests
  test_parse_json
  test_timestamp_to_date
  test_is_number
  
  # Function tests with mocks
  test_collect_chain_metrics
  test_collect_merkle_metrics
  
  # Integration test
  test_full_script_execution
  
  # Create and test real transaction (if chains are running)
  test_create_actual_transaction
  
  # Cleanup
  teardown_mock_environment
  
  # Print summary
  echo -e "\n${YELLOW}====================================================${NC}"
  echo -e "${YELLOW}                 Test Results${NC}"
  echo -e "${YELLOW}====================================================${NC}"
  echo -e "Total tests: ${TOTAL}"
  echo -e "Passed:      ${GREEN}${PASSED}${NC}"
  echo -e "Failed:      ${RED}${FAILED}${NC}"
  
  if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
  else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
  fi
}

main "$@"