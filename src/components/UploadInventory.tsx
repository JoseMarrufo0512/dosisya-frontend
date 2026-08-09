import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Sparkles, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "@/lib/api";

const ACCEPTED_EXT = [".csv", ".xlsx"];
const ACCEPTED_MIME = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

type Props = {
  onUploaded?: (data: unknown) => void;
};

/** Eventos del stream NDJSON de POST .../inventario/upload. */
type EventoUpload =
  | { tipo: "inicio"; archivo: string; filas_en_archivo: number }
  | { tipo: "progreso"; lotes_listos: number; lotes_total: number; medicamentos: number }
  | { tipo: "guardando"; medicamentos: number }
  | { tipo: "resultado"; status: string; message: string; data: Record<string, unknown> }
  | { tipo: "error"; codigo: number; mensaje: string };

type Progreso = { listos: number; total: number; medicamentos: number };

/**
 * Lee un cuerpo NDJSON y entrega un evento por línea a medida que llegan.
 *
 * No se puede usar `res.json()`: eso espera al final del stream, que es
 * justo lo que hace que la farmacia crea que la página se colgó.
 */
async function* leerEventos(res: Response): AsyncGenerator<EventoUpload> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("El navegador no pudo leer la respuesta del servidor.");

  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // La última porción puede ser una línea incompleta: se deja en el buffer.
    const lineas = buffer.split("\n");
    buffer = lineas.pop() ?? "";
    for (const linea of lineas) {
      if (linea.trim()) yield JSON.parse(linea) as EventoUpload;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as EventoUpload;
}

export function UploadInventory({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<Progreso | null>(null);

  const validate = (file: File) => {
    const lower = file.name.toLowerCase();
    const okExt = ACCEPTED_EXT.some((e) => lower.endsWith(e));
    const okMime = ACCEPTED_MIME.includes(file.type) || okExt;
    if (!okExt || !okMime) {
      toast.error("Solo se aceptan archivos .csv o .xlsx");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande (máx. 10MB)");
      return false;
    }
    return true;
  };

  const upload = useCallback(
    async (file: File) => {
      if (!validate(file)) return;

      const farmaciaId = localStorage.getItem("farmacia_id");
      const token = localStorage.getItem("auth_token");

      if (!farmaciaId || !token) {
        toast.error("Sesión expirada. Inicia sesión de nuevo.");
        return;
      }

      setFileName(file.name);
      setUploading(true);
      setSuccess(false);
      setProgreso(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API_BASE}/api/v1/farmacias/${farmaciaId}/inventario/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        // Los fallos de validación (auth, formato, tamaño) siguen llegando
        // como código HTTP; los de IA/BD viajan dentro del stream.
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `Error ${res.status}`);
        }

        let payload: Record<string, unknown> | null = null;

        for await (const ev of leerEventos(res)) {
          if (ev.tipo === "progreso") {
            setProgreso({
              listos: ev.lotes_listos,
              total: ev.lotes_total,
              medicamentos: ev.medicamentos,
            });
          } else if (ev.tipo === "guardando") {
            setProgreso({ listos: 0, total: 0, medicamentos: ev.medicamentos });
          } else if (ev.tipo === "error") {
            throw new Error(ev.mensaje);
          } else if (ev.tipo === "resultado") {
            payload = ev.data;
          }
        }

        if (!payload) {
          // El stream se cortó antes del evento final (red caída, deploy a
          // mitad de camino...). Callar sería peor: la farmacia no sabría si
          // su inventario quedó guardado.
          throw new Error(
            "La conexión se interrumpió antes de terminar. Revisa tu inventario y vuelve a intentarlo.",
          );
        }

        setSuccess(true);
        // Si el backend truncó el archivo (demasiado grande), avisar en vez de
        // celebrar un éxito total — la farmacia no subió todo su inventario.
        if (payload.truncado) {
          toast.warning(
            "Subimos solo una parte: el archivo era muy grande. Divídelo y sube el resto.",
          );
        } else {
          toast.success("¡Inventario actualizado con éxito!");
        }
        onUploaded?.(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error subiendo el archivo";
        toast.error(msg);
      } finally {
        setUploading(false);
        setProgreso(null);
      }
    },
    [onUploaded],
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_-12px_rgba(22,24,26,0.12)]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Subir archivo de inventario"
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-colors p-8 sm:p-10 flex flex-col items-center justify-center text-center min-h-[220px] ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/40"
        } ${uploading ? "pointer-events-none opacity-90" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />

        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <Sparkles className="h-4 w-4 text-primary absolute -top-1 -right-1" />
              </div>
              <div className="w-full max-w-xs">
                <div className="font-semibold text-foreground">
                  {progreso && progreso.total === 0
                    ? "Guardando en tu inventario..."
                    : "La Inteligencia Artificial está procesando tu inventario..."}
                </div>

                {progreso && progreso.total > 0 ? (
                  <div className="mt-3" aria-live="polite">
                    <div
                      className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
                      role="progressbar"
                      aria-valuenow={progreso.listos}
                      aria-valuemin={0}
                      aria-valuemax={progreso.total}
                      aria-label="Progreso del procesamiento del inventario"
                    >
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(progreso.listos / progreso.total) * 100}%`,
                        }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Lote {progreso.listos} de {progreso.total} · {progreso.medicamentos}{" "}
                      medicamentos
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1">
                    Puede tardar un par de minutos si el inventario es grande. No cierres esta
                    pestaña.
                  </div>
                )}

                {fileName ? (
                  <div className="text-[11px] text-muted-foreground mt-1 truncate">{fileName}</div>
                ) : null}
              </div>
            </motion.div>
          ) : success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <CheckCircle2 className="h-10 w-10 text-[#0f7c3a]" />
              <div className="font-semibold text-foreground">¡Inventario actualizado!</div>
              <div className="text-xs text-muted-foreground">
                Suelta otro archivo para volver a actualizar
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Arrastra tu inventario aquí</div>
                <div className="text-xs text-muted-foreground mt-1">
                  o haz clic para seleccionar · acepta .csv y .xlsx
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Nuestra IA lo normaliza automáticamente
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default UploadInventory;
