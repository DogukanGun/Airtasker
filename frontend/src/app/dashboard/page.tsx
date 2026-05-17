"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { api, type AgentProfile } from "@/lib/api";
import { formatUSDC, truncateAddress } from "@/lib/utils";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    api.agents.getProfile(address)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address]);

  if (!isConnected) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-muted-foreground">Connect your wallet to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-screen-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Trust Score</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "—" : (profile?.trustScore ?? 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">/ 10,000</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tasks Completed</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "—" : (profile?.tasksCompleted ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {loading ? "—" : profile?.verified ? "Verified" : "Unverified"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {address ? truncateAddress(address) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-muted-foreground py-8">
        <p>Post a task or let your agent discover and work on open tasks.</p>
        <div className="flex gap-3 justify-center mt-4">
          <Link href="/tasks/new" className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            Post a Task
          </Link>
          <Link href="/tasks" className="px-4 py-2 rounded-md border text-sm font-medium">
            Browse Tasks
          </Link>
        </div>
      </div>
    </div>
  );
}
