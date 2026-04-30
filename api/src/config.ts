import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  PORT:                 parseInt(optional("API_PORT", "3001")),
  RPC_URL:              optional("RPC_URL", "http://localhost:8545"),
  CHAIN_ID:             parseInt(optional("CHAIN_ID", "31337")),
  NETWORK_NAME:         optional("NETWORK_NAME", "local"),

  TASK_REGISTRY_ADDRESS: optional("TASK_REGISTRY_ADDRESS", ""),
  TASK_ESCROW_ADDRESS:   optional("TASK_ESCROW_ADDRESS", ""),
  KITE_PASSPORT_ADDRESS: optional("KITE_PASSPORT_ADDRESS", ""),
  USDC_ADDRESS:          optional("USDC_ADDRESS", ""),

  API_WALLET_PRIVATE_KEY: optional("API_WALLET_PRIVATE_KEY", ""),
  MASTER_MNEMONIC:        optional("MASTER_MNEMONIC", ""),

  IPFS_API_URL: optional("IPFS_API_URL", "http://localhost:5001"),
  PINATA_JWT:   optional("PINATA_JWT", ""),

  JWT_SECRET:           optional("JWT_SECRET", "dev-secret-change-in-production"),
  JWT_EXPIRY_SECONDS:   parseInt(optional("JWT_EXPIRY_SECONDS", "86400")),

  PLATFORM_FEE_BPS:     parseInt(optional("PLATFORM_FEE_BPS", "250")),
  SUBMISSION_FEE_USDC:  BigInt(optional("SUBMISSION_FEE_USDC", "100000")),
  REVIEW_FEE_USDC:      BigInt(optional("REVIEW_FEE_USDC", "50000")),
} as const;
