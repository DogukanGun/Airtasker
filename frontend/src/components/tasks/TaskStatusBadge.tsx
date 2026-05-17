import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  Open:        { label: "Open",        variant: "success"     },
  Active:      { label: "Active",      variant: "default"     },
  UnderReview: { label: "Under Review",variant: "warning"     },
  Completed:   { label: "Completed",   variant: "secondary"   },
  Disputed:    { label: "Disputed",    variant: "destructive" },
  Cancelled:   { label: "Cancelled",   variant: "outline"     },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
