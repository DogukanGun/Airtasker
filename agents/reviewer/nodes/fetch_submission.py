"""Fetch task metadata and submission from API/IPFS."""
from __future__ import annotations
import httpx
from langchain_core.messages import HumanMessage
from ..state import ReviewerState
from ...shared.config import config


def fetch_submission(state: ReviewerState) -> dict:
    """Fetch task metadata and submitted result."""
    task_id = state["task_id"]

    # Fetch submission from API
    try:
        resp = httpx.get(f"{config.API_BASE_URL}/api/submissions/{task_id}", timeout=10)
        if resp.status_code != 200:
            return {
                "phase":         "error",
                "error_message": f"Submission not found (HTTP {resp.status_code})",
                "messages":      [HumanMessage(content=f"Could not fetch submission for task {task_id}")],
            }
        submission = resp.json()
    except Exception as e:
        # Stub for offline testing
        submission = {
            "taskId":        task_id,
            "worker":        "0x" + "bb" * 20,
            "resultSummary": "Stub submission for testing",
            "resultURI":     f"ipfs://Qmstub{task_id}",
            "resultHash":    "0x" + "cc" * 32,
        }

    # Fetch task metadata from API
    try:
        task_resp = httpx.get(f"{config.API_BASE_URL}/api/tasks/{task_id}", timeout=10)
        task_metadata = task_resp.json().get("task") if task_resp.status_code == 200 else {}
    except Exception:
        task_metadata = {}

    return {
        "phase":             "verifying_hash",
        "submitted_result":  submission,
        "task_metadata":     task_metadata,
        "result_hash_onchain": submission.get("resultHash"),
        "result_content":    submission.get("resultSummary", ""),
        "messages":          [HumanMessage(content=f"Fetched submission for task {task_id}: {submission.get('resultSummary', '')[:200]}")],
    }
