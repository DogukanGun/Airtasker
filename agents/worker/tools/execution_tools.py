"""Tools available to the worker agent during task execution."""
import hashlib
import json
import subprocess
import sys
from langchain_core.tools import tool


@tool
def web_search(query: str) -> str:
    """Perform a web search. In production, wire to Tavily or SerpAPI.

    Args:
        query: Search query string

    Returns:
        Search results as formatted text
    """
    # Stub — replace with real search API integration
    return f"[STUB] Search results for: {query}\nNo real results (configure TAVILY_API_KEY for live search)"


@tool
def run_python_code(code: str) -> str:
    """Execute Python code in a sandboxed subprocess and return stdout/stderr.

    Args:
        code: Python code to execute (will be run in a subprocess)

    Returns:
        Combined stdout and stderr output, max 10,000 characters
    """
    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = result.stdout + result.stderr
        return output[:10_000] if output else "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: code execution timed out (30s limit)"
    except Exception as e:
        return f"Error: {e}"


@tool
def compute_content_hash(content: str) -> str:
    """Compute the keccak256 hash of a string for on-chain result verification.

    Args:
        content: The result content string to hash

    Returns:
        0x-prefixed keccak256 hex hash
    """
    from eth_hash.auto import keccak
    digest = keccak(content.encode("utf-8"))
    return "0x" + digest.hex()


@tool
def format_result_as_markdown(
    task_title: str,
    task_description: str,
    findings: list[str],
    conclusion: str,
) -> str:
    """Format task results as structured markdown for IPFS storage.

    Args:
        task_title: Original task title
        task_description: What was asked
        findings: List of key findings
        conclusion: Summary conclusion

    Returns:
        Formatted markdown string
    """
    lines = [
        f"# Task Result: {task_title}",
        "",
        "## Task Description",
        task_description,
        "",
        "## Findings",
    ]
    for i, f in enumerate(findings, 1):
        lines.append(f"{i}. {f}")
    lines += ["", "## Conclusion", conclusion]
    return "\n".join(lines)
