import { useCallback, useRef, useState } from "react";
import { Drawer } from "vaul";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Camera,
  ScanLine,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  ImageOff,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import {
  analizarRecipeFarmacia,
  validarImagen,
  type MedicamentoRecetaFarmaciaUI,
} from "@/lib/recipeIAFarmacia";

// ─────────────────────────────────────────────────────────────────────────────
// EscanerRecipeFarmacia — modo farmacéutico del escáner de récipe, dentro del
// panel B2B (sección "Mi Inventario"). Extrae campos técnicos de dispensación
// (nunca datos de paciente/médico) y los cruza contra el inventario propio de
// la farmacia, ya cargado por el dashboard.
//
// Estados: idle → scanning → results | error
//
// Spec: docs/superpowers/specs/2026-08-05-modo-farmaceutico-escaner-recipe-design.md
// Regla #5 CLAUDE.md: la imagen va al backend, nunca a un proveedor de IA desde React.
// ─────────────────────────────────────────────────────────────────────────────

type Estado = "idle" | "scanning" | "results" | "error";

type ItemInventario = {
  nombre: string;
  stock?: boolean;
  precio_usd?: number;
};

interface EscanerRecipeFarmaciaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  inventario: ItemInventario[];
}

const CAMPOS_TECNICOS = [
  "concentracion_mg",
  "forma_farmaceutica",
  "cantidad_total_unidades",
  "posologia_detallada",
  "via_administracion",
] as const;

const CAMPOS_EDITABLES = [
  ["nombre_comercial", "Nombre comercial"],
  ["principio_activo", "Principio activo"],
  ["concentracion_mg", "Concentración"],
  ["forma_farmaceutica", "Forma farmacéutica"],
  ["cantidad_total_unidades", "Cantidad"],
  ["posologia_detallada", "Posología"],
  ["via_administracion", "Vía de administración"],
] as const;

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function tieneIlegibles(med: MedicamentoRecetaFarmaciaUI): boolean {
  if (med.principio_activo === "ilegible") return true;
  return CAMPOS_TECNICOS.some((campo) => med[campo] === "ilegible");
}

function estadoInventario(
  principioActivo: string,
  inventario: ItemInventario[],
): { texto: string; tono: "verde" | "ambar" | "gris" } {
  const buscado = normalizar(principioActivo);
  const match = inventario.find((it) => normalizar(it.nombre) === buscado);
  if (!match) return { texto: "No está en tu inventario", tono: "gris" };
  if (match.stock) {
    return { texto: `En stock — $${(match.precio_usd ?? 0).toFixed(2)}`, tono: "verde" };
  }
  return { texto: "Sin stock", tono: "ambar" };
}

const TONO_BADGE: Record<"verde" | "ambar" | "gris", { color: string; bg: string }> = {
  verde: { color: "#065f46", bg: "#ecfdf5" },
  ambar: { color: "#92400e", bg: "#fffbeb" },
  gris: { color: "#4b5563", bg: "#f3f4f6" },
};

