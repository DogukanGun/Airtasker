from __future__ import annotations
from typing import Annotated, Any, Literal, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class ReviewerState(TypedDict):
    phase: Literal["fetching", "verifying_hash", "verifying_content", "signing", "emitting", "completed", "error"]
    task_id: int
    task_metadata: Optional[dict]
    submitted_result: Optional[dict]
    result_hash_onchain: Optional[str]
    result_content: Optional[str]
    hash_verified: Optional[bool]
    content_verdict: Optional[Literal["PASS", "FAIL", "PARTIAL"]]
    verdict_reason: Optional[str]
    payment_signature: Optional[dict]
    error_message: Optional[str]
    messages: Annotated[list[Any], add_messages]
