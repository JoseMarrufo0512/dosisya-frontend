import { useCallback, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Camera,
  ScanLine,
  Sparkles,
  Plus,
  CheckCircle2,
  RotateCcw,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Trash2,
} from "lucide-react";
import { useListaMedica } from "@/hooks/useListaMedica";
import { analizarRecipe, validarImagen, type MedicamentoRecetaUI } from "@/lib/recipeIA";

// ─────────────────────────────────────────────────────────────────────────────
// EscanerRecipe — Drawer que cubre todo el flujo de escaneo de récipe médico.
//
// Estados: idle → scanning → results | error
//
// Spec: docs/features/receta-ia-y-carrito.md, Flujo 2
// Regla #5 CLAUDE.md: la imagen va al backend, nunca a Gemini desde React.
// ─────────────────────────────────────────────────────────────────────────────

type Estado = "idle" | "scanning" | "results" | "error";

interface EscanerRecipeProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
}

export function EscanerRecipe({ abierto, onOpenChange }: EscanerRecipeProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultados, setResultados] = useState<MedicamentoRecetaUI[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const { agregar, estaEnLista } = useListaMedica();

  // Resetear al abrir
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setEstado("idle");
        setPreviewUrl(null);
        setResultados([]);
        setErrorMsg("");
        setExpandidos(new Set());
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );

  // ── Procesamiento de imagen ──────────────────────────────────────────────

  const procesarImagen = useCallback(async (file: File) => {
    const error = validarImagen(file);
    if (error) {
      toast.error(error);
      return;
    }

    // Preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setEstado("scanning");

    try {
      const respuesta = await analizarRecipe(file);

      if (respuesta.status === "success" && respuesta.data && respuesta.data.length > 0) {
        const conId: MedicamentoRecetaUI[] = respuesta.data.map((med) => ({
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
    setExpandidos(new Set());
  };

  // ── Añadir a lista ───────────────────────────────────────────────────────

  const handleAgregarMedicamento = (nombre: string, cantidad: string) => {
    // Usamos el nombre como ID temporal — el SelectorFarmacia buscará por nombre
    const item = agregar({
      medicamentoId: `recipe-${nombre.toLowerCase().replace(/\s+/g, "-")}`,
      nombre,
      presentacion: cantidad || "según récipe",
      origen: "escaner_recipe",
    });
    toast.success(`${nombre} añadido a tu lista`, {
      description:
        item.cantidad > 1 ? `Cantidad: ${item.cantidad}` : "Elige farmacia cuando termines",
      style: { background: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0" },
    });
  };

  const handleAgregarTodos = () => {
    let añadidos = 0;
    for (const med of resultados) {
      // Añadir el medicamento original
      agregar({
        medicamentoId: `recipe-${med.medicamento.toLowerCase().replace(/\s+/g, "-")}`,
        nombre: med.medicamento,
        presentacion: med.cantidad || "según récipe",
        origen: "escaner_recipe",
      });
      añadidos++;
    }
    toast.success(`${añadidos} medicamentos añadidos a tu lista`, {
      style: { background: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0" },
    });
  };

  // ── Quitar medicamento ───────────────────────────────────────────────────

  const quitarMedicamento = (id: string) => {
    setResultados((prev) => prev.filter((m) => m.id !== id));
  };

  // ── Toggle alternativas ──────────────────────────────────────────────────

  const toggleAlternativas = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Helpers de UI ────────────────────────────────────────────────────────

  /** Genera ID consistente para verificar si ya está en lista */
  const recipeId = (nombre: string) => `recipe-${nombre.toLowerCase().replace(/\s+/g, "-")}`;

  const totalMedicamentos = useMemo(() => resultados.length, [resultados]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Drawer.Root open={abierto} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-background outline-none"
          aria-describedby={undefined}
        >
          {/* Asa del drawer */}
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />

          <AnimatePresence mode="wait">
            {/* ── IDLE: captura ─────────────────────────────────────── */}
            {estado === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
              >
                <Drawer.Title className="text-lg font-bold text-foreground">
                  Escanear récipe médico
                </Drawer.Title>
                <p className="text-xs text-muted-foreground mb-5">
                  Toma una foto clara y la IA extraerá los medicamentos.
                </p>

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Zona de captura */}
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
                    <p className="font-semibold text-foreground">Toma una foto de tu récipe</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      o selecciona una imagen de tu galería
                    </p>
                  </div>
                </button>

                <p className="mt-4 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                  Funciona con letra de médico — nuestra IA se encarga
                </p>
              </motion.div>
            )}

            {/* ── SCANNING: overlay de escaneo ──────────────────────── */}
            {estado === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
              >
                <Drawer.Title className="sr-only">Analizando récipe</Drawer.Title>

                {/* Preview de la imagen con overlay de escaneo */}
                <div className="relative mt-2 w-full max-w-sm overflow-hidden rounded-2xl">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Récipe capturado"
                      className="h-64 w-full object-cover"
                      style={{ filter: "blur(1.5px) brightness(0.85)" }}
                    />
                  )}
                  {/* Línea de escaneo láser animada */}
                  <div className="absolute inset-0">
                    <div className="animate-scan-line absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                  </div>
                  {/* Esquinas decorativas */}
                  <div className="absolute left-3 top-3 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-emerald-400" />
                  <div className="absolute right-3 top-3 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-emerald-400" />
                  <div className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute bottom-3 right-3 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-emerald-400" />
                </div>

                {/* Texto de estado */}
                <div className="mt-6 flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-500 animate-pulse" />
                    <p className="font-semibold text-foreground">
                      La IA está descifrando la letra del médico...
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos</p>
                </div>

                {/* Barra de progreso indeterminada */}
                <div className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-emerald-100">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-emerald-500"
                    animate={{ x: ["-100%", "400%"] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* ── RESULTS: medicamentos extraídos ──────────────────── */}
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
                    {totalMedicamentos} medicamento{totalMedicamentos !== 1 ? "s" : ""} detectado
                    {totalMedicamentos !== 1 ? "s" : ""}
                  </Drawer.Title>
                  <p className="text-xs text-muted-foreground">
                    Añádelos a tu lista y elige farmacia después.
                  </p>
                </div>

                {/* Lista scrollable */}
                <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5">
                  {resultados.map((med) => {
                    const enLista = estaEnLista(recipeId(med.medicamento));
                    const altExpandidas = expandidos.has(med.id);

                    return (
                      <li key={med.id} className="py-3.5">
                        {/* Medicamento original */}
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{med.medicamento}</p>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                📋 Receta
                              </span>
                            </div>
                            {med.cantidad && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Cantidad: {med.cantidad}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => quitarMedicamento(med.id)}
                              aria-label={`Quitar ${med.medicamento} de los resultados`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAgregarMedicamento(med.medicamento, med.cantidad)}
                              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
                                enLista
                                  ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "bg-primary text-primary-foreground hover:opacity-90"
                              }`}
                            >
                              {enLista ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  En lista
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" />
                                  Añadir
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Alternativas */}
                        {med.alternativas.length > 0 && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => toggleAlternativas(med.id)}
                              className="flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800 transition-colors"
                            >
                              {altExpandidas ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                              {med.alternativas.length} alternativa
                              {med.alternativas.length !== 1 ? "s" : ""} sugerida
                              {med.alternativas.length !== 1 ? "s" : ""} por IA
                            </button>

                            <AnimatePresence>
                              {altExpandidas && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-2 space-y-2 rounded-xl bg-sky-50/60 p-3">
                                    {med.alternativas.map((alt) => {
                                      const altEnLista = estaEnLista(recipeId(alt));
                                      return (
                                        <div
                                          key={alt}
                                          className="flex items-center justify-between"
                                        >
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm text-foreground">{alt}</p>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                                              🤖 Alternativa IA
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleAgregarMedicamento(alt, "")}
                                            className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all active:scale-[0.97] ${
                                              altEnLista
                                                ? "text-emerald-700"
                                                : "text-sky-700 hover:bg-sky-100"
                                            }`}
                                          >
                                            {altEnLista ? (
                                              <CheckCircle2 className="h-3 w-3" />
                                            ) : (
                                              <Plus className="h-3 w-3" />
                                            )}
                                            {altEnLista ? "Añadido" : "Añadir"}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {/* Acciones inferiores */}
                <div className="shrink-0 space-y-2 border-t border-border px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                  <button
                    type="button"
                    onClick={handleAgregarTodos}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99]"
                  >
                    <Plus className="h-5 w-5" />
                    Añadir todos a mi lista
                  </button>
                  <button
                    type="button"
                    onClick={volverAIdle}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Escanear otro récipe
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── ERROR: fallback amigable ──────────────────────────── */}
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

                <p className="mt-4 font-semibold text-foreground">No pudimos leer tu récipe</p>
                <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{errorMsg}</p>

                <div className="mt-6 w-full space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Cerrar escáner y dejar que el usuario use la lista directamente.
                      // La foto se puede adjuntar manualmente desde WhatsApp.
                      onOpenChange(false);
                      toast.info(
                        "Puedes enviar la foto directamente a la farmacia por WhatsApp desde tu galería.",
                        { duration: 6000 },
                      );
                    }}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99]"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Enviar foto por WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={volverAIdle}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
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
