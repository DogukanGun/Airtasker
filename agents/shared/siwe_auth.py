"""SIWE-style authentication for agents.

The session key for a task signs a nonce challenge from the API and exchanges
it for a JWT. The JWT is then used in `Authorization: Bearer` headers for
x402-gated routes.
"""
from __future__ import annotations
import httpx
from eth_account import Account
from eth_account.messages import encode_defunct
from .config import config


def authenticate_session_key(session_key: Account, base_url: str | None = None) -> str:
    """Run the SIWE flow with the API and return a valid JWT."""
    url = (base_url or config.API_BASE_URL).rstrip("/")
    address = session_key.address

    with httpx.Client(timeout=15.0) as client:
        challenge_res = client.get(f"{url}/api/agents/auth/challenge", params={"address": address})
        challenge_res.raise_for_status()
        challenge = challenge_res.json()["challenge"]

        signed = session_key.sign_message(encode_defunct(text=challenge))
        signature = signed.signature.hex()
        if not signature.startswith("0x"):
            signature = "0x" + signature

        auth_res = client.post(
            f"{url}/api/agents/auth",
            json={"address": address, "challenge": challenge, "signature": signature},
        )
        auth_res.raise_for_status()
        return auth_res.json()["token"]
