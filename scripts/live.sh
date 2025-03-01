#!/bin/bash

PROJECT_DIR="/home/lothrok/Documents/projects/dist-ledger"
CHAINS=("distributor-chain" "retailer-chain" "main-chain")

# Terminal colors
RESET="\033[0m"
BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
MAGENTA="\033[35m"
CYAN="\033[36m"

# Show usage information
function show_usage() {
    echo "MultiChain Log Monitor"
    echo "Usage: $0 [options] [chain-name]"
    echo
    echo "Options:"
    echo "  -a, --all       Show logs for all chains (default)"
    echo "  -l, --lines N   Show last N lines (default: 50)"
    echo "  -f, --follow    Follow logs in real-time (default)"
    echo "  -s, --search X  Search for keyword X in logs"
    echo "  -e, --errors    Only show errors and warnings"
    echo "  -c, --cli       Show CLI history logs instead of debug logs"
    echo "  -h, --help      Show this help message"
    echo
    echo "Examples:"
    echo "  $0                     # Show all chain logs in real-time"
    echo "  $0 distributor-chain   # Show distributor-chain logs only"
    echo "  $0 -c                  # Show CLI history logs (commands run)"
}

# Find the log file for a chain - check multiple possible locations
function get_log_file() {
    local chain=$1
    local use_cli_history=$2
    
    # Check for CLI history logs if requested
    if [ "$use_cli_history" = true ]; then
        for node in "" "-node0" "-node1" "-node2" "-node3"; do
            local cli_path="${PROJECT_DIR}/data/${chain}${node}/.cli_history/${chain}.log"
            if [ -f "$cli_path" ]; then
                echo "$cli_path"
                return 0
            fi
        done
    fi
    
    # Check possible debug log file locations
    local possible_paths=(
        "${PROJECT_DIR}/data/${chain}/debug.log"
        "${PROJECT_DIR}/data/${chain}/multichaind.log"
        "${PROJECT_DIR}/data/${chain}/${chain}.log"
        "${PROJECT_DIR}/logs/${chain}.log"
    )
    
    # Try each possible path
    for path in "${possible_paths[@]}"; do
        if [ -f "$path" ]; then
            echo "$path"
            return 0
        fi
    done
    
    # Check per-node directories
    for node in "0" "1" "2" "3"; do
        local node_log="${PROJECT_DIR}/data/${chain}-node${node}/debug.log"
        if [ -f "$node_log" ]; then
            echo "$node_log"
            return 0
        fi
    done
    
    # If chain directory exists, find any .log files
    if [ -d "${PROJECT_DIR}/data/${chain}" ]; then
        local found_log=$(find "${PROJECT_DIR}/data/${chain}" -name "*.log" -type f | head -1)
        if [ -n "$found_log" ]; then
            echo "$found_log"
            return 0
        fi
    fi
    
    # Check for per-node CLI history recursively
    for node in "" "-node0" "-node1" "-node2" "-node3"; do
        local dir_path="${PROJECT_DIR}/data/${chain}${node}"
        if [ -d "$dir_path" ]; then
            local found_log=$(find "$dir_path" -name "*.log" -type f | head -1)
            if [ -n "$found_log" ]; then
                echo "$found_log"
                return 0
            fi
        fi
    done
    
    # If no log file found
    echo ""
    return 1
}

# Show logs for a specific chain with color coding
function show_chain_logs() {
    local chain=$1
    local color=$2
    local lines=$3
    local follow=$4
    local search=$5
    local errors_only=$6
    local use_cli_history=$7
    
    local log_file=$(get_log_file "$chain" "$use_cli_history")
    
    # Check if log file exists
    if [ -z "$log_file" ]; then
        echo -e "${RED}No log file found for $chain${RESET}"
        echo -e "${YELLOW}Looking in: ${PROJECT_DIR}/data/${chain}/ and subdirectories${RESET}"
        
        # List what's in the chain directory to help debug
        if [ -d "${PROJECT_DIR}/data/${chain}" ]; then
            echo -e "${YELLOW}Directories in ${chain}:${RESET}"
            find "${PROJECT_DIR}/data/${chain}" -type d | head -10
            echo -e "${YELLOW}All log files:${RESET}"
            find "${PROJECT_DIR}/data/${chain}" -name "*.log" 2>/dev/null || echo "No log files found"
        else
            echo -e "${RED}Chain directory doesn't exist: ${PROJECT_DIR}/data/${chain}${RESET}"
            echo -e "${YELLOW}Available directories:${RESET}"
            find "${PROJECT_DIR}/data" -maxdepth 1 -type d | sort
        fi
        echo
        return
    fi
    
    echo -e "${YELLOW}Using log file: $log_file${RESET}"
    
    # Build the command
    local cmd="cat"
    if [ "$follow" = true ]; then
        cmd="tail -f"
    fi
    
    # Add lines parameter if specified
    if [ -n "$lines" ]; then
        cmd="tail -n $lines"
    fi
    
    # Add chain name prefix to each line
    local prefix="${color}${BOLD}[${chain}]${RESET} "
    
    # Execute the log viewing command with appropriate filters
    if [ "$errors_only" = true ]; then
        if [ -n "$search" ]; then
            $cmd "$log_file" | grep -E 'ERROR|WARN|WARNING|CRITICAL|FATAL|EXCEPTION' | grep -i "$search" | sed "s/^/$prefix/"
        else
            $cmd "$log_file" | grep -E 'ERROR|WARN|WARNING|CRITICAL|FATAL|EXCEPTION' | sed "s/^/$prefix/"
        fi
    else
        if [ -n "$search" ]; then
            $cmd "$log_file" | grep -i "$search" | sed "s/^/$prefix/"
        else
            $cmd "$log_file" | sed "s/^/$prefix/"
        fi
    fi
}

