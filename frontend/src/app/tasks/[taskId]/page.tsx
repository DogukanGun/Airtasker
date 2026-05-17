"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type TaskDetail, type Bid } from "@/lib/api";
import { CONTRACTS, TASK_REGISTRY_ABI } from "@/lib/contracts";
import { formatUSDC, formatDeadline, truncateAddress } from "@/lib/utils";

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const id = parseInt(taskId);

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [bids, setBids]  = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  function refresh() {
    api.tasks.get(id)
      .then(({ task, bids }) => { setTask(task); setBids(bids); })
      .catch(console.error);
  }

  useEffect(() => {
    refresh();
    setLoading(false);
  }, [id]);

  async function handleAccept(bidId: number) {
    if (!CONTRACTS.TASK_REGISTRY || !publicClient) return;
    setAcceptError(null);
    setAccepting(bidId);
    try {
      const hash = await writeContractAsync({
        address:      CONTRACTS.TASK_REGISTRY,
        abi:          TASK_REGISTRY_ABI,
        functionName: "acceptBid",
        args:         [BigInt(id), BigInt(bidId)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      refresh();
    } catch (e: any) {
      setAcceptError(e.shortMessage ?? e.message ?? "Accept failed");
    } finally {
      setAccepting(null);
    }
  }

  const isPoster = task && address && task.poster.toLowerCase() === address.toLowerCase();
  const isOpen   = task?.status === "Open";

  if (loading) return <div className="container mx-auto px-4 py-12 text-center">Loading...</div>;
  if (!task)   return <div className="container mx-auto px-4 py-12 text-center">Task not found.</div>;

  return (
    <div className="container max-w-screen-md mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Task #{task.taskId}</h1>
          <p className="text-sm text-muted-foreground mt-1">Posted by {truncateAddress(task.poster)}</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      {/* Details */}
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Category</span>
            <Badge variant="outline">{task.category}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bounty</span>
            <span className="font-semibold text-green-700">{formatUSDC(task.bountyUSDC)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Review fee</span>
            <span>{formatUSDC(task.reviewFeeUSDC)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deadline</span>
            <span>{formatDeadline(task.deadline)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Min trust score</span>
            <span>{task.minTrustScore}</span>
          </div>
          {task.assignedWorker && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Worker</span>
              <span className="font-mono text-xs">{truncateAddress(task.assignedWorker)}</span>
            </div>
          )}
          {task.resultURI && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Result</span>
              <a href={task.resultURI} className="text-primary text-xs hover:underline" target="_blank">
                View on IPFS
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bids */}
      <Card>
        <CardHeader><CardTitle>Bids ({bids.length})</CardTitle></CardHeader>
        <CardContent>
          {bids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bids yet.</p>
          ) : (
            <div className="space-y-3">
              {bids.map(bid => (
                <div key={bid.bidId} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
                  <div className="flex-1">
                    <div className="font-mono text-xs">{truncateAddress(bid.worker)}</div>
                    <div className="text-xs text-muted-foreground">bid #{bid.bidId}</div>
                  </div>
                  <span className="font-semibold">{formatUSDC(bid.proposedFeeUSDC)}</span>
                  {bid.accepted ? (
                    <Badge variant="success">Accepted</Badge>
                  ) : isPoster && isOpen ? (
                    <Button
                      size="sm"
                      disabled={accepting !== null}
                      onClick={() => handleAccept(bid.bidId)}
                    >
                      {accepting === bid.bidId ? "Accepting..." : "Accept"}
                    </Button>
                  ) : null}
                </div>
              ))}
              {acceptError && <p className="text-sm text-red-600">{acceptError}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
