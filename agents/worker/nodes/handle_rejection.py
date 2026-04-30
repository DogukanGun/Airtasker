"""handle_rejection and handle_error nodes."""
from langchain_core.messages import HumanMessage
from ..state import WorkerState


def handle_rejection(state: WorkerState) -> dict:
    retry = state.get("retry_count", 0)
    return {
        "phase":       "discovering",
        "task_id":     None,
        "bid_id":      None,
        "retry_count": retry + 1,
        "messages":    [HumanMessage(content=f"Bid rejected. Retry {retry + 1}/3 — searching for new task.")],
    }


def handle_error(state: WorkerState) -> dict:
    error = state.get("error_message", "Unknown error")
    return {
        "phase":   "error",
        "messages": [HumanMessage(content=f"Worker agent encountered an error: {error}")],
    }