# Main function
function main() {
    local all=true
    local lines="50"
    local follow=true
    local search=""
    local errors_only=false
    local use_cli_history=false
    local chain=""
    
    # Parse command line options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -a|--all)
                all=true
                shift
                ;;
            -l|--lines)
                lines="$2"
                shift 2
                ;;
            -f|--follow)
                follow=true
                shift
                ;;
            -s|--search)
                search="$2"
                shift 2
                ;;
            -e|--errors)
                errors_only=true
                shift
                ;;
            -c|--cli)
                use_cli_history=true
                shift
                ;;
            distributor-chain|retailer-chain|main-chain)
                all=false
                chain="$1"
                shift
                ;;
            *)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Show header
    echo -e "${BOLD}${BLUE}==== MultiChain Log Monitor ====${RESET}"
    echo -e "${YELLOW}Press Ctrl+C to exit${RESET}"
    echo
    
    # If specific chain is selected
    if [ "$all" = false ] && [ -n "$chain" ]; then
        case $chain in
            distributor-chain)
                show_chain_logs "$chain" "$GREEN" "$lines" "$follow" "$search" "$errors_only" "$use_cli_history"
                ;;
            retailer-chain)
                show_chain_logs "$chain" "$CYAN" "$lines" "$follow" "$search" "$errors_only" "$use_cli_history"
                ;;
            main-chain)
                show_chain_logs "$chain" "$MAGENTA" "$lines" "$follow" "$search" "$errors_only" "$use_cli_history"
                ;;
        esac
        return
    fi
    
    # If all chains are selected
    if ! $follow; then
        # For non-follow mode, show logs sequentially
        show_chain_logs "distributor-chain" "$GREEN" "$lines" false "$search" "$errors_only" "$use_cli_history"
        show_chain_logs "retailer-chain" "$CYAN" "$lines" false "$search" "$errors_only" "$use_cli_history"
        show_chain_logs "main-chain" "$MAGENTA" "$lines" false "$search" "$errors_only" "$use_cli_history"
    else
        # For follow mode, use tmux to create split view
        if command -v tmux &> /dev/null; then
            # Kill existing session if it exists
            tmux kill-session -t multichain_logs 2>/dev/null
            
            # Create a new tmux session with three panes
            tmux new-session -d -s multichain_logs
            tmux split-window -h
            tmux select-pane -t 0
            tmux split-window -v
            
            # Send commands to each pane
            tmux send-keys -t 0 "$0 distributor-chain $([ $use_cli_history = true ] && echo '-c')" C-m
            tmux send-keys -t 1 "$0 retailer-chain $([ $use_cli_history = true ] && echo '-c')" C-m
            tmux send-keys -t 2 "$0 main-chain $([ $use_cli_history = true ] && echo '-c')" C-m
            
            # Attach to the session
            tmux attach-session -t multichain_logs
        else
            # No tmux available, just show logs one at a time
            echo "Running without tmux - showing logs sequentially:"
            echo "Press Ctrl+C to view the next chain's logs"
            echo
            
            # Run each chain log viewer in sequence
            for chain in "distributor-chain" "retailer-chain" "main-chain"; do
                case $chain in
                    distributor-chain)
                        color="$GREEN"
                        ;;
                    retailer-chain)
                        color="$CYAN"
                        ;;
                    main-chain)
                        color="$MAGENTA"
                        ;;
                esac
                
                echo -e "${color}${BOLD}=== Viewing $chain logs ===${RESET}"
                show_chain_logs "$chain" "$color" "$lines" "$follow" "$search" "$errors_only" "$use_cli_history"
                # This will run until user presses Ctrl+C
                
                if [ "$chain" != "main-chain" ]; then
                    echo -e "${YELLOW}Press Enter to view next chain...${RESET}"
                    read
                fi
            done
        fi
    fi
}

main "$@"