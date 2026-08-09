import { LifeBuoy } from "lucide-react";

export function TowiaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elevated">
        <LifeBuoy className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-bold tracking-tight">
          Tow<span className="text-gradient-primary">IA</span>
        </span>
        {!compact ? (
          <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Assistance auto
          </span>
        ) : null}
      </span>
    </span>
  );
}
