import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  cambiarEstadoFarmacia,
  faltaHabilitacion,
  requiereUbicacionAntesDeActivar,
  type AdminFarmaciasResponse,
  type EstadoAfiliacion,
  type FarmaciaAdmin,
} from "@/lib/adminApi";
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
  data,
  onReload,
}: {
  data: AdminFarmaciasResponse;
  onReload: () => void;
}) {
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
      verificaciones,
    }: {
      id: string;
      estado: EstadoAfiliacion;
      coords?: { lat: number; lng: number };
      verificaciones?: { verificacion_regente: boolean; verificacion_sacs: boolean };
    }) => cambiarEstadoFarmacia(id, estado, coords, verificaciones),
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

  const sinUbicacion = useMemo(
    () =>
      data.totales.sin_ubicacion ??
      data.farmacias.filter((f) => f.ubicacion_configurada === false).length,
    [data.totales.sin_ubicacion, data.farmacias],
  );

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
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`h-8 px-3 rounded-full text-xs font-medium border ${
              filtro === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent"
            }`}
          >
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
              <Fila
                key={f.id}
                f={f}
                pending={mut.isPending}
                onEstado={(estado) => {
                  // Toda aprobación pasa por el diálogo: ahí viven las dos
                  // confirmaciones de habilitación (hallazgo B-02) y el aviso de
                  // ubicación. Suspender o devolver a pendiente nunca se bloquea
                  // ni pide nada, así que muta directo.
                  if (estado === "activa") {
                    setAprobando(f);
                    return;
                  }
                  mut.mutate({ id: f.id, estado });
                }}
                onEditar={() => setEditar(f)}
              />
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Sin farmacias en este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EditarFarmaciaDrawer
        farmacia={editar}
        open={editar !== null}
        onOpenChange={(o) => {
          if (!o) setEditar(null);
        }}
        onSaved={() => {
          onReload();
        }}
      />

      <DialogoAprobar
        farmacia={aprobando}
        pending={mut.isPending}
        onCancelar={() => setAprobando(null)}
        onConfirmar={(coords, verificaciones) => {
          if (!aprobando) return;
          // Cerrar solo si la mutación tiene éxito: closearlo antes (como antes)
          // hacía que el useEffect de "cambió de farmacia" limpiara lat/lng al
          // instante, así que un PATCH fallido perdía lo que el superadmin
          // acababa de escribir. mut.onError ya muestra el toast de error; el
          // diálogo se queda abierto con los campos intactos para reintentar.
          mut.mutate(
            { id: aprobando.id, estado: "activa", coords, verificaciones },
            { onSuccess: () => setAprobando(null) },
          );
        }}
      />
    </div>
  );
}

/**
 * Diálogo de aprobación (hallazgo B-02). Aprobar deja de ser un botón: exige
 * dos confirmaciones separadas (colegiatura del regente y autorización del
 * SACS) y se bloquea si faltan datos de habilitación o si el regente ya figura
 * en otra farmacia activa. El backend reimpone las tres cosas (422/409/422); el
 * diálogo es para que el superadmin no choque contra el error a ciegas.
 *
 * Además, si la farmacia sigue sin coordenadas, ofrece ubicarla en el mismo
 * gesto: aprobarla en (0,0) la dejaría activa pero invisible en el buscador.
 *
 * Sin botón de GPS a propósito: el superadmin aprueba desde su escritorio, así
 * que su posición no es la de la farmacia.
 */
