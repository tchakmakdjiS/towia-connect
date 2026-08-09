import type { ReactNode } from "react";
import {
  MISSION_STATUS_LABELS,
  MISSION_PRIORITY_LABELS,
  type MissionStatus,
  type MissionPriority,
} from "@/lib/towia";

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="surface-card animate-rise p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? <span className="text-primary">{icon}</span> : null}
      </div>
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="surface-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: MissionStatus }) {
  const tone =
    status === "COMPLETED"
      ? "bg-success/15 text-success"
      : status === "CANCELLED" || status === "DISPUTED"
        ? "bg-destructive/15 text-destructive"
        : status === "CREATED" || status === "AI_ANALYSIS" || status === "SEARCHING"
          ? "bg-warning/15 text-warning"
          : "bg-primary/15 text-primary";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
      {MISSION_STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: MissionPriority }) {
  const tone =
    priority === "EMERGENCY"
      ? "bg-destructive/15 text-destructive"
      : priority === "HIGH"
        ? "bg-warning/15 text-warning"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
      {MISSION_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
      Démo
    </span>
  );
}
