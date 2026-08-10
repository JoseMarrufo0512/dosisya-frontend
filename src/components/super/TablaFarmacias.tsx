import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { cambiarEstadoFarmacia, requiereUbicacionAntesDeActivar, type AdminFarmaciasResponse, type EstadoAfiliacion, type FarmaciaAdmin } from "@/lib/adminApi";
import { manejarNoAutorizado } from "@/lib/adminAuth";
import { parsearParCoordenadas } from "@/lib/coordenadas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampoUbicacion } from "@/components/panel/CampoUbicacion";
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
  // Farmacia a la que se le pedirán coordenadas antes de activarla.
  const [aprobando, setAprobando] = useState<FarmaciaAdmin | null>(null);

  const mut = useMutation({
    mutationFn: ({
      id,
      estado,
      coords,
    }: {
      id: string;
      estado: EstadoAfiliacion;
      coords?: { lat: number; lng: number };
    }) => cambiarEstadoFarmacia(token, id, estado, coords),
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

  const sinUbicacion =
    data.totales.sin_ubicacion ??
    data.farmacias.filter((f) => f.ubicacion_configurada === false).length;

  return (
    <div className="space-y-4">
      {sinUbicacion > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
          <p className="text-xs text-amber-900">
            <strong>
              {sinUbicacion} {sinUbicacion === 1 ? "farmacia" : "farmacias"} sin ubicación.
            </strong>{" "}
            Aunque las apruebes no aparecerán en el buscador: los pacientes buscan por cercanía y
            estas farmacias no tienen coordenadas.
          </p>
        </div>
      )}

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
                onEstado={(estado) => {
                  // Activar una farmacia sin coordenadas la deja invisible en
                  // el buscador: se piden antes en vez de aprobar a ciegas.
                  if (requiereUbicacionAntesDeActivar(f, estado)) {
                    setAprobando(f);
                    return;
                  }
                  mut.mutate({ id: f.id, estado });
                }}
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

      <DialogoAprobarSinUbicacion
        farmacia={aprobando}
        pending={mut.isPending}
        onCancelar={() => setAprobando(null)}
        onConfirmar={(coords) => {
          if (!aprobando) return;
          mut.mutate({ id: aprobando.id, estado: "activa", coords });
          setAprobando(null);
        }}
      />
    </div>
  );
}

/**
 * Aprobar una farmacia que sigue en (0,0) la deja activa pero invisible en el
 * buscador. En vez de bloquear la aprobación —a veces el superadmin no tiene
 * las coordenadas a mano— se le muestra la consecuencia y se le deja decidir.
 *
 * Sin botón de GPS a propósito: el superadmin aprueba desde su escritorio, así
 * que su posición no es la de la farmacia.
 */
function DialogoAprobarSinUbicacion({
  farmacia,
  pending,
  onCancelar,
  onConfirmar,
}: {
  farmacia: FarmaciaAdmin | null;
  pending: boolean;
  onCancelar: () => void;
  onConfirmar: (coords?: { lat: number; lng: number }) => void;
}) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});

  // Limpiar al cambiar de farmacia para no arrastrar las coordenadas de otra.
  useEffect(() => {
    setLat("");
    setLng("");
    setErrores({});
  }, [farmacia?.id]);

  const confirmarConUbicacion = () => {
    const res = parsearParCoordenadas(lat, lng);
    if (res.estado === "error") {
      setErrores(res.errores);
      return;
    }
    if (res.estado === "ausente") {
      setErrores({ lat: "Escribe las coordenadas o aprueba sin ubicar" });
      return;
    }
    setErrores({});
    onConfirmar(res.coords);
  };

  return (
    <Dialog open={farmacia !== null} onOpenChange={(o) => { if (!o) onCancelar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubicar «{farmacia?.nombre}» antes de aprobar</DialogTitle>
          <DialogDescription>
            Esta farmacia no tiene coordenadas. Si la apruebas así quedará activa, pero su
            inventario no aparecerá en ninguna búsqueda porque los pacientes buscan por cercanía.
          </DialogDescription>
        </DialogHeader>

        <CampoUbicacion
          idPrefix="aprobar"
          lat={lat}
          lng={lng}
          onLatChange={setLat}
          onLngChange={setLng}
          errorLat={errores.lat}
          errorLng={errores.lng}
          mostrarGps={false}
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => onConfirmar(undefined)}>
            Aprobar sin ubicar
          </Button>
          <Button disabled={pending} onClick={confirmarConUbicacion}>
            Ubicar y aprobar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${BADGE[f.estado_afiliacion]}`}>
            {f.estado_afiliacion}
          </span>
          {f.ubicacion_configurada === false && (
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200"
              title="Sin coordenadas: no aparece en el buscador"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> sin ubicación
            </span>
          )}
        </div>
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