function DialogoAprobar({
  farmacia,
  pending,
  onCancelar,
  onConfirmar,
}: {
  farmacia: FarmaciaAdmin | null;
  pending: boolean;
  onCancelar: () => void;
  onConfirmar: (
    coords?: { lat: number; lng: number },
    verificaciones?: { verificacion_regente: boolean; verificacion_sacs: boolean },
  ) => void;
}) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [verifRegente, setVerifRegente] = useState(false);
  const [verifSacs, setVerifSacs] = useState(false);

  // Limpiar al cambiar de farmacia para no arrastrar datos de otra.
  useEffect(() => {
    setLat("");
    setLng("");
    setErrores({});
    setVerifRegente(false);
    setVerifSacs(false);
  }, [farmacia?.id]);

  const sinUbicacion = farmacia ? requiereUbicacionAntesDeActivar(farmacia, "activa") : false;
  const faltanDatos = faltaHabilitacion("activa", farmacia ?? {});
  const conflicto = farmacia?.conflicto_regente ?? null;
  // Los dos bloqueos duros (falta de datos, conflicto) no se pueden saltar: el
  // backend los rechaza igual. Las confirmaciones son del superadmin.
  const noSePuedeAprobar = faltanDatos || Boolean(conflicto) || !verifRegente || !verifSacs;
  const verificaciones = { verificacion_regente: verifRegente, verificacion_sacs: verifSacs };

  const confirmarConUbicacion = () => {
    const res = parsearParCoordenadas(lat, lng);
    if (res.estado === "error") {
      setErrores(res.errores);
      return;
    }
    if (res.estado === "ausente") {
      // Los dos campos están igual de vacíos: marcar solo `lat` dejaba
      // Longitud sin resaltar, como si únicamente Latitud fuera obligatoria.
      const mensaje = "Escribe las coordenadas o aprueba sin ubicar";
      setErrores({ lat: mensaje, lng: mensaje });
      return;
    }
    setErrores({});
    onConfirmar(res.coords, verificaciones);
  };

  return (
    <Dialog
      open={farmacia !== null}
      onOpenChange={(o) => {
        if (!o) onCancelar();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aprobar «{farmacia?.nombre}»</DialogTitle>
          <DialogDescription>
            Antes de publicar la farmacia, verifica su habilitación sanitaria.
          </DialogDescription>
        </DialogHeader>

        {conflicto && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            El regente ya figura en <strong>{conflicto}</strong>, que está activa. Ninguna persona
            puede ser regente de más de un establecimiento: suspende esa antes de aprobar esta.
          </p>
        )}

        {faltanDatos && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Faltan datos de habilitación (regente o permiso del SACS). La farmacia debe
            completarlos en su panel antes de que puedas aprobarla.
          </p>
        )}

        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={verifRegente}
              onChange={(e) => setVerifRegente(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>Contrasté la colegiatura del regente contra el Colegio de Farmacéuticos.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={verifSacs}
              onChange={(e) => setVerifSacs(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>Verifiqué la autorización de funcionamiento del SACS.</span>
          </label>
        </div>

        {sinUbicacion && (
          <div className="space-y-2">
            <p className="text-xs text-amber-700">
              Sin coordenadas la farmacia queda activa pero invisible en el buscador. Ubícala ahora
              o apruébala sin ubicar.
            </p>
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
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {sinUbicacion ? (
            <>
              <Button
                variant="ghost"
                disabled={pending || noSePuedeAprobar}
                onClick={() => onConfirmar(undefined, verificaciones)}
              >
                Aprobar sin ubicar
              </Button>
              <Button disabled={pending || noSePuedeAprobar} onClick={confirmarConUbicacion}>
                Ubicar y aprobar
              </Button>
            </>
          ) : (
            <Button
              disabled={pending || noSePuedeAprobar}
              onClick={() => onConfirmar(undefined, verificaciones)}
            >
              Aprobar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fila({
  f,
  pending,
  onEstado,
  onEditar,
}: {
  f: FarmaciaAdmin;
  pending: boolean;
  onEstado: (e: EstadoAfiliacion) => void;
  onEditar: () => void;
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
          <span
            className={`inline-block text-xs px-2 py-0.5 rounded-full border ${BADGE[f.estado_afiliacion]}`}
          >
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
          {/* Habilitación sanitaria (hallazgo B-02). El conflicto va en rojo y la
              falta de datos en ámbar: uno es un bloqueo que exige resolver algo en
              el mundo real, el otro es un dato que falta. */}
          {f.habilitacion_completa === false && (
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200"
              title="Faltan datos de regente o permiso del SACS: no puede publicarse"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> sin habilitación
            </span>
          )}
          {f.conflicto_regente && (
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-800 border-red-200"
              title={`El regente ya figura en ${f.conflicto_regente}`}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> regente duplicado
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1.5 justify-end">
          {f.estado_afiliacion === "pendiente" && (
            <>
              <Button size="sm" disabled={pending} onClick={() => onEstado("activa")}>
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onEstado("inactiva")}
              >
                Rechazar
              </Button>
            </>
          )}
          {f.estado_afiliacion === "activa" && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onEstado("inactiva")}
              >
                Suspender
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={onEditar}>
                Editar
              </Button>
            </>
          )}
          {f.estado_afiliacion === "inactiva" && (
            <>
              <Button size="sm" disabled={pending} onClick={() => onEstado("activa")}>
                Reactivar
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={onEditar}>
                Editar
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
