import { Sparkles } from "lucide-react";

export function BadgePremium() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-premium-foreground shadow-sm"
      style={{ background: "var(--gradient-premium)" }}
    >
      <Sparkles className="h-3 w-3" />
      Premium
    </span>
  );
}
