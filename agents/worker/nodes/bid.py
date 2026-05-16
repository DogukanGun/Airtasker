"""create_bid and poll_acceptance nodes."""
from __future__ import annotations
import asyncio
import time
from eth_account import Account
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

    # Submit the bid on chain (sent from the deployer wallet, since the session
    # key has no native gas token — proof of session-key ownership is included
    # in the sessionKeyProof field).
    from ...shared.chain_client import ChainClient
    cc = ChainClient()
    if not cc.signer:
        return {"phase": "error", "error_message": "API_WALLET_PRIVATE_KEY not configured for chain signer"}

    try:
        tx_hash = cc.submit_bid(
            task_id=task_id,
            proposed_fee=proposed_fee,
            pitch_uri=f"ipfs://bid-{task_id}-{session_address[:10]}",
            proof_hex=bid_proof,
        )
        # Look up the bidId we just got (latest bid for this task by this signer).
        bids = cc.get_task_bids(task_id)
        my_bid = next(
            (b for b in reversed(bids) if b["worker"].lower() == cc.signer_address.lower()),
            None,
        )
        bid_id = my_bid["bidId"] if my_bid else None
    except Exception as e:
        return {"phase": "error", "error_message": f"submitBid reverted: {e}"}

    return {
        "phase":               "waiting_acceptance",
        "session_key_address": session_address,
        "proposed_fee":        proposed_fee,
        "bid_id":              bid_id,
        "messages":            [
            HumanMessage(content=(
                f"Bid submitted on-chain for task {task_id}. "
                f"tx={tx_hash} bidId={bid_id} "
                f"sessionKey={session_address} fee={proposed_fee}"
            ))
        ],
    }


def poll_acceptance(state: WorkerState) -> dict:
    """Poll the chain until the bid is accepted. Sleeps between polls so the
    poster (or `cast send acceptBid`) has time to act."""
    task_id  = state["task_id"]
    bid_id   = state.get("bid_id")
    attempts = state.get("retry_count", 0)

    # Generous timeout — bidder is waiting on a human/script to call acceptBid.
    MAX_ATTEMPTS  = 60
    POLL_INTERVAL = 5

    if attempts >= MAX_ATTEMPTS:
        return {
            "phase":       "rejected",
            "retry_count": attempts + 1,
            "messages":    [HumanMessage(content=f"Bid not accepted after {attempts} polls. Moving on.")],
        }

    from ...shared.chain_client import ChainClient
    cc = ChainClient()
    accepted = False
    if bid_id is not None:
        for b in cc.get_task_bids(task_id):
            if b["bidId"] == bid_id:
                accepted = bool(b["accepted"])
                break

    if not accepted:
        time.sleep(POLL_INTERVAL)

    if accepted:
        # Exchange a real JWT — auth as the deployer wallet (the actual bid worker on chain).
        token = ""
        try:
            from ...shared.siwe_auth import authenticate_session_key
            signer = Account.from_key(config.API_WALLET_PRIVATE_KEY)
            token = authenticate_session_key(signer)
        except Exception as e:
            return {
                "phase":             "error",
                "error_message":     f"SIWE auth failed: {e}",
                "task_access_token": "",
                "messages":          [HumanMessage(content=f"Auth failed for task {task_id}: {e}")],
            }

        return {
            "phase":             "executing",
            "task_access_token": token,
            "retry_count":       0,
            "messages":          [HumanMessage(content=f"Bid accepted for task {task_id}! Starting execution.")],
        }

    return {
        "phase":       "waiting_acceptance",
        "retry_count": attempts + 1,
        "messages":    [HumanMessage(content=f"Waiting for bid acceptance... (attempt {attempts + 1})")],
    }
