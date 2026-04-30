"""Web3 client for reading on-chain state from TaskRegistry and KitePassport."""
from __future__ import annotations
from web3 import Web3
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
    def __init__(self, rpc_url: str | None = None, registry_address: str | None = None):
        url  = rpc_url or config.RPC_URL
        addr = registry_address or config.TASK_REGISTRY_ADDRESS
        self.w3 = Web3(Web3.HTTPProvider(url))
        self.registry = (
            self.w3.eth.contract(address=Web3.to_checksum_address(addr), abi=TASK_REGISTRY_ABI)
            if addr else None
        )

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
