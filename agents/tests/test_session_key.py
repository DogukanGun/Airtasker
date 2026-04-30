"""Tests for BIP-32 session key management."""
import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

Account.enable_unaudited_hdwallet_features()


def make_mnemonic() -> str:
    import secrets
    entropy = secrets.token_bytes(16)
    return Account.from_mnemonic(
        "test test test test test test test test test test test junk"
    )._private_key.hex()  # just need a mnemonic string
    # Use a known test mnemonic instead:


TEST_MNEMONIC = "test test test test test test test test test test test junk"


def test_derive_session_key_deterministic():
    from agents.shared.bip32_session import SessionKeyManager
    skm = SessionKeyManager(TEST_MNEMONIC)
    addr1 = skm.get_session_address(42)
    addr2 = skm.get_session_address(42)
    assert addr1 == addr2


def test_different_task_ids_different_addresses():
    from agents.shared.bip32_session import SessionKeyManager
    skm = SessionKeyManager(TEST_MNEMONIC)
    addr1 = skm.get_session_address(1)
    addr2 = skm.get_session_address(2)
    assert addr1 != addr2


def test_sign_and_verify_bid_proof():
    from agents.shared.bip32_session import SessionKeyManager
    skm = SessionKeyManager(TEST_MNEMONIC)
    task_id = 99
    session_address = skm.get_session_address(task_id)
    proof = skm.sign_bid_proof(task_id)

    valid = SessionKeyManager.verify_session_key_proof(
        task_id=task_id,
        session_address=session_address,
        master_address=skm.master_address,
        signature_hex=proof,
    )
    assert valid is True


def test_verify_fails_wrong_task_id():
    from agents.shared.bip32_session import SessionKeyManager
    skm = SessionKeyManager(TEST_MNEMONIC)
    task_id = 99
    session_address = skm.get_session_address(task_id)
    proof = skm.sign_bid_proof(task_id)

    valid = SessionKeyManager.verify_session_key_proof(
        task_id=999,  # wrong task
        session_address=session_address,
        master_address=skm.master_address,
        signature_hex=proof,
    )
    assert valid is False


def test_verify_fails_wrong_master():
    from agents.shared.bip32_session import SessionKeyManager
    skm  = SessionKeyManager(TEST_MNEMONIC)
    skm2 = SessionKeyManager("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about")
    task_id = 10
    session_address = skm.get_session_address(task_id)
    proof = skm.sign_bid_proof(task_id)

    valid = SessionKeyManager.verify_session_key_proof(
        task_id=task_id,
        session_address=session_address,
        master_address=skm2.master_address,  # different master
        signature_hex=proof,
    )
    assert valid is False
