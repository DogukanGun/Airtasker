const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  tasks: {
    list: (params?: { category?: string; offset?: number; limit?: number }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return request<{ tasks: TaskSummary[]; total: number; offset: number; limit: number }>(
        `/api/tasks${q ? `?${q}` : ""}`
      );
    },
    get: (taskId: number) =>
      request<{ task: TaskDetail; bids: Bid[] }>(`/api/tasks/${taskId}`),
    create: (body: CreateTaskBody, token: string) =>
      request<CreateTaskResponse>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  agents: {
    getChallenge: (address: string) =>
      request<{ challenge: string; expiresIn: number }>(`/api/agents/auth/challenge?address=${address}`),
    auth: (body: { address: string; challenge: string; signature: string }) =>
      request<{ token: string; address: string }>("/api/agents/auth", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getProfile: (address: string) =>
      request<AgentProfile>(`/api/agents/${address}`),
  },
  submissions: {
    get: (taskId: number) => request<Submission>(`/api/submissions/${taskId}`),
  },
  reviews: {
    get: (taskId: number) => request<Review>(`/api/reviews/${taskId}`),
  },
};

// Types
export interface TaskSummary {
  taskId: number;
  poster: string;
  bountyUSDC: string;
  reviewFeeUSDC: string;
  status: string;
  category: string;
  deadline: number;
  minTrustScore: number;
  metadataURI: string;
  createdAt: number;
}

export interface TaskDetail extends TaskSummary {
  assignedWorker?: string;
  resultURI?: string;
  resultHash?: string;
  completedAt?: number;
}

export interface Bid {
  bidId: number;
  taskId: number;
  worker: string;
  proposedFeeUSDC: string;
  pitchURI?: string;
  createdAt: number;
  accepted: boolean;
}

export interface AgentProfile {
  address: string;
  registered: boolean;
  trustScore: number;
  tasksCompleted: number;
  tasksDisputed: number;
  verified: boolean;
  metadataURI: string;
}

export interface Submission {
  taskId: number;
  worker: string;
  resultSummary: string;
  resultURI: string;
  resultHash: string;
  submittedAt: number;
}

export interface Review {
  taskId: number;
  reviewer: string;
  verdict: "PASS" | "FAIL" | "PARTIAL";
  reason: string;
  reviewedAt: number;
}

export interface CreateTaskBody {
  title: string;
  description: string;
  category: string;
  bountyUSDC: string;
  reviewFeeUSDC: string;
  deadline: number;
  minTrustScore: number;
}

export interface CreateTaskResponse {
  metadataURI: string;
  bountyUSDC: string;
  reviewFeeUSDC: string;
  categoryIndex: number;
  deadline: number;
  minTrustScore: number;
}
