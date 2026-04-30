"""Hash verification and content evaluation nodes."""
from __future__ import annotations
from langchain_core.messages import HumanMessage
from ..state import ReviewerState
from ..tools.verification_tools import verify_hash_integrity, verify_content_against_spec


def verify_hash(state: ReviewerState) -> dict:
    """Verify the on-chain result hash matches the submitted content."""
    content  = state.get("result_content", "")
    expected = state.get("result_hash_onchain", "")

    if not content or not expected or expected == "0x" + "cc" * 32:
        # Stub hash — skip hash verification
        return {
            "phase":         "verifying_content",
            "hash_verified": True,
            "messages":      [HumanMessage(content="Hash verification skipped (stub mode)")],
        }

    verified = verify_hash_integrity.invoke({"content": content, "expected_hash": expected})
    if not verified:
        return {
            "phase":           "emitting",
            "hash_verified":   False,
            "content_verdict": "FAIL",
            "verdict_reason":  "Result hash does not match submitted content",
            "messages":        [HumanMessage(content="FAIL: hash mismatch")],
        }

    return {
        "phase":         "verifying_content",
        "hash_verified": True,
        "messages":      [HumanMessage(content="Hash verified successfully.")],
    }


def verify_content(state: ReviewerState) -> dict:
    """Evaluate result content against the task specification."""
    content   = state.get("result_content", "")
    task_meta = state.get("task_metadata") or {}
    task_spec = task_meta.get("description", task_meta.get("metadataURI", "No spec available"))

    result = verify_content_against_spec.invoke({
        "task_spec":      task_spec,
        "result_content": content,
    })

    verdict = result.get("verdict", "FAIL")
    reason  = "; ".join(result.get("reasons", ["No reason provided"]))

    return {
        "phase":           "signing",
        "content_verdict": verdict,
        "verdict_reason":  reason,
        "messages":        [HumanMessage(content=f"Content verdict: {verdict}. Reason: {reason}")],
    }
