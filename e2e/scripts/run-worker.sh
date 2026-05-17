#!/usr/bin/env bash
# Run the worker agent against a given task id, with pretty output.
# Usage: run-worker.sh <task-id>
set -euo pipefail
source "$( dirname "$0" )/lib.sh"

TASK_ID="${1:?Usage: $0 <task-id>}"

section "WORKER AGENT — task $TASK_ID"
info "Discovering on-chain → deriving BIP-32 session key → bidding"
echo

cd "$ROOT"
"$AGENTS_VENV" -m agents.worker.run --task-id "$TASK_ID" --verbose
