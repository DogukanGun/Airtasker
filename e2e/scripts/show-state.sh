#!/usr/bin/env bash
# Display the final state proving settlement happened.
# Usage: show-state.sh <task-id>
set -euo pipefail
source "$( dirname "$0" )/lib.sh"

TASK_ID="${1:?Usage: $0 <task-id>}"

section "PROOF OF SETTLEMENT — task $TASK_ID"
echo

printf "${BOLD}Trust score of deployer (worker):${RESET}\n  "
cast call "$PASSPORT" "getScore(address)(uint256)" "$DEPLOYER_ADDR" --rpc-url "$RPC"
info "(starts at 100 after registration, +50 per completion)"

echo
printf "${BOLD}Task $TASK_ID status:${RESET}\n  "
RAW=$(cast call "$REGISTRY" "getTask(uint256)" "$TASK_ID" --rpc-url "$RPC")
echo "$RAW" | awk 'NR==6 {print "status enum:", $1, "(3=Completed)"}'

echo
printf "${BOLD}Deployer MockUSDC balance:${RESET}\n  "
cast call "$USDC" "balanceOf(address)(uint256)" "$DEPLOYER_ADDR" --rpc-url "$RPC"

echo
printf "${BOLD}Explorer:${RESET}\n  ${EXPLORER}/address/${REGISTRY}\n"
