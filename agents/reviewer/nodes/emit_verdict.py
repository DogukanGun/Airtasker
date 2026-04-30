"""sign_review_payment and emit_verdict nodes."""
from __future__ import annotations
import time
import os
import asyncio
from langchain_core.messages import HumanMessage
from ..state import ReviewerState
from ...shared.config import config


def sign_review_payment(state: ReviewerState) -> dict:
    """Sign the EIP-3009 micro-fee payment for the review submission."""
    if not config.MASTER_MNEMONIC:
        return {
            "phase":             "emitting",
            "payment_signature": {"stub": True},
            "messages":          [HumanMessage(content="Review payment signed (stub mode)")],
        }

    from ...shared.bip32_session import SessionKeyManager
    skm = SessionKeyManager(config.MASTER_MNEMONIC)
    task_id = state["task_id"]
    # Reviewers use a special derivation index offset to avoid collision with worker keys
    reviewer_task_id = task_id + 1_000_000
    session_address  = skm.get_session_address(reviewer_task_id)
    nonce = os.urandom(32)
    now   = int(time.time())

    sig = skm.sign_eip3009_authorization(
        task_id=reviewer_task_id,
        from_address=session_address,
        to_address="0x0000000000000000000000000000000000000000",
        value=config.REVIEW_FEE_USDC,
        valid_after=0,
        valid_before=now + 3600,
        nonce=nonce,
        chain_id=config.CHAIN_ID,
        usdc_address=config.USDC_ADDRESS,
    )

    return {
        "phase":             "emitting",
        "payment_signature": sig,
        "messages":          [HumanMessage(content="Review micro-fee payment signed.")],
    }


def emit_verdict(state: ReviewerState) -> dict:
    """Submit the review verdict to the API (x402 gated)."""
    task_id  = state["task_id"]
    verdict  = state.get("content_verdict", "FAIL")
    reason   = state.get("verdict_reason", "")

    if not state.get("hash_verified", True):
        verdict = "FAIL"
        reason  = "Hash verification failed"

    if not config.MASTER_MNEMONIC:
        return {
            "phase":   "completed",
            "messages": [HumanMessage(content=f"[STUB] Verdict {verdict} submitted for task {task_id}.")],
        }

    async def _submit():
        from ...shared.bip32_session import SessionKeyManager
        from ...shared.x402_client import X402Client
        skm = SessionKeyManager(config.MASTER_MNEMONIC)
        reviewer_task_id = task_id + 1_000_000
        async with X402Client(skm, reviewer_task_id) as client:
            resp = await client.post(
                f"/api/reviews/{task_id}",
                json={"verdict": verdict, "reason": reason},
            )
            return resp

    try:
        loop = asyncio.new_event_loop()
        response = loop.run_until_complete(_submit())
        loop.close()

        if response.status_code == 200:
            return {
                "phase":   "completed",
                "messages": [HumanMessage(content=f"Verdict '{verdict}' submitted for task {task_id}.")],
            }
        else:
            return {
                "phase":         "error",
                "error_message": f"Verdict submission failed: {response.status_code}",
                "messages":      [HumanMessage(content=f"Verdict error: {response.text}")],
            }
    except Exception as e:
        return {
            "phase":         "error",
            "error_message": str(e),
            "messages":      [HumanMessage(content=f"Verdict exception: {e}")],
        }
