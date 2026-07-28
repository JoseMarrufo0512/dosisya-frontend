import type { AdminFarmaciasResponse } from "@/lib/adminApi";

export function TablaFacturacion({ data }: { data: AdminFarmaciasResponse }) {
  const { farmacias, totales } = data;
  const conDeuda = [...farmacias].sort((a, b) => b.deuda_usd - a.deuda_usd);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Farmacias" value={totales.total_farmacias.toString()} />
        <Kpi label="Pendientes" value={totales.pendientes.toString()} />
        <Kpi label="Leads del mes (red)" value={totales.leads_mes_red.toString()} />
        <Kpi label="Deuda red (USD)" value={`$${totales.deuda_red_usd.toFixed(2)}`} />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Farmacia</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-right font-medium px-3 py-2">Leads mes</th>
              <th className="text-right font-medium px-3 py-2">Deuda (USD)</th>
            </tr>
          </thead>
          <tbody>
            {conDeuda.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-2 font-medium text-foreground">{f.nombre}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.estado_afiliacion}</td>
                <td className="px-3 py-2 text-right">{f.leads_mes}</td>
                <td className="px-3 py-2 text-right font-semibold">${f.deuda_usd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold text-foreground mt-1">{value}</div>
    </div>
  );
}
