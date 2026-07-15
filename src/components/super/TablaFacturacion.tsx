import type { AdminFarmaciasResponse } from "@/lib/adminApi";

export function TablaFacturacion({ data }: { data: AdminFarmaciasResponse }) {
  return <div className="text-sm text-muted-foreground">Deuda red: ${data.totales.deuda_red_usd.toFixed(2)}</div>;
}
