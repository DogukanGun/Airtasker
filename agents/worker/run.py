"""CLI runner for the worker agent.

Usage:
    python -m worker.run                          # auto-discover tasks
    python -m worker.run --task-id 42             # bid on a specific task
    python -m worker.run --task-id 42 --category Research
"""
import argparse
import json
from .graph import worker_graph


def main():
    parser = argparse.ArgumentParser(description="Airtasker Worker Agent")
    parser.add_argument("--task-id",  type=int, default=None, help="Specific task ID to bid on")
    parser.add_argument("--category", type=str, default="Research", help="Task category to search")
    parser.add_argument("--verbose",  action="store_true", help="Print full state at each step")
    args = parser.parse_args()

    initial_state = {
        "phase":       "discovering",
        "task_id":     args.task_id,
        "retry_count": 0,
        "messages":    [],
    }

    print(f"Starting worker agent (task_id={args.task_id or 'auto'}, category={args.category})...")

    for step in worker_graph.stream(initial_state):
        node_name = list(step.keys())[0]
        node_state = step[node_name]
        phase = node_state.get("phase", "?")
        print(f"  [{node_name}] phase={phase}")

        if args.verbose:
            # Print messages
            for msg in node_state.get("messages", []):
                content = getattr(msg, "content", str(msg))
                print(f"    > {content[:200]}")

        if phase in ("completed", "error"):
            if phase == "error":
                print(f"  Error: {node_state.get('error_message', 'Unknown')}")
            else:
                print(f"  Worker completed task {node_state.get('task_id', '?')} successfully.")
            break

    print("Worker agent finished.")


if __name__ == "__main__":
    main()
