"""Tools for querying the on-chain task registry."""
from langchain_core.tools import tool
from ...shared.chain_client import ChainClient


_client: ChainClient | None = None

def get_chain_client() -> ChainClient:
    global _client
    if _client is None:
        _client = ChainClient()
    return _client


@tool
def get_open_tasks(category: str = "Research", offset: int = 0, limit: int = 10) -> list[dict]:
    """Fetch open tasks from the on-chain registry.

    Args:
        category: Task category (DataProcessing, WebScraping, CodeGeneration, Research, Translation, Other)
        offset: Pagination offset
        limit: Maximum number of tasks to return (max 20)

    Returns:
        List of open task dicts with taskId, bountyUSDC, deadline, minTrustScore, metadataURI
    """
    return get_chain_client().get_open_tasks(category=category, offset=offset, limit=min(limit, 20))


@tool
def get_task_details(task_id: int) -> dict | None:
    """Fetch full details of a specific task by ID.

    Args:
        task_id: The on-chain task ID

    Returns:
        Task dict or None if not found
    """
    return get_chain_client().get_task(task_id)
