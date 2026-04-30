"""
HTTP client that automatically handles the x402 payment flow:
  1. Make request → receive 402 with X-Payment-Required header
  2. Parse payment descriptor
  3. Sign EIP-3009 transferWithAuthorization
  4. Retry request with X-Payment header

Usage:
    client = X402Client(session_key_manager, task_id=42, api_base_url="http://localhost:3001")
    response = await client.post("/api/submissions/42", json={...})
"""
from __future__ import annotations
import base64
import json
import os
import time
from typing import Any

import httpx

from .bip32_session import SessionKeyManager
from .config import config


class X402Client:
    def __init__(
        self,
        session_key_manager: SessionKeyManager,
        task_id: int,
        api_base_url: str | None = None,
        jwt_token: str | None = None,
    ):
        self._skm = session_key_manager
        self._task_id = task_id
        self._base_url = api_base_url or config.API_BASE_URL
        self._jwt_token = jwt_token
        self._http = httpx.AsyncClient(base_url=self._base_url, timeout=30.0)

    def _auth_headers(self) -> dict:
        if self._jwt_token:
            return {"Authorization": f"Bearer {self._jwt_token}"}
        return {}

    def _build_payment_header(self, descriptor: dict) -> str:
        """Sign the payment descriptor and encode as base64 for the X-Payment header."""
        session_address = self._skm.get_session_address(self._task_id)
        now = int(time.time())
        nonce = os.urandom(32)

        auth = self._skm.sign_eip3009_authorization(
            task_id=self._task_id,
            from_address=session_address,
            to_address=descriptor["recipient"],
            value=int(descriptor["amount"]),
            valid_after=0,
            valid_before=now + 3600,
            nonce=nonce,
            chain_id=config.CHAIN_ID,
            usdc_address=descriptor["asset"],
        )

        payment_obj = {
            "version":     "1.0",
            "scheme":      "eip3009",
            "network":     descriptor.get("network", config.CHAIN_ID),
            "asset":       descriptor["asset"],
            "recipient":   descriptor["recipient"],
            "amount":      descriptor["amount"],
            **auth,
        }
        return base64.b64encode(json.dumps(payment_obj).encode()).decode()

    async def post(self, path: str, **kwargs: Any) -> httpx.Response:
        headers = {**self._auth_headers(), **kwargs.pop("headers", {})}

        # First attempt (no payment)
        response = await self._http.post(path, headers=headers, **kwargs)

        if response.status_code != 402:
            return response

        # Parse 402 descriptor
        body = response.json()
        descriptor = body.get("payment")
        if not descriptor:
            raw_header = response.headers.get("X-Payment-Required", "{}")
            descriptor = json.loads(raw_header)

        # Build and attach payment header
        payment_header = self._build_payment_header(descriptor)
        headers["X-Payment"] = payment_header

        # Retry with payment
        return await self._http.post(path, headers=headers, **kwargs)

    async def get(self, path: str, **kwargs: Any) -> httpx.Response:
        headers = {**self._auth_headers(), **kwargs.pop("headers", {})}
        return await self._http.get(path, headers=headers, **kwargs)

    async def close(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "X402Client":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()
