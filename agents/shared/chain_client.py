"""Web3 client for reading on-chain state from TaskRegistry and KitePassport,
and for sending bid + submitResult txs when a private key is configured."""
from __future__ import annotations
from web3 import Web3
from eth_account import Account
from .config import config

TASK_REGISTRY_ABI = [
    {
        "name": "getOpenTasks",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "category",  "type": "uint8"},
            {"name": "offset",    "type": "uint256"},
            {"name": "limit",     "type": "uint256"},
        ],
        "outputs": [
            {"name": "tasks", "type": "tuple[]", "components": [
                {"name": "taskId",         "type": "uint256"},
                {"name": "poster",         "type": "address"},
                {"name": "metadataURI",    "type": "string"},
                {"name": "bountyUSDC",     "type": "uint256"},
                {"name": "reviewFeeUSDC",  "type": "uint256"},
                {"name": "status",         "type": "uint8"},
                {"name": "category",       "type": "uint8"},
                {"name": "deadline",       "type": "uint256"},
                {"name": "assignedWorker", "type": "address"},
                {"name": "resultURI",      "type": "string"},
                {"name": "resultHash",     "type": "bytes32"},
                {"name": "createdAt",      "type": "uint256"},
                {"name": "completedAt",    "type": "uint256"},
                {"name": "minTrustScore",  "type": "uint256"},
            ]},
            {"name": "total",  "type": "uint256"},
        ],
    },
    {
        "name": "getFullTask",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "taskId", "type": "uint256"}],
        "outputs": [{"name": "", "type": "tuple", "components": [
            {"name": "taskId",         "type": "uint256"},
            {"name": "poster",         "type": "address"},
            {"name": "metadataURI",    "type": "string"},
            {"name": "bountyUSDC",     "type": "uint256"},
            {"name": "reviewFeeUSDC",  "type": "uint256"},
            {"name": "status",         "type": "uint8"},
            {"name": "category",       "type": "uint8"},
            {"name": "deadline",       "type": "uint256"},
            {"name": "assignedWorker", "type": "address"},
            {"name": "resultURI",      "type": "string"},
            {"name": "resultHash",     "type": "bytes32"},
            {"name": "createdAt",      "type": "uint256"},
            {"name": "completedAt",    "type": "uint256"},
            {"name": "minTrustScore",  "type": "uint256"},
        ]}],
    },
    {
        "name": "submitBid",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "taskId",          "type": "uint256"},
            {"name": "proposedFeeUSDC", "type": "uint256"},
            {"name": "pitchURI",        "type": "string"},
            {"name": "sessionKeyProof", "type": "bytes"},
        ],
        "outputs": [{"name": "bidId", "type": "uint256"}],
    },
    {
        "name": "getTaskBids",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "taskId", "type": "uint256"}],
        "outputs": [{"name": "", "type": "tuple[]", "components": [
            {"name": "bidId",           "type": "uint256"},
            {"name": "taskId",          "type": "uint256"},
            {"name": "worker",          "type": "address"},
            {"name": "proposedFeeUSDC", "type": "uint256"},
            {"name": "pitchURI",        "type": "string"},
            {"name": "sessionKeyProof", "type": "bytes"},
            {"name": "createdAt",       "type": "uint256"},
            {"name": "accepted",        "type": "bool"},
        ]}],
    },
    {
        "name": "submitResult",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "taskId",     "type": "uint256"},
            {"name": "resultURI",  "type": "string"},
            {"name": "resultHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "name": "TaskPosted",
        "type": "event",
        "inputs": [
            {"name": "taskId",      "type": "uint256", "indexed": True},
            {"name": "poster",      "type": "address", "indexed": True},
            {"name": "bountyUSDC",  "type": "uint256", "indexed": False},
            {"name": "category",    "type": "uint8",   "indexed": False},
            {"name": "deadline",    "type": "uint256", "indexed": False},
            {"name": "metadataURI", "type": "string",  "indexed": False},
        ],
    },
]

