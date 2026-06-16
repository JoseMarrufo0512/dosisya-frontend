import { Bike } from "lucide-react";

export function BadgeDelivery() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--secondary)]/20 px-2 py-0.5 text-[11px] font-bold text-primary">
      <Bike className="h-3 w-3" />
      Delivery
    </span>
  );
}
