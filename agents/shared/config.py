import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).parents[2] / ".env")

def _required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise EnvironmentError(f"Missing required env var: {key}")
    return val

def _optional(key: str, fallback: str = "") -> str:
    return os.getenv(key, fallback)

class Config:
    RPC_URL:               str = _optional("RPC_URL", "http://localhost:8545")
    CHAIN_ID:              int = int(_optional("CHAIN_ID", "31337"))
    API_BASE_URL:          str = _optional("API_BASE_URL", "http://localhost:3001")
    TASK_REGISTRY_ADDRESS: str = _optional("TASK_REGISTRY_ADDRESS", "")
    KITE_PASSPORT_ADDRESS: str = _optional("KITE_PASSPORT_ADDRESS", "")
    USDC_ADDRESS:          str = _optional("USDC_ADDRESS", "")
    MASTER_MNEMONIC:       str = _optional("MASTER_MNEMONIC", "")
    ANTHROPIC_API_KEY:     str = _optional("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY:        str = _optional("OPENAI_API_KEY", "")
    OPENAI_MODEL:          str = _optional("OPENAI_MODEL", "gpt-4o-mini")
    LANGSMITH_API_KEY:     str = _optional("LANGSMITH_API_KEY", "")
    LANGSMITH_TRACING:     bool = _optional("LANGSMITH_TRACING", "false").lower() == "true"
    PINATA_JWT:            str = _optional("PINATA_JWT", "")
    # Fee amounts in USDC atomic units (6 decimals)
    SUBMISSION_FEE_USDC:   int = int(_optional("SUBMISSION_FEE_USDC", "100000"))
    REVIEW_FEE_USDC:       int = int(_optional("REVIEW_FEE_USDC", "50000"))

config = Config()
