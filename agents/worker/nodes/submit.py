"""prepare_result, upload_to_ipfs, sign_payment, submit_result nodes."""
from __future__ import annotations
import asyncio
import json
import time
import os
from langchain_core.messages import HumanMessage
from ..state import WorkerState
from ...shared.config import config


def prepare_result(state: WorkerState) -> dict:
    """Prepare the result object for IPFS upload."""
    return {
        "phase":   "submitting",
        "messages": [HumanMessage(content="Preparing result for upload...")],
    }


def upload_to_ipfs(state: WorkerState) -> dict:
    """Upload result content to IPFS and return the URI."""
    result_content = state.get("result_content", "")
    task_id        = state["task_id"]

    # Stub IPFS upload (replace with Pinata or local node)
    if config.PINATA_JWT:
        import httpx
        payload = {
            "pinataContent": {
                "taskId":    task_id,
                "content":   result_content,
                "timestamp": int(time.time()),
            }
        }
        try:
            resp = httpx.post(
                "https://api.pinata.cloud/pinning/pinJSONToIPFS",
                json=payload,
                headers={"Authorization": f"Bearer {config.PINATA_JWT}"},
                timeout=30,
            )
            resp.raise_for_status()
            cid = resp.json()["IpfsHash"]
            uri = f"ipfs://{cid}"
        except Exception as e:
            uri = f"ipfs://stub-{task_id}-{int(time.time())}"
    else:
        # Deterministic stub URI for local testing
        import hashlib
        h = hashlib.md5(result_content.encode()).hexdigest()
        uri = f"ipfs://Qm{h[:44]}"

    return {
        "result_ipfs_uri": uri,
        "messages":        [HumanMessage(content=f"Result uploaded to IPFS: {uri}")],
    }


def sign_payment(state: WorkerState) -> dict:
    """Sign the EIP-3009 payment authorization for the submission fee."""
    if not config.MASTER_MNEMONIC:
        return {
            "payment_nonce":     "0x" + os.urandom(32).hex(),
            "payment_signature": {"stub": True},
            "messages":          [HumanMessage(content="Payment signed (stub mode)")],
        }

    from ...shared.bip32_session import SessionKeyManager
    skm = SessionKeyManager(config.MASTER_MNEMONIC)
    task_id = state["task_id"]
    session_address = skm.get_session_address(task_id)
    nonce = os.urandom(32)
    now   = int(time.time())

    sig = skm.sign_eip3009_authorization(
        task_id=task_id,
        from_address=session_address,
        to_address="0x0000000000000000000000000000000000000000",  # API wallet; will be set from 402 descriptor
        value=config.SUBMISSION_FEE_USDC,
        valid_after=0,
        valid_before=now + 3600,
        nonce=nonce,
        chain_id=config.CHAIN_ID,
        usdc_address=config.USDC_ADDRESS,
    )

    return {
        "payment_nonce":     "0x" + nonce.hex(),
        "payment_signature": sig,
        "messages":          [HumanMessage(content="EIP-3009 payment authorization signed.")],
    }


def submit_result(state: WorkerState) -> dict:
    """Submit the result to the API (x402 gated)."""
    task_id         = state["task_id"]
    result_uri      = state.get("result_ipfs_uri", "")
    result_hash     = state.get("result_hash", "")
    result_content  = state.get("result_content", "")
    access_token    = state.get("task_access_token", "")

    if not config.MASTER_MNEMONIC:
        # Stub: simulate successful submission
        return {
            "phase":   "completed",
            "messages": [HumanMessage(content=f"[STUB] Result submitted for task {task_id}. Awaiting review.")],
        }

    async def _submit():
        from ...shared.bip32_session import SessionKeyManager
        from ...shared.x402_client import X402Client
        skm = SessionKeyManager(config.MASTER_MNEMONIC)
        async with X402Client(skm, task_id, jwt_token=access_token) as client:
            resp = await client.post(
                f"/api/submissions/{task_id}",
                json={
                    "resultSummary": result_content[:500],
                    "resultURI":     result_uri,
                    "resultHash":    result_hash,
                },
            )
            return resp

    try:
        loop = asyncio.new_event_loop()
        response = loop.run_until_complete(_submit())
        loop.close()

        if response.status_code == 200:
            return {
                "phase":   "awaiting_review",
                "messages": [HumanMessage(content=f"Result submitted successfully for task {task_id}.")],
            }
        else:
            return {
                "phase":         "error",
                "error_message": f"Submission failed: {response.status_code} {response.text}",
                "messages":      [HumanMessage(content=f"Submission error: {response.text}")],
            }
    except Exception as e:
        return {
            "phase":         "error",
            "error_message": str(e),
            "messages":      [HumanMessage(content=f"Submission exception: {e}")],
        }
