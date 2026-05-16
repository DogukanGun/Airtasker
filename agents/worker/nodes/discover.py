"""discover_tasks and select_best_task nodes."""
from __future__ import annotations
from langchain_core.messages import HumanMessage
from ..state import WorkerState
from ..tools.registry_tools import get_open_tasks


def discover_tasks(state: WorkerState) -> dict:
    """Fetch open tasks from the on-chain registry."""
    tasks = get_open_tasks.invoke({"category": "Research", "offset": 0, "limit": 10})
    if not tasks:
        return {
            "phase": "completed",
            "error_message": "No open tasks found",
            "messages": [HumanMessage(content="No open tasks available at this time.")],
        }
    return {
        "phase": "bidding",
        "messages": [HumanMessage(content=f"Found {len(tasks)} open tasks: {tasks}")],
        "_discovered_tasks": tasks,
    }


def select_best_task(state: WorkerState) -> dict:
    """Select the best task to bid on, using the dict list stashed by discover_tasks."""
    discovered = state.get("_discovered_tasks") or []
    requested_id = state.get("task_id")

    task = None
    if requested_id is not None:
        # Honor an explicit --task-id, regardless of category.
        for t in discovered:
            if t.get("taskId") == requested_id:
                task = t
                break
        # Fall back to fetching it directly from chain if not in the discovered batch.
        if task is None:
            from ...shared.chain_client import ChainClient
            task = ChainClient().get_task(requested_id)
    elif discovered:
        task = discovered[0]

    if not task:
        return {
            "phase":         "completed",
            "error_message": "Could not select a task",
            "task_id":       None,
        }

    task_id = task.get("taskId")
    return {
        "task_id":       task_id,
        "task_metadata": task,
        "bounty_usdc":   task.get("bountyUSDC"),
        "deadline":      task.get("deadline"),
        "task_category": task.get("category", "Research"),
        "phase":         "bidding",
        "messages":      [HumanMessage(content=f"Selected task {task_id} for bidding.")],
    }
