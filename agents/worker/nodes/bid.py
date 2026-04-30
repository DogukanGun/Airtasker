"""create_bid and poll_acceptance nodes."""
from __future__ import annotations
import asyncio
import time
from langchain_core.messages import HumanMessage, AIMessage
from ..state import WorkerState
from ...shared.bip32_session import SessionKeyManager
from ...shared.config import config


def create_bid(state: WorkerState) -> dict:
    """Create a bid for the selected task using a BIP-32 session key."""
    task_id = state["task_id"]
    bounty  = state.get("bounty_usdc") or 0

    if not task_id:
        return {"phase": "error", "error_message": "No task selected"}

    if not config.MASTER_MNEMONIC:
        # Stub mode for testing
        return {
            "phase":               "waiting_acceptance",
            "session_key_address": "0x" + "aa" * 20,
            "proposed_fee":        bounty,
            "bid_id":              None,
            "messages":            [HumanMessage(content=f"[STUB] Bid created for task {task_id}")],
        }

    skm = SessionKeyManager(config.MASTER_MNEMONIC)
    session_address = skm.get_session_address(task_id)
    bid_proof       = skm.sign_bid_proof(task_id)
    proposed_fee    = int(bounty * 0.9) if bounty else 0  # bid 90% of bounty

    return {
        "phase":               "waiting_acceptance",
        "session_key_address": session_address,
        "proposed_fee":        proposed_fee,
        "bid_id":              None,
        "messages":            [
            HumanMessage(content=(
                f"Bid created for task {task_id}. "
                f"Session key: {session_address}. "
                f"Proposed fee: {proposed_fee} USDC atomic units."
            ))
        ],
    }


def poll_acceptance(state: WorkerState) -> dict:
    """Poll for bid acceptance. In production, watch BidAccepted events."""
    task_id = state["task_id"]

    # Stub: simulate checking acceptance status via API
    # In production, use chain_client to watch BidAccepted events with filters
    accepted = False
    attempts = state.get("retry_count", 0)

    # After max attempts, treat as rejected
    if attempts >= 5:
        return {
            "phase":       "rejected",
            "retry_count": attempts + 1,
            "messages":    [HumanMessage(content=f"Bid not accepted after {attempts} polls. Moving on.")],
        }

    # Stub: randomly accept for demo purposes (replace with actual on-chain check)
    import random
    accepted = random.random() > 0.3  # 70% acceptance rate in stub

    if accepted:
        return {
            "phase":            "executing",
            "task_access_token": f"stub-jwt-task-{task_id}",
            "retry_count":       0,
            "messages":          [HumanMessage(content=f"Bid accepted for task {task_id}! Starting execution.")],
        }

    return {
        "phase":       "waiting_acceptance",
        "retry_count": attempts + 1,
        "messages":    [HumanMessage(content=f"Waiting for bid acceptance... (attempt {attempts + 1})")],
    }
