import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cambiarEstadoFarmacia, type AdminFarmaciasResponse, type EstadoAfiliacion, type FarmaciaAdmin } from "@/lib/adminApi";
import { manejarNoAutorizado } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { EditarFarmaciaDrawer } from "@/components/super/EditarFarmaciaDrawer";

const FILTROS: Array<{ value: "todas" | EstadoAfiliacion; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "pendiente", label: "Pendientes" },
  { value: "activa", label: "Activas" },
  { value: "inactiva", label: "Suspendidas" },
];

const BADGE: Record<EstadoAfiliacion, string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  activa: "bg-emerald-100 text-emerald-800 border-emerald-200",
  inactiva: "bg-rose-100 text-rose-800 border-rose-200",
};

export function TablaFarmacias({
  data, token, onReload,
}: { data: AdminFarmaciasResponse; token: string; onReload: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<"todas" | EstadoAfiliacion>("todas");
  const [editar, setEditar] = useState<FarmaciaAdmin | null>(null);

  const mut = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoAfiliacion }) =>
      cambiarEstadoFarmacia(token, id, estado),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["admin-farmacias"] });
      onReload();
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        toast.error("Tu sesión expiró. Inicia sesión de nuevo.");
        manejarNoAutorizado();
        navigate({ to: "/super/login" });
        return;
      }
      toast.error(e instanceof Error ? e.message : "Error");
    },
  });

  const filas = useMemo(
    () => data.farmacias.filter((f) => filtro === "todas" || f.estado_afiliacion === filtro),
    [data.farmacias, filtro],
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <button key={f.value} onClick={() => setFiltro(f.value)}
            className={`h-8 px-3 rounded-full text-xs font-medium border ${
              filtro === f.value ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Farmacia</th>
              <th className="text-left font-medium px-3 py-2">Sector</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-right font-medium px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <Fila key={f.id} f={f} pending={mut.isPending}
                onEstado={(estado) => mut.mutate({ id: f.id, estado })}
                onEditar={() => setEditar(f)} />
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Sin farmacias en este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <EditarFarmaciaDrawer
        farmacia={editar}
        token={token}
        open={editar !== null}
        onOpenChange={(o) => { if (!o) setEditar(null); }}
        onSaved={() => { onReload(); }}
      />
    </div>
  );
}

function Fila({ f, pending, onEstado, onEditar }: {
  f: FarmaciaAdmin; pending: boolean; onEstado: (e: EstadoAfiliacion) => void; onEditar: () => void;
}) {
  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        <div className="font-medium text-foreground">{f.nombre}</div>
        <div className="text-xs text-muted-foreground">{f.whatsapp}</div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{f.sector}</td>
      <td className="px-3 py-2">
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${BADGE[f.estado_afiliacion]}`}>
          {f.estado_afiliacion}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1.5 justify-end">
          {f.estado_afiliacion === "pendiente" && (
            <>
              <Button size="sm" disabled={pending} onClick={() => onEstado("activa")}>Aprobar</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => onEstado("inactiva")}>Rechazar</Button>
            </>
          )}
          {f.estado_afiliacion === "activa" && (
            <>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => onEstado("inactiva")}>Suspender</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={onEditar}>Editar</Button>
            </>
          )}
          {f.estado_afiliacion === "inactiva" && (
            <>
              <Button size="sm" disabled={pending} onClick={() => onEstado("activa")}>Reactivar</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={onEditar}>Editar</Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
