import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { formatUSDC, formatDeadline, truncateAddress } from "@/lib/utils";
import type { TaskSummary } from "@/lib/api";

interface TaskCardProps {
  task: TaskSummary;
}

const CATEGORY_COLORS: Record<string, string> = {
  DataProcessing: "bg-blue-100 text-blue-800",
  WebScraping:    "bg-purple-100 text-purple-800",
  CodeGeneration: "bg-orange-100 text-orange-800",
  Research:       "bg-teal-100 text-teal-800",
  Translation:    "bg-pink-100 text-pink-800",
  Other:          "bg-gray-100 text-gray-800",
};

export function TaskCard({ task }: TaskCardProps) {
  const categoryColor = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Other;

  return (
    <Link href={`/tasks/${task.taskId}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">
              Task #{task.taskId}
            </CardTitle>
            <TaskStatusBadge status={task.status} />
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${categoryColor}`}>
            {task.category}
          </span>
        </CardHeader>

        <CardContent className="pb-2">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-mono text-xs">{truncateAddress(task.poster)}</p>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between text-sm pt-2 border-t">
          <span className="font-semibold text-green-700">{formatUSDC(task.bountyUSDC)}</span>
          <span className="text-muted-foreground text-xs">
            Expires in {formatDeadline(task.deadline)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
