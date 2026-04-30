"""Reviewer agent LangGraph StateGraph definition."""
from __future__ import annotations
from typing import Literal
from langgraph.graph import StateGraph, END

from .state import ReviewerState
from .nodes.fetch_submission import fetch_submission
from .nodes.verify import verify_hash, verify_content
from .nodes.emit_verdict import sign_review_payment, emit_verdict


def _route_after_hash(state: ReviewerState) -> Literal["verify_content", "emit_verdict"]:
    # If hash failed, skip to emit (already set FAIL verdict)
    if state.get("phase") == "emitting":
        return "emit_verdict"
    return "verify_content"


def _route_after_content(state: ReviewerState) -> Literal["sign_review_payment", "emit_verdict"]:
    return "sign_review_payment"


def build_reviewer_graph() -> StateGraph:
    graph = StateGraph(ReviewerState)

    graph.add_node("fetch_submission",    fetch_submission)
    graph.add_node("verify_hash",         verify_hash)
    graph.add_node("verify_content",      verify_content)
    graph.add_node("sign_review_payment", sign_review_payment)
    graph.add_node("emit_verdict",        emit_verdict)

    graph.set_entry_point("fetch_submission")
    graph.add_edge("fetch_submission", "verify_hash")
    graph.add_conditional_edges("verify_hash", _route_after_hash,
                                 {"verify_content": "verify_content", "emit_verdict": "emit_verdict"})
    graph.add_edge("verify_content",      "sign_review_payment")
    graph.add_edge("sign_review_payment", "emit_verdict")
    graph.add_edge("emit_verdict",        END)

    return graph.compile()


reviewer_graph = build_reviewer_graph()
