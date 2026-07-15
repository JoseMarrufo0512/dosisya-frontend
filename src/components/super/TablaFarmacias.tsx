import type { AdminFarmaciasResponse } from "@/lib/adminApi";

export function TablaFarmacias({ data }: { data: AdminFarmaciasResponse; token: string; onReload: () => void }) {
  return <div className="text-sm text-muted-foreground">Farmacias: {data.farmacias.length}</div>;
}
