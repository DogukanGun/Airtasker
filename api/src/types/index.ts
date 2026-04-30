export enum TaskStatus {
  Open = "Open",
  Active = "Active",
  UnderReview = "UnderReview",
  Completed = "Completed",
  Disputed = "Disputed",
  Cancelled = "Cancelled",
}

export enum TaskCategory {
  DataProcessing = "DataProcessing",
  WebScraping = "WebScraping",
  CodeGeneration = "CodeGeneration",
  Research = "Research",
  Translation = "Translation",
  Other = "Other",
}

export interface Task {
  taskId: number;
  poster: string;
  metadataURI: string;
  bountyUSDC: string;
  reviewFeeUSDC: string;
  status: TaskStatus;
  category: TaskCategory;
  deadline: number;
  assignedWorker?: string;
  resultURI?: string;
  resultHash?: string;
  createdAt: number;
  completedAt?: number;
  minTrustScore: number;
  // off-chain augmented fields
  title?: string;
  description?: string;
  bidCount?: number;
}

export interface Bid {
  bidId: number;
  taskId: number;
  worker: string;
  proposedFeeUSDC: string;
  pitchURI?: string;
  sessionKeyAddress?: string;
  sessionKeyProof?: string;
  createdAt: number;
  accepted: boolean;
}

export interface Submission {
  taskId: number;
  worker: string;
  resultSummary: string;
  resultURI: string;
  resultHash: string;
  submittedAt: number;
  verdict?: "PASS" | "FAIL" | "PARTIAL";
}

export interface Review {
  taskId: number;
  reviewer: string;
  verdict: "PASS" | "FAIL" | "PARTIAL";
  reason: string;
  evidenceURI?: string;
  reviewedAt: number;
}

export interface AgentProfile {
  address: string;
  metadataURI: string;
  trustScore: number;
  tasksCompleted: number;
  tasksDisputed: number;
  registeredAt: number;
}

export interface X402PaymentDescriptor {
  version: "1.0";
  scheme: "eip3009";
  network: string;
  asset: string;
  recipient: string;
  amount: string;
  accepts: string[];
}

export interface X402PaymentHeader {
  version: "1.0";
  scheme: "eip3009";
  network: string;
  asset: string;
  recipient: string;
  amount: string;
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  v: number;
  r: string;
  s: string;
}
