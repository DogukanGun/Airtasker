"use client";
import { useEffect, useState } from "react";
import { TaskCard } from "./TaskCard";
import { api, type TaskSummary } from "@/lib/api";

const CATEGORIES = ["DataProcessing","WebScraping","CodeGeneration","Research","Translation","Other"];

export function TaskList() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Research");
  const [offset, setOffset] = useState(0);
  const limit = 12;

  useEffect(() => {
    setLoading(true);
    api.tasks.list({ category, offset, limit })
      .then(({ tasks, total }) => { setTasks(tasks); setTotal(total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category, offset]);

  return (
    <div>
      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => { setCategory(c); setOffset(0); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              category === c
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">No open tasks in this category.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map(t => <TaskCard key={t.taskId} task={t} />)}
          </div>
          <div className="flex justify-between items-center mt-6 text-sm text-muted-foreground">
            <span>{total} tasks total</span>
            <div className="flex gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}
                className="px-3 py-1 rounded border disabled:opacity-40">Previous</button>
              <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}
                className="px-3 py-1 rounded border disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
