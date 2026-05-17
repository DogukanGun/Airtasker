#!/usr/bin/env bash
# Guided demo pilot — orchestrates the agent terminals around your manual UI clicks.
# Run this in your "main" terminal. It will:
#   1. Wait for you to post a task via the UI
#   2. Spawn the worker in a second Terminal window
#   3. Watch the chain for the bid → accept it
#   4. Wait for worker to submit
#   5. Spawn the reviewer in a third Terminal window
#   6. Wait for settlement → show proof
#
# Designed for macOS (uses osascript). Record the full screen with QuickTime.

set -euo pipefail
source "$( dirname "$0" )/lib.sh"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# ─── Pre-flight ─────────────────────────────────────────────────────
section "PRE-FLIGHT"

if ! curl -s -o /dev/null http://localhost:3001/health; then
  warn "API not running on :3001 — start it: (cd api && npm run dev)"
  exit 1
fi
ok "API :3001"

if ! curl -s -o /dev/null http://localhost:3000; then
  warn "Frontend not running on :3000 — start it: (cd frontend && npm run dev)"
  exit 1
fi
ok "Frontend :3000"

if [ ! -x "$AGENTS_VENV" ]; then
  warn "Agent venv missing: $AGENTS_VENV"
  exit 1
fi
ok "Agent venv"

NEXT_ID_BEFORE=$(cast call "$REGISTRY" "nextTaskId()(uint256)" --rpc-url "$RPC" | head -1)
ok "Chain reachable — nextTaskId currently $NEXT_ID_BEFORE"

# ─── Step 1: User posts a task via the UI ──────────────────────────
section "STEP 1 — POST A TASK FROM THE UI"
echo "Open http://localhost:3000 → Connect Wallet → Post Task."
echo "IMPORTANT: set Min Trust Score = 0, deadline 7 days, small bounty."
echo
pause "Press Enter ONCE the task is posted and visible in the marketplace"

NEXT_ID_AFTER=$(cast call "$REGISTRY" "nextTaskId()(uint256)" --rpc-url "$RPC" | head -1)
if [ "$NEXT_ID_AFTER" -le "$NEXT_ID_BEFORE" ]; then
  warn "No new task detected on chain (nextTaskId still $NEXT_ID_AFTER). Aborting."
  exit 1
fi
TASK_ID=$((NEXT_ID_AFTER - 1))
ok "New task detected — task #$TASK_ID"

# ─── Step 2: Spawn worker in a new Terminal window ─────────────────
section "STEP 2 — WORKER AGENT (new Terminal window)"
info "Opening a new Terminal window for the worker agent..."

osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$ROOT' && bash '$SCRIPT_DIR/run-worker.sh' $TASK_ID"
end tell
EOF
ok "Worker terminal launched"

# ─── Step 3: Watch chain for the bid, then accept ──────────────────
section "STEP 3 — WAIT FOR WORKER'S BID"
info "Polling getTaskBids($TASK_ID) every 4s..."

WAIT_FOR_BID_TIMEOUT=180
ELAPSED=0
BID_DETECTED=0
while [ $ELAPSED -lt $WAIT_FOR_BID_TIMEOUT ]; do
  BIDS=$(cast call "$REGISTRY" "getTaskBids(uint256)((uint256,uint256,address,uint256,string,bytes,uint256,bool)[])" "$TASK_ID" --rpc-url "$RPC" 2>/dev/null || echo "[]")
  if [ "$BIDS" != "[]" ] && [ -n "$BIDS" ]; then
    BID_DETECTED=1
    break
  fi
  sleep 4
  ELAPSED=$((ELAPSED + 4))
  printf "."
done
echo

if [ $BID_DETECTED -eq 0 ]; then
  warn "No bid after ${WAIT_FOR_BID_TIMEOUT}s. Check the worker terminal for errors."
  exit 1
fi
ok "Bid detected on chain"

pause "Press Enter to accept the bid (worker resumes after this)"

bash "$SCRIPT_DIR/accept-bid.sh" "$TASK_ID" 1

# ─── Step 4: Wait for worker to submit (task → UnderReview) ────────
section "STEP 4 — WAIT FOR WORKER TO SUBMIT"
info "Polling task status. UnderReview = enum 2"

WAIT_FOR_SUBMIT_TIMEOUT=240
ELAPSED=0
SUBMITTED=0
while [ $ELAPSED -lt $WAIT_FOR_SUBMIT_TIMEOUT ]; do
  STATUS=$(cast call "$REGISTRY" "getTask(uint256)" "$TASK_ID" --rpc-url "$RPC" 2>/dev/null | awk 'NR==6 {print $1}')
  if [ "$STATUS" = "2" ] || [ "$STATUS" = "3" ]; then
    SUBMITTED=1
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  printf "."
done
echo

if [ $SUBMITTED -eq 0 ]; then
  warn "Worker didn't submit within ${WAIT_FOR_SUBMIT_TIMEOUT}s. Check worker terminal."
  exit 1
fi
ok "Worker submitted — task status: UnderReview"

# ─── Step 5: Spawn reviewer in a new Terminal window ───────────────
section "STEP 5 — REVIEWER AGENT (new Terminal window)"
info "Opening a new Terminal window for the reviewer agent..."

osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$ROOT' && bash '$SCRIPT_DIR/run-reviewer.sh' $TASK_ID"
end tell
EOF
ok "Reviewer terminal launched"

# ─── Step 6: Wait for settlement (task → Completed) ────────────────
section "STEP 6 — WAIT FOR SETTLEMENT"
info "Polling task status. Completed = enum 3"

WAIT_FOR_SETTLE_TIMEOUT=180
ELAPSED=0
SETTLED=0
while [ $ELAPSED -lt $WAIT_FOR_SETTLE_TIMEOUT ]; do
  STATUS=$(cast call "$REGISTRY" "getTask(uint256)" "$TASK_ID" --rpc-url "$RPC" 2>/dev/null | awk 'NR==6 {print $1}')
  if [ "$STATUS" = "3" ]; then
    SETTLED=1
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  printf "."
done
echo

if [ $SETTLED -eq 0 ]; then
  warn "Settlement didn't happen within ${WAIT_FOR_SETTLE_TIMEOUT}s."
  warn "Check reviewer terminal and API logs."
  exit 1
fi

# ─── Step 7: Show proof ────────────────────────────────────────────
bash "$SCRIPT_DIR/show-state.sh" "$TASK_ID"

section "🎬 DEMO COMPLETE"
echo "Recording done — stop QuickTime and review the .mov."