CATEGORY_NAMES = ["DataProcessing","WebScraping","CodeGeneration","Research","Translation","Other"]
CATEGORY_MAP   = {name: idx for idx, name in enumerate(CATEGORY_NAMES)}
STATUS_NAMES   = ["Open","Active","UnderReview","Completed","Disputed","Cancelled"]


class ChainClient:
    def __init__(self, rpc_url: str | None = None, registry_address: str | None = None,
                 signer_key: str | None = None):
        url  = rpc_url or config.RPC_URL
        addr = registry_address or config.TASK_REGISTRY_ADDRESS
        self.w3 = Web3(Web3.HTTPProvider(url))
        self.registry = (
            self.w3.eth.contract(address=Web3.to_checksum_address(addr), abi=TASK_REGISTRY_ABI)
            if addr else None
        )
        key = signer_key or config.API_WALLET_PRIVATE_KEY
        self.signer = Account.from_key(key) if key else None

    @property
    def signer_address(self) -> str | None:
        return self.signer.address if self.signer else None

    def get_open_tasks(self, category: str = "Research", offset: int = 0, limit: int = 20) -> list[dict]:
        if not self.registry:
            return []
        cat_idx = CATEGORY_MAP.get(category, 3)
        tasks, _total = self.registry.functions.getOpenTasks(cat_idx, offset, limit).call()
        return [self._map_task(t) for t in tasks]

    def get_task(self, task_id: int) -> dict | None:
        if not self.registry:
            return None
        raw = self.registry.functions.getFullTask(task_id).call()
        return self._map_task(raw)

    def get_task_bids(self, task_id: int) -> list[dict]:
        if not self.registry:
            return []
        raw = self.registry.functions.getTaskBids(task_id).call()
        return [
            {
                "bidId":           b[0],
                "taskId":          b[1],
                "worker":          b[2],
                "proposedFeeUSDC": b[3],
                "pitchURI":        b[4],
                "sessionKeyProof": b[5],
                "createdAt":       b[6],
                "accepted":        b[7],
            }
            for b in raw
        ]

    def _send_tx(self, fn, *, gas: int = 500_000) -> str:
        if not self.signer:
            raise RuntimeError("ChainClient has no signer configured (set API_WALLET_PRIVATE_KEY).")
        nonce = self.w3.eth.get_transaction_count(self.signer.address)
        tx = fn.build_transaction({
            "from":     self.signer.address,
            "nonce":    nonce,
            "gas":      gas,
            "gasPrice": self.w3.eth.gas_price,
            "chainId":  config.CHAIN_ID,
        })
        signed = self.signer.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.status != 1:
            raise RuntimeError(f"tx reverted: {tx_hash.hex()}")
        return tx_hash.hex()

    def submit_bid(self, task_id: int, proposed_fee: int, pitch_uri: str, proof_hex: str) -> str:
        proof_bytes = bytes.fromhex(proof_hex.removeprefix("0x"))
        fn = self.registry.functions.submitBid(task_id, proposed_fee, pitch_uri, proof_bytes)
        return self._send_tx(fn)

    def submit_result(self, task_id: int, result_uri: str, result_hash: str) -> str:
        if isinstance(result_hash, str):
            result_hash_bytes = bytes.fromhex(result_hash.removeprefix("0x"))
        else:
            result_hash_bytes = result_hash
        fn = self.registry.functions.submitResult(task_id, result_uri, result_hash_bytes)
        return self._send_tx(fn)

    def _map_task(self, raw: tuple) -> dict:
        return {
            "taskId":         raw[0],
            "poster":         raw[1],
            "metadataURI":    raw[2],
            "bountyUSDC":     raw[3],
            "reviewFeeUSDC":  raw[4],
            "status":         STATUS_NAMES[raw[5]] if raw[5] < len(STATUS_NAMES) else "Unknown",
            "category":       CATEGORY_NAMES[raw[6]] if raw[6] < len(CATEGORY_NAMES) else "Other",
            "deadline":       raw[7],
            "assignedWorker": raw[8],
            "resultURI":      raw[9],
            "resultHash":     raw[10],
            "createdAt":      raw[11],
            "completedAt":    raw[12],
            "minTrustScore":  raw[13],
        }
