"""Worker agent LangGraph StateGraph definition."""
from __future__ import annotations
from typing import Literal
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from .state import WorkerState
from .nodes.discover import discover_tasks, select_best_task
from .nodes.bid import create_bid, poll_acceptance
from .nodes.execute import execute_task, plan_execution, EXECUTION_TOOLS
from .nodes.submit import prepare_result, upload_to_ipfs, sign_payment, submit_result
from .nodes.handle_rejection import handle_rejection, handle_error


def _route_after_select(state: WorkerState) -> Literal["create_bid", "__end__"]:
    return "create_bid" if state.get("task_id") else END


def _route_after_poll(state: WorkerState) -> Literal["plan_execution", "handle_rejection", "poll_acceptance"]:
    phase = state.get("phase", "")
    if phase == "executing":
        return "plan_execution"
    elif phase == "rejected":
        return "handle_rejection"
    return "poll_acceptance"


def _route_after_execute(state: WorkerState) -> Literal["tools", "prepare_result", "handle_error"]:
    messages = state.get("messages", [])
    if not messages:
        return "handle_error"

    last = messages[-1]
    # If the last message has tool calls, route to ToolNode
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"

    phase = state.get("phase", "")
    if phase == "error":
        return "handle_error"
    if phase == "submitting" or state.get("result_content"):
        return "prepare_result"

    # Still executing
    return "tools"


def _route_after_submit(state: WorkerState) -> Literal["__end__", "handle_error"]:
    phase = state.get("phase", "")
    if phase == "error":
        return "handle_error"
    return END


def _route_after_rejection(state: WorkerState) -> Literal["discover_tasks", "__end__"]:
    return "discover_tasks" if state.get("retry_count", 0) < 3 else END


def build_worker_graph() -> StateGraph:
    graph = StateGraph(WorkerState)

    # Nodes
    graph.add_node("discover_tasks",  discover_tasks)
    graph.add_node("select_task",     select_best_task)
    graph.add_node("create_bid",      create_bid)
    graph.add_node("poll_acceptance", poll_acceptance)
    graph.add_node("plan_execution",  plan_execution)
    graph.add_node("execute_task",    execute_task)
    graph.add_node("tools",           ToolNode(EXECUTION_TOOLS))
    graph.add_node("prepare_result",  prepare_result)
    graph.add_node("upload_to_ipfs",  upload_to_ipfs)
    graph.add_node("sign_payment",    sign_payment)
    graph.add_node("submit_result",   submit_result)
    graph.add_node("handle_rejection",handle_rejection)
    graph.add_node("handle_error",    handle_error)

    # Entry point
    graph.set_entry_point("discover_tasks")

    # Edges
    graph.add_edge("discover_tasks", "select_task")
    graph.add_conditional_edges("select_task", _route_after_select,
                                 {"create_bid": "create_bid", END: END})
    graph.add_edge("create_bid", "poll_acceptance")
    graph.add_conditional_edges("poll_acceptance", _route_after_poll,
                                 {"plan_execution":  "plan_execution",
                                  "handle_rejection": "handle_rejection",
                                  "poll_acceptance":  "poll_acceptance"})
    graph.add_edge("plan_execution", "execute_task")
    graph.add_conditional_edges("execute_task", _route_after_execute,
                                 {"tools":          "tools",
                                  "prepare_result": "prepare_result",
                                  "handle_error":   "handle_error"})
    graph.add_edge("tools",          "execute_task")  # ReAct loop
    graph.add_edge("prepare_result", "upload_to_ipfs")
    graph.add_edge("upload_to_ipfs", "sign_payment")
    graph.add_edge("sign_payment",   "submit_result")
    graph.add_conditional_edges("submit_result", _route_after_submit,
                                 {END: END, "handle_error": "handle_error"})
    graph.add_conditional_edges("handle_rejection", _route_after_rejection,
                                 {"discover_tasks": "discover_tasks", END: END})
    graph.add_edge("handle_error", END)

    return graph.compile()


# Module-level compiled graph
worker_graph = build_worker_graph()
