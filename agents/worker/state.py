from __future__ import annotations
from typing import Annotated, Any, Literal, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class WorkerState(TypedDict):
    # Execution phase
    phase: Literal[
        "discovering", "bidding", "waiting_acceptance",
        "executing", "submitting", "awaiting_review",
        "completed", "rejected", "error",
    ]

    # Task context
    task_id: Optional[int]
    task_metadata: Optional[dict]
    task_category: Optional[str]
    bounty_usdc: Optional[int]
    deadline: Optional[int]

    # Bid context
    bid_id: Optional[int]
    proposed_fee: Optional[int]
    session_key_address: Optional[str]
    task_access_token: Optional[str]

    # Execution context
    execution_plan: Optional[list[str]]
    execution_results: Optional[list[dict]]
    result_content: Optional[str]
    result_hash: Optional[str]
    result_ipfs_uri: Optional[str]

    # Payment context
    payment_nonce: Optional[str]
    payment_signature: Optional[dict]

    # Meta
    retry_count: int
    error_message: Optional[str]
    messages: Annotated[list[Any], add_messages]
