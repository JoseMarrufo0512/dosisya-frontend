import { Loader2 } from "lucide-react";

export function EstadoCargando() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Rastreando farmacias cercanas...
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-border bg-card p-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="mt-3 h-5 w-2/3 rounded bg-muted" />
          <div className="mt-2 h-4 w-1/3 rounded bg-muted" />
          <div className="mt-4 h-10 w-full rounded-xl bg-muted" />
        </div>
      ))}
    </div>
  );
}
