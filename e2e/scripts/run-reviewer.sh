#!/usr/bin/env bash
# Run the reviewer agent against a given task id.
# Usage: run-reviewer.sh <task-id>
set -euo pipefail
source "$( dirname "$0" )/lib.sh"

TASK_ID="${1:?Usage: $0 <task-id>}"

section "REVIEWER AGENT — task $TASK_ID"
info "Fetching submitted result → verifying hash → posting verdict"
echo

cd "$ROOT"
"$AGENTS_VENV" -m agents.reviewer.run --task-id "$TASK_ID" --verbose
