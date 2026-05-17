// Contract addresses and ABIs
// ABIs are loaded from the Foundry out/ directory at build time
// For now, using minimal inline ABIs for the required function calls

export const CONTRACTS = {
  TASK_REGISTRY: process.env.NEXT_PUBLIC_TASK_REGISTRY_ADDRESS as `0x${string}` | undefined,
  TASK_ESCROW:   process.env.NEXT_PUBLIC_TASK_ESCROW_ADDRESS   as `0x${string}` | undefined,
  KITE_PASSPORT: process.env.NEXT_PUBLIC_KITE_PASSPORT_ADDRESS as `0x${string}` | undefined,
  USDC:          process.env.NEXT_PUBLIC_USDC_ADDRESS           as `0x${string}` | undefined,
};

export const TASK_REGISTRY_ABI = [
  {
    name: "postTask",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadataURI",   type: "string"  },
      { name: "bountyUSDC",    type: "uint256" },
      { name: "reviewFeeUSDC", type: "uint256" },
      { name: "category",      type: "uint8"   },
      { name: "deadline",      type: "uint256" },
      { name: "minTrustScore", type: "uint256" },
    ],
    outputs: [{ name: "taskId", type: "uint256" }],
  },
  {
    name: "acceptBid",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "bidId",  type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "postTaskWithAuthorization",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadataURI",    type: "string"  },
      { name: "bountyUSDC",     type: "uint256" },
      { name: "reviewFeeUSDC",  type: "uint256" },
      { name: "category",       type: "uint8"   },
      { name: "deadline",       type: "uint256" },
      { name: "minTrustScore",  type: "uint256" },
      { name: "value",          type: "uint256" },
      { name: "validAfter",     type: "uint256" },
      { name: "validBefore",    type: "uint256" },
      { name: "nonce",          type: "bytes32" },
      { name: "v",              type: "uint8"   },
      { name: "r",              type: "bytes32" },
      { name: "s",              type: "bytes32" },
    ],
    outputs: [{ name: "taskId", type: "uint256" }],
  },
  {
    name: "getOpenTasks",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "category", type: "uint8"   },
      { name: "offset",   type: "uint256" },
      { name: "limit",    type: "uint256" },
    ],
    outputs: [
      { name: "tasks", type: "tuple[]", components: [
        { name: "taskId",        type: "uint256" },
        { name: "poster",        type: "address" },
        { name: "metadataURI",   type: "string"  },
        { name: "bountyUSDC",    type: "uint256" },
        { name: "reviewFeeUSDC", type: "uint256" },
        { name: "status",        type: "uint8"   },
        { name: "category",      type: "uint8"   },
        { name: "deadline",      type: "uint256" },
        { name: "assignedWorker",type: "address" },
        { name: "resultURI",     type: "string"  },
        { name: "resultHash",    type: "bytes32" },
        { name: "createdAt",     type: "uint256" },
        { name: "completedAt",   type: "uint256" },
        { name: "minTrustScore", type: "uint256" },
      ]},
      { name: "total", type: "uint256" },
    ],
  },
  {
    name: "getOpenTaskCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "TaskPosted",
    type: "event",
    inputs: [
      { name: "taskId",      type: "uint256", indexed: true  },
      { name: "poster",      type: "address", indexed: true  },
      { name: "bountyUSDC",  type: "uint256", indexed: false },
      { name: "category",    type: "uint8",   indexed: false },
      { name: "deadline",    type: "uint256", indexed: false },
      { name: "metadataURI", type: "string",  indexed: false },
    ],
  },
] as const;

export const KITE_PASSPORT_ABI = [
  {
    name: "getScore",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getPassport",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "tuple", components: [
      { name: "score",          type: "uint256" },
      { name: "tasksCompleted", type: "uint256" },
      { name: "tasksDisputed",  type: "uint256" },
      { name: "lastUpdated",    type: "uint256" },
      { name: "verified",       type: "bool"    },
      { name: "metadataURI",    type: "string"  },
    ]}],
  },
] as const;

export const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
