"""CLI runner for the reviewer agent.

Usage:
    python -m reviewer.run --task-id 42
"""
import argparse
from .graph import reviewer_graph


def main():
    parser = argparse.ArgumentParser(description="Airtasker Reviewer Agent")
    parser.add_argument("--task-id", type=int, required=True, help="Task ID to review")
    parser.add_argument("--verbose", action="store_true", help="Print full state at each step")
    args = parser.parse_args()

    initial_state = {
        "phase":   "fetching",
        "task_id": args.task_id,
        "messages": [],
    }

    print(f"Starting reviewer agent for task {args.task_id}...")

    for step in reviewer_graph.stream(initial_state):
        node_name = list(step.keys())[0]
        node_state = step[node_name]
        phase = node_state.get("phase", "?")
        print(f"  [{node_name}] phase={phase}")

        if args.verbose:
            for msg in node_state.get("messages", []):
                content = getattr(msg, "content", str(msg))
                print(f"    > {content[:200]}")

    verdict = initial_state.get("content_verdict", "?")
    print(f"Reviewer agent finished. Verdict: {verdict}")


if __name__ == "__main__":
    main()
