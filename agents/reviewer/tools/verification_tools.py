"""Tools for verifying task submissions."""
from langchain_core.tools import tool


@tool
def verify_content_against_spec(task_spec: str, result_content: str) -> dict:
    """Evaluate whether a task result satisfies the original specification.

    Args:
        task_spec:      The original task description/requirements
        result_content: The submitted result content

    Returns:
        Dict with 'verdict' (PASS/FAIL/PARTIAL), 'score' (0-100), and 'reasons' list
    """
    # Stub: basic length heuristic — replace with LLM call in production
    if not result_content or len(result_content.strip()) < 50:
        return {"verdict": "FAIL", "score": 0, "reasons": ["Result is too short or empty"]}
    if len(result_content) > 100:
        return {"verdict": "PASS", "score": 85, "reasons": ["Result appears substantive"]}
    return {"verdict": "PARTIAL", "score": 50, "reasons": ["Result is present but may be incomplete"]}


@tool
def verify_hash_integrity(content: str, expected_hash: str) -> bool:
    """Verify that a piece of content matches its keccak256 hash.

    Args:
        content:       The result content string
        expected_hash: The expected 0x-prefixed keccak256 hash

    Returns:
        True if the hash matches, False otherwise
    """
    from eth_hash.auto import keccak
    actual = "0x" + keccak(content.encode("utf-8")).hex()
    return actual.lower() == expected_hash.lower()
