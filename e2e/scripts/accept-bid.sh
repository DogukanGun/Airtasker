#!/usr/bin/env bash
# Accept a bid on behalf of the poster (deployer wallet).
# Usage: accept-bid.sh <task-id> <bid-id>
set -euo pipefail
source "$( dirname "$0" )/lib.sh"

TASK_ID="${1:?Usage: $0 <task-id> <bid-id>}"
BID_ID="${2:?Usage: $0 <task-id> <bid-id>}"

section "ACCEPT BID — task $TASK_ID, bid $BID_ID"
cast send "$REGISTRY" \
  "acceptBid(uint256,uint256)" "$TASK_ID" "$BID_ID" \
  --rpc-url "$RPC" \
  --private-key "$DEPLOYER_KEY" \
  --json | python3 -c "import sys, json; r=json.load(sys.stdin); print(f'tx: {r[\"transactionHash\"]}\\nblock: {r[\"blockNumber\"]}\\nstatus: {r[\"status\"]}')"
ok "Bid accepted — worker can now execute"
