#!/bin/bash
# filepath: /home/lothrok/Documents/projects/dist-ledger/setup-streams.sh

# Clear the terminal
clear

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║            Dist-Ledger Stream Setup                            ║"
echo "║            Supply Chain Management System                      ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"

echo "🔄 Initializing blockchain streams for the distributed ledger system..."

# API endpoint configuration
API_URL="http://localhost:3005/api/system/init"

# Function to check if relay server is running
check_server() {
    echo "🔍 Checking if the relay server is running..."
    if curl -s --head --request GET http://localhost:3005/api/health | grep "200 OK" > /dev/null; then
        echo "✅ Relay server is running."
        return 0
    else
        echo "❌ Relay server is not running or not responding."
        echo "   Please start the relay server first with: node relay/relay.js"
        return 1
    fi
}

# Function to initialize streams
initialize_streams() {
    echo "🚀 Sending initialization request to API server..."
    
    response=$(curl -s -X POST $API_URL \
        -H "Content-Type: application/json" \
        -w "\n%{http_code}")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        echo "✅ Streams initialized successfully!"
        echo "📊 Response details:"
        
        # Check if jq is installed for pretty printing JSON
        if command -v jq &> /dev/null; then
            echo "$body" | jq .
        else
            echo "$body" | grep -o '"status":"[^"]*"' | cut -d':' -f2 | tr -d '"'
            echo "For detailed results, install jq: sudo apt-get install jq"
        fi
    else
        echo "❌ Failed to initialize streams. Status code: $http_code"
        echo "Error details:"
        echo "$body"
    fi
}

# Main execution
main() {
    if check_server; then
        initialize_streams
        
        echo ""
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║                                                                ║"
        echo "║  Stream initialization complete!                               ║"
        echo "║                                                                ║"
        echo "║  The following streams should now be set up:                   ║"
        echo "║                                                                ║"
        echo "║  Main Chain:                                                  ║"
        echo "║    - entity_registry                                           ║"
        echo "║    - product_registry                                          ║"
        echo "║    - merkle_roots                                              ║"
        echo "║    - asset_transfers                                           ║"
        echo "║    - verification_proofs                                       ║"
        echo "║                                                                ║"
        echo "║  Distributor Chain & Retailer Chain:                          ║"
        echo "║    - Entity-specific streams will be created when              ║"
        echo "║      entities register                                         ║"
        echo "║                                                                ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
    fi
}

# Execute main function
main