export function EscanerRecipeFarmacia({
  abierto,
  onOpenChange,
  inventario,
}: EscanerRecipeFarmaciaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultados, setResultados] = useState<MedicamentoRecetaFarmaciaUI[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<MedicamentoRecetaFarmaciaUI | null>(null);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setEstado("idle");
        setPreviewUrl(null);
        setResultados([]);
        setErrorMsg("");
        setEditandoId(null);
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );

  const procesarImagen = useCallback(async (file: File) => {
    const error = validarImagen(file);
    if (error) {
      toast.error(error);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setEstado("scanning");

    try {
      const respuesta = await analizarRecipeFarmacia(file);

      if (respuesta.status === "success" && respuesta.data && respuesta.data.length > 0) {
        const conId: MedicamentoRecetaFarmaciaUI[] = respuesta.data.map((med) => ({
          ...med,
          id: crypto.randomUUID(),
        }));
        setResultados(conId);
        setEstado("results");
      } else {
        setErrorMsg(respuesta.message || "No pudimos leer los medicamentos del récipe.");
        setEstado("error");
      }
    } catch {
      setErrorMsg("Error inesperado al analizar el récipe.");
      setEstado("error");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void procesarImagen(file);
    e.target.value = "";
  };

  const volverAIdle = () => {
    setEstado("idle");
    setPreviewUrl(null);
    setResultados([]);
    setErrorMsg("");
    setEditandoId(null);
  };

  const iniciarEdicion = (med: MedicamentoRecetaFarmaciaUI) => {
    setEditandoId(med.id);
    setBorrador({ ...med });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setBorrador(null);
  };

  const guardarEdicion = () => {
    if (!borrador) return;
    setResultados((prev) => prev.map((m) => (m.id === borrador.id ? borrador : m)));
    setEditandoId(null);
    setBorrador(null);
  };

  return (
    <Drawer.Root open={abierto} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-background outline-none"
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />

          <AnimatePresence mode="wait">
            {estado === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
              >
                <Drawer.Title className="text-lg font-bold text-foreground">
                  Escanear récipe (modo farmacéutico)
                </Drawer.Title>
                <p className="text-xs text-muted-foreground mb-5">
                  Extrae los datos técnicos para dispensar y los cruza con tu inventario.
                </p>

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-6 py-12 transition-colors hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.99]"
                >
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <Camera className="h-8 w-8" />
                    </div>
                    <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <ScanLine className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">Toma una foto del récipe</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      o selecciona una imagen de tu galería
                    </p>
                  </div>
                </button>
              </motion.div>
            )}

            {estado === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
              >
                <Drawer.Title className="sr-only">Analizando récipe</Drawer.Title>
                <div className="relative mt-2 w-full max-w-sm overflow-hidden rounded-2xl">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Récipe capturado"
                      className="h-64 w-full object-cover"
                      style={{ filter: "blur(1.5px) brightness(0.85)" }}
                    />
                  )}
                  <div className="absolute inset-0">
                    <div className="animate-scan-line absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                  </div>
                </div>
                <div className="mt-6 flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-500 animate-pulse" />
                    <p className="font-semibold text-foreground">Extrayendo datos técnicos...</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos</p>
                </div>
              </motion.div>
            )}

            {estado === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex min-h-0 flex-col"
              >
                <div className="shrink-0 px-5 pb-2 pt-3">
                  <Drawer.Title className="text-lg font-bold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    {resultados.length} medicamento{resultados.length !== 1 ? "s" : ""} detectado
                    {resultados.length !== 1 ? "s" : ""}
                  </Drawer.Title>
                  <p className="text-xs text-muted-foreground">
                    Corrige los campos marcados como ilegibles antes de dispensar.
                  </p>
                </div>

                <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5">
                  {resultados.map((med) => {
                    const ilegible = tieneIlegibles(med);
                    const inv = estadoInventario(med.principio_activo, inventario);
                    const badge = TONO_BADGE[inv.tono];

                    return (
                      <li key={med.id} className="py-3.5">
                        {editandoId === med.id && borrador ? (
                          <div className="rounded-xl bg-sky-50/60 p-3 space-y-2">
                            {CAMPOS_EDITABLES.map(([campo, etiqueta]) => (
                              <div key={campo}>
                                <label
                                  className="text-xs font-medium text-muted-foreground"
                                  htmlFor={`${campo}-${med.id}`}
                                >
                                  {etiqueta}
                                </label>
                                <input
                                  id={`${campo}-${med.id}`}
                                  type="text"
                                  value={borrador[campo] === "ilegible" ? "" : borrador[campo]}
                                  placeholder="ilegible — escribe el valor correcto"
                                  onChange={(e) =>
                                    setBorrador({ ...borrador, [campo]: e.target.value })
                                  }
                                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                />
                              </div>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={guardarEdicion}
                                disabled={!borrador.principio_activo.trim()}
                                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicion}
                                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`rounded-xl p-3 ${ilegible ? "border border-amber-300 bg-amber-50/60" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-foreground">
                                    {med.principio_activo}
                                  </p>
                                  {med.nombre_comercial && (
                                    <span className="text-xs text-muted-foreground">
                                      ({med.nombre_comercial})
                                    </span>
                                  )}
                                  {ilegible && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                      <AlertTriangle className="h-3 w-3" /> Revisar
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {med.concentracion_mg} · {med.forma_farmaceutica} ·{" "}
                                  {med.cantidad_total_unidades}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {med.posologia_detallada} · vía {med.via_administracion}
                                </p>
                                <span
                                  className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                                  style={{ color: badge.color, background: badge.bg }}
                                >
                                  {inv.texto}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => iniciarEdicion(med)}
                                aria-label={`Editar ${med.principio_activo}`}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-sky-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="shrink-0 space-y-2 border-t border-border px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                  <button
                    type="button"
                    onClick={volverAIdle}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Escanear otro récipe
                  </button>
                </div>
              </motion.div>
            )}

            {estado === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 text-center"
              >
                <Drawer.Title className="sr-only">Error al analizar récipe</Drawer.Title>
                <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                  <ImageOff className="h-8 w-8" />
                </div>
                <p className="mt-4 font-semibold text-foreground">No pudimos leer el récipe</p>
                <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{errorMsg}</p>
                <div className="mt-6 w-full">
                  <button
                    type="button"
                    onClick={volverAIdle}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Intentar de nuevo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
