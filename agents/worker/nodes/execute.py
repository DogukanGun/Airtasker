"""plan_execution and execute_task nodes (ReAct loop)."""
from __future__ import annotations
from typing import Any
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_anthropic import ChatAnthropic
from ..state import WorkerState
from ..tools.execution_tools import web_search, run_python_code, compute_content_hash, format_result_as_markdown
from ...shared.config import config

EXECUTION_TOOLS = [web_search, run_python_code, compute_content_hash, format_result_as_markdown]

SYSTEM_PROMPT = """You are a skilled AI agent worker in an autonomous task marketplace.
You have been assigned a task and must complete it thoroughly and accurately.
Use the available tools (web_search, run_python_code, format_result_as_markdown, compute_content_hash)
to research, compute, and format your results.
When you have a complete result, call format_result_as_markdown to structure it,
then compute_content_hash to get the verification hash.
Do NOT fabricate results — use tools to gather real information."""


def plan_execution(state: WorkerState) -> dict:
    """Create an execution plan for the task."""
    task = state.get("task_metadata") or {}
    task_id = state["task_id"]

    plan = [
        "1. Parse task requirements from metadata",
        "2. Gather relevant information using available tools",
        "3. Process and synthesize findings",
        "4. Format result as structured markdown",
        "5. Compute result hash for on-chain verification",
    ]

    return {
        "phase":          "executing",
        "execution_plan": plan,
        "messages":       [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=f"Task {task_id} description: {task.get('metadataURI', 'No metadata available')}. Execute the task."),
        ],
    }


def execute_task(state: WorkerState) -> dict:
    """ReAct execution node — calls LLM with tools, loops until result is ready."""
    if not config.ANTHROPIC_API_KEY:
        # Stub mode: generate a fake result for testing
        result = "# Stub Result\n\nThis is a stub result for testing. Configure ANTHROPIC_API_KEY for real execution."
        from eth_hash.auto import keccak
        result_hash = "0x" + keccak(result.encode()).hex()
        return {
            "phase":            "submitting",
            "result_content":   result,
            "result_hash":      result_hash,
            "execution_results": [{"stub": True, "content": result}],
            "messages":          [AIMessage(content=f"Task completed (stub mode). Hash: {result_hash}")],
        }

    llm = ChatAnthropic(
        model="claude-sonnet-4-6",
        api_key=config.ANTHROPIC_API_KEY,
    ).bind_tools(EXECUTION_TOOLS)

    messages = state.get("messages", [])
    response = llm.invoke(messages)

    # If response has tool calls, return them for the ToolNode to process
    if response.tool_calls:
        return {
            "messages": [response],
        }

    # No tool calls — LLM is done; extract result
    content = response.content if isinstance(response.content, str) else str(response.content)

    # Look for the hash in the message history
    result_hash = None
    for msg in reversed(messages + [response]):
        msg_content = getattr(msg, "content", "")
        if isinstance(msg_content, str) and msg_content.startswith("0x") and len(msg_content) == 66:
            result_hash = msg_content.strip()
            break

    if not result_hash:
        from eth_hash.auto import keccak
        result_hash = "0x" + keccak(content.encode()).hex()

    return {
        "phase":            "submitting",
        "result_content":   content,
        "result_hash":      result_hash,
        "execution_results": [{"content": content}],
        "messages":          [response],
    }
