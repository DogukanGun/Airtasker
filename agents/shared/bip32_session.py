"""
BIP-32 hierarchical session key management.
Derives a unique ephemeral key per task so a compromised agent key
cannot access funds or sign for other tasks.

Derivation path: m/44'/60'/0'/{task_id}'/0
"""
from __future__ import annotations
import hashlib
from eth_account import Account
from eth_account.messages import encode_defunct

Account.enable_unaudited_hdwallet_features()

DERIVATION_TEMPLATE = "m/44'/60'/0'/{task_id}'/0"
SESSION_KEY_PREFIX = "AIRTASKER_SESSION"


class SessionKeyManager:
    """Manages ephemeral BIP-32 session keys derived from a master mnemonic."""

    def __init__(self, master_mnemonic: str):
        self._mnemonic = master_mnemonic
        self._master = Account.from_mnemonic(master_mnemonic)

    @property
    def master_address(self) -> str:
        return self._master.address

    def derive_session_key(self, task_id: int) -> Account:
        """Derive the session key for a given task. Returns an eth_account Account."""
        path = DERIVATION_TEMPLATE.format(task_id=task_id)
        return Account.from_mnemonic(self._mnemonic, account_path=path)

    def get_session_address(self, task_id: int) -> str:
        """Return only the session key address (public info)."""
        return self.derive_session_key(task_id).address

    def _session_key_message(self, task_id: int, session_address: str) -> str:
        return f"{SESSION_KEY_PREFIX}:{task_id}:{session_address}"

    def sign_bid_proof(self, task_id: int) -> str:
        """
        Master key signs the session key address as ownership proof.
        Returned value is the hex signature string submitted as sessionKeyProof.
        """
        session_address = self.get_session_address(task_id)
        msg = encode_defunct(text=self._session_key_message(task_id, session_address))
        signed = self._master.sign_message(msg)
        return signed.signature.hex()

    @staticmethod
    def verify_session_key_proof(
        task_id: int,
        session_address: str,
        master_address: str,
        signature_hex: str,
    ) -> bool:
        """Verify that master_address signed the session key for task_id."""
        try:
            from eth_account.messages import encode_defunct
            from eth_account import Account
            msg = encode_defunct(text=f"{SESSION_KEY_PREFIX}:{task_id}:{session_address}")
            recovered = Account.recover_message(msg, signature=bytes.fromhex(signature_hex.lstrip("0x")))
            return recovered.lower() == master_address.lower()
        except Exception:
            return False

    def sign_eip3009_authorization(
        self,
        task_id: int,
        from_address: str,
        to_address: str,
        value: int,
        valid_after: int,
        valid_before: int,
        nonce: bytes,
        chain_id: int,
        usdc_address: str,
    ) -> dict:
        """
        Sign an EIP-3009 TransferWithAuthorization using the task's session key.
        The 'from' address must match the session key address.
        """
        session_key = self.derive_session_key(task_id)

        # EIP-712 domain
        domain = {
            "name":              "USD Coin",
            "version":           "2",
            "chainId":           chain_id,
            "verifyingContract": usdc_address,
        }
        message_types = {
            "TransferWithAuthorization": [
                {"name": "from",        "type": "address"},
                {"name": "to",          "type": "address"},
                {"name": "value",       "type": "uint256"},
                {"name": "validAfter",  "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce",       "type": "bytes32"},
            ]
        }
        message = {
            "from":        from_address,
            "to":          to_address,
            "value":       value,
            "validAfter":  valid_after,
            "validBefore": valid_before,
            "nonce":       nonce,
        }

        structured = {
            "types":             {"EIP712Domain": [
                {"name": "name",              "type": "string"},
                {"name": "version",           "type": "string"},
                {"name": "chainId",           "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ], **message_types},
            "domain":            domain,
            "primaryType":       "TransferWithAuthorization",
            "message":           message,
        }

        signed = Account.sign_typed_data(session_key.key, full_message=structured)
        return {
            "from":        from_address,
            "to":          to_address,
            "value":       str(value),
            "validAfter":  str(valid_after),
            "validBefore": str(valid_before),
            "nonce":       "0x" + nonce.hex() if isinstance(nonce, bytes) else nonce,
            "v":           signed.v,
            "r":           "0x" + signed.r.to_bytes(32, "big").hex(),
            "s":           "0x" + signed.s.to_bytes(32, "big").hex(),
        }
