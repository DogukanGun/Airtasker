"""Tests for the worker agent LangGraph state machine."""
import pytest


def test_worker_graph_builds():
    """Verify the worker graph compiles without errors."""
    from agents.worker.graph import build_worker_graph
    graph = build_worker_graph()
    assert graph is not None


def test_worker_graph_nodes():
    """Verify expected nodes are present."""
    from agents.worker.graph import build_worker_graph
    graph = build_worker_graph()
    node_names = set(graph.nodes.keys())
    expected = {
        "discover_tasks", "select_task", "create_bid", "poll_acceptance",
        "plan_execution", "execute_task", "tools", "prepare_result",
        "upload_to_ipfs", "sign_payment", "submit_result",
        "handle_rejection", "handle_error",
    }
    assert expected.issubset(node_names), f"Missing nodes: {expected - node_names}"


def test_worker_stub_run():
    """Run the worker graph in stub mode (no API keys required)."""
    from agents.worker.graph import worker_graph
    result = worker_graph.invoke({
        "phase":       "discovering",
        "task_id":     1,  # pre-set task ID to skip discovery
        "retry_count": 0,
        "messages":    [],
    })
    # Should reach completed or error without crashing
    assert result["phase"] in ("completed", "awaiting_review", "error", "waiting_acceptance", "rejected")
