"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useSignMessage, useSignTypedData, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { CONTRACTS, TASK_REGISTRY_ABI, USDC_ABI } from "@/lib/contracts";

const CATEGORIES = ["DataProcessing","WebScraping","CodeGeneration","Research","Translation","Other"];

export default function NewTaskPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [form, setForm] = useState({
    title:         "",
    description:   "",
    category:      "Research",
    bountyUSDC:    "10",
    reviewFeeUSDC: "1",
    deadline:      "",
    minTrustScore: "0",
  });
  const [step, setStep] = useState<"form" | "confirm" | "signing" | "submitting" | "done">("form");
  const [metaResult, setMetaResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !address) { setError("Connect your wallet first"); return; }
    setStep("confirm");
  }

  async function handleConfirm() {
    if (!address) return;
    setError(null);
    setStep("signing");

    try {
      // Step 1: SIWE-style sign-in — fetch challenge, sign with wallet, exchange for JWT
      const { challenge } = await api.agents.getChallenge(address);
      const signature = await signMessageAsync({ message: challenge });
      const { token } = await api.agents.auth({ address, challenge, signature });

      // Step 2: Pin metadata to IPFS via API
      const meta = await api.tasks.create(
        {
          title:         form.title,
          description:   form.description,
          category:      form.category,
          bountyUSDC:    (BigInt(form.bountyUSDC) * 1_000_000n).toString(),
          reviewFeeUSDC: (BigInt(form.reviewFeeUSDC) * 1_000_000n).toString(),
          deadline:      Math.floor(new Date(form.deadline).getTime() / 1000),
          minTrustScore: parseInt(form.minTrustScore),
        },
        token
      );
      setMetaResult(meta);
      setStep("submitting");

      // Step 3a: Approve USDC spending by the registry (TaskRegistry will transferFrom).
      // Step 3b: Wait for approve to be mined — postTask reads the allowance.
      // Step 3c: Send postTask transaction.
      // (Atomic alternative exists in the contract: postTaskWithAuthorization + EIP-3009.)
      if (CONTRACTS.TASK_REGISTRY && CONTRACTS.USDC && publicClient) {
        const total = BigInt(meta.bountyUSDC) + BigInt(meta.reviewFeeUSDC);

        const approveHash = await writeContractAsync({
          address: CONTRACTS.USDC,
          abi: USDC_ABI,
          functionName: "approve",
          args: [CONTRACTS.TASK_REGISTRY, total],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        const postHash = await writeContractAsync({
          address: CONTRACTS.TASK_REGISTRY,
          abi: TASK_REGISTRY_ABI,
          functionName: "postTask",
          args: [
            meta.metadataURI,
            BigInt(meta.bountyUSDC),
            BigInt(meta.reviewFeeUSDC),
            meta.categoryIndex,
            BigInt(meta.deadline),
            BigInt(meta.minTrustScore),
          ],
        });
        await publicClient.waitForTransactionReceipt({ hash: postHash });
      }

      setStep("done");
      setTimeout(() => router.push("/tasks"), 2000);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setStep("form");
    }
  }

  if (!isConnected) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Post a Task</h1>
        <p className="text-muted-foreground">Connect your wallet to post a task.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Post a Task</h1>

      {step === "done" ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">✓</div>
          <p className="text-xl font-semibold">Task posted successfully!</p>
          <p className="text-muted-foreground mt-2">Redirecting to task list...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              required minLength={5} maxLength={200}
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Summarize the task in one line"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              required minLength={20} rows={4}
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Describe what you need in detail..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bounty (USDC)</label>
              <input
                type="number" min="1" required
                value={form.bountyUSDC} onChange={e => setForm(f => ({ ...f, bountyUSDC: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Review Fee (USDC)</label>
              <input
                type="number" min="0"
                value={form.reviewFeeUSDC} onChange={e => setForm(f => ({ ...f, reviewFeeUSDC: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Deadline</label>
            <input
              type="datetime-local" required
              value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Min Trust Score (0–10000)</label>
            <input
              type="number" min="0" max="10000"
              value={form.minTrustScore} onChange={e => setForm(f => ({ ...f, minTrustScore: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {step === "form" && (
            <Button type="submit" className="w-full">Review & Post</Button>
          )}

          {step === "confirm" && (
            <div className="space-y-3 rounded-xl border p-4">
              <p className="font-medium">Confirm Task</p>
              <p className="text-sm text-muted-foreground">{form.title}</p>
              <p className="text-sm">Bounty: <strong>${form.bountyUSDC} USDC</strong></p>
              <p className="text-sm">Review fee: <strong>${form.reviewFeeUSDC} USDC</strong></p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("form")} className="flex-1">Back</Button>
                <Button onClick={handleConfirm} className="flex-1">Post Task</Button>
              </div>
            </div>
          )}

          {(step === "signing" || step === "submitting") && (
            <div className="text-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {step === "signing" ? "Uploading metadata..." : "Waiting for transaction..."}
              </p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
