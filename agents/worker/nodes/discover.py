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
    """Select the best task to bid on based on bounty and trust score requirements."""
    messages = state.get("messages", [])

    # Find tasks from the most recent discovery message
    discovered = []
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if "open tasks" in content:
            # Simple stub: parse the tasks from the last discovery
            # In production, the LLM would reason about which task to pick
            break

    # If we have a task_id set already, use it; otherwise pick the first discovered task
    task_id = state.get("task_id")

    if not task_id:
        # Fallback: extract task_id from last discovered tasks message
        import ast, re
        for msg in reversed(messages):
            content = getattr(msg, "content", "")
            match = re.search(r"'taskId': (\d+)", content)
            if match:
                task_id = int(match.group(1))
                break

    if not task_id:
        return {
            "phase": "completed",
            "error_message": "Could not select a task",
            "task_id": None,
        }

    task = None
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if f"'taskId': {task_id}" in content:
            import ast
            try:
                # Find the task dict in the message
                start = content.find("{")
                task = ast.literal_eval(content[start:content.rfind("}") + 1])
            except Exception:
                pass
            break

    return {
        "task_id":        task_id,
        "task_metadata":  task,
        "bounty_usdc":    task.get("bountyUSDC") if task else None,
        "deadline":       task.get("deadline") if task else None,
        "task_category":  task.get("category", "Research") if task else "Research",
        "phase":          "bidding",
        "messages":       [HumanMessage(content=f"Selected task {task_id} for bidding.")],
    }
