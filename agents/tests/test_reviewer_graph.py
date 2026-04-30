"""Tests for the reviewer agent LangGraph state machine."""
import pytest


def test_reviewer_graph_builds():
    """Verify the reviewer graph compiles without errors."""
    from agents.reviewer.graph import build_reviewer_graph
    graph = build_reviewer_graph()
    assert graph is not None


def test_reviewer_graph_nodes():
    """Verify expected nodes are present."""
    from agents.reviewer.graph import build_reviewer_graph
    graph = build_reviewer_graph()
    node_names = set(graph.nodes.keys())
    expected = {"fetch_submission", "verify_hash", "verify_content", "sign_review_payment", "emit_verdict"}
    assert expected.issubset(node_names)


def test_reviewer_stub_run():
    """Run the reviewer in stub mode."""
    from agents.reviewer.graph import reviewer_graph
    result = reviewer_graph.invoke({
        "phase":   "fetching",
        "task_id": 1,
        "messages": [],
    })
    assert result["phase"] in ("completed", "error")
    assert result.get("content_verdict") in ("PASS", "FAIL", "PARTIAL", None)
