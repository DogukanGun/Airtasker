import { ethers } from "ethers";
import { config } from "../config";
import { logger } from "../utils/logger";

// Minimal ABIs — only functions the API needs to call
export const TASK_REGISTRY_ABI = [
  "function postTask(string metadataURI, uint256 bountyUSDC, uint256 reviewFeeUSDC, uint8 category, uint256 deadline, uint256 minTrustScore) returns (uint256)",
  "function submitBid(uint256 taskId, uint256 proposedFeeUSDC, string pitchURI, bytes sessionKeyProof) returns (uint256)",
  "function acceptBid(uint256 taskId, uint256 bidId)",
  "function submitResult(uint256 taskId, string resultURI, bytes32 resultHash)",
  "function triggerCompletion(uint256 taskId, address reviewer)",
  "function cancelTask(uint256 taskId)",
  "function disputeTask(uint256 taskId)",
  "function getFullTask(uint256 taskId) view returns (tuple(uint256 taskId, address poster, string metadataURI, uint256 bountyUSDC, uint256 reviewFeeUSDC, uint8 status, uint8 category, uint256 deadline, address assignedWorker, string resultURI, bytes32 resultHash, uint256 createdAt, uint256 completedAt, uint256 minTrustScore))",
  "function getTaskBids(uint256 taskId) view returns (tuple(uint256 bidId, uint256 taskId, address worker, uint256 proposedFeeUSDC, string pitchURI, bytes sessionKeyProof, uint256 createdAt, bool accepted)[])",
  "function getOpenTasks(uint8 category, uint256 offset, uint256 limit) view returns (tuple(uint256 taskId, address poster, string metadataURI, uint256 bountyUSDC, uint256 reviewFeeUSDC, uint8 status, uint8 category, uint256 deadline, address assignedWorker, string resultURI, bytes32 resultHash, uint256 createdAt, uint256 completedAt, uint256 minTrustScore)[], uint256)",
  "function getOpenTaskIds(uint256 offset, uint256 limit) view returns (uint256[], uint256)",
  "function getOpenTaskCount() view returns (uint256)",
  "event TaskPosted(uint256 indexed taskId, address indexed poster, uint256 bountyUSDC, uint8 category, uint256 deadline, string metadataURI)",
  "event BidSubmitted(uint256 indexed taskId, uint256 indexed bidId, address indexed worker, uint256 proposedFeeUSDC)",
  "event BidAccepted(uint256 indexed taskId, uint256 indexed bidId, address indexed worker)",
  "event ResultSubmitted(uint256 indexed taskId, address indexed worker, string resultURI, bytes32 resultHash)",
  "event TaskCompleted(uint256 indexed taskId, address indexed worker, uint256 payoutUSDC)",
];

export const KITE_PASSPORT_ABI = [
  "function getScore(address agent) view returns (uint256)",
  "function meetsMinimum(address agent, uint256 minScore) view returns (bool)",
  "function isRegistered(address agent) view returns (bool)",
  "function getPassport(address agent) view returns (tuple(uint256 score, uint256 tasksCompleted, uint256 tasksDisputed, uint256 lastUpdated, bool verified, string metadataURI))",
];

export const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
];

let _provider: ethers.JsonRpcProvider | null = null;
let _signer: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(config.RPC_URL);
  }
  return _provider;
}

export function getSigner(): ethers.Wallet {
  if (!_signer) {
    if (!config.API_WALLET_PRIVATE_KEY) {
      throw new Error("API_WALLET_PRIVATE_KEY not configured");
    }
    _signer = new ethers.Wallet(config.API_WALLET_PRIVATE_KEY, getProvider());
  }
  return _signer;
}

export function getRegistryContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const conn = signerOrProvider ?? getProvider();
  return new ethers.Contract(config.TASK_REGISTRY_ADDRESS, TASK_REGISTRY_ABI, conn);
}

export function getPassportContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const conn = signerOrProvider ?? getProvider();
  return new ethers.Contract(config.KITE_PASSPORT_ADDRESS, KITE_PASSPORT_ABI, conn);
}

export function getUsdcContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const conn = signerOrProvider ?? getProvider();
  return new ethers.Contract(config.USDC_ADDRESS, USDC_ABI, conn);
}
