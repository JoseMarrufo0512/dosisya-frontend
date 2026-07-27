/*
 * MenuMasPaciente — hoja "Más" de la app del paciente y sus sub-hojas.
 *
 * Recreación del handoff (NavegacionInferior.dc.html): el menú "Más" abre
 * Recordatorios de resurtido, Comparar precios, Ayuda y Asistente IA, cada uno
 * como bottom-sheet (vaul), en la identidad verde-cruz.
 *
 * Datos reales:
 *  - Recordatorios: hook local useRecordatorios (localStorage), 100% funcional.
 *  - Ayuda: contenido estático + contacto por WhatsApp.
 *  - Asistente IA: UI lista; la respuesta real necesita endpoint de backend
 *    (aún no existe uno de chat; solo está el de análisis de récipe).
 */

import { useState } from "react";
import { Drawer } from "vaul";
import {
  Bell,
  ArrowLeftRight,
  HelpCircle,
  Sparkles,
  X,
  ChevronRight,
  Plus,
  Trash2,
  Send,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { useRecordatorios } from "@/hooks/useLocalStorage";

const WA_SOPORTE =
  "https://wa.me/584120000000?text=Hola%20DosisYa%2C%20necesito%20ayuda";

type SubHoja = "recordatorios" | "comparar" | "ayuda" | "ia" | null;

export function MenuMasPaciente({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [sub, setSub] = useState<SubHoja>(null);
  const abrir = (s: SubHoja) => {
    onOpenChange(false);
    setSub(s);
  };

  return (
    <>
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Drawer.Content
            className="dosisya-ui fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-3xl outline-none"
            style={{ background: "var(--papel)", padding: "10px 16px 26px" }}
            aria-describedby={undefined}
          >
            <Asa />
            <Drawer.Title
              style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em", padding: "0 2px 6px" }}
            >
              Más opciones
            </Drawer.Title>
            <ItemMenu
              icono={Bell}
              titulo="Recordatorios de resurtido"
              sub="Te avisamos cuando toca reponer"
              onClick={() => abrir("recordatorios")}
            />
            <ItemMenu
              icono={ArrowLeftRight}
              titulo="Comparar precios"
              sub="Mismo medicamento entre farmacias"
              onClick={() => abrir("comparar")}
            />
            <ItemMenu
              icono={HelpCircle}
              titulo="Ayuda"
              sub="Preguntas frecuentes y soporte"
              onClick={() => abrir("ayuda")}
            />
            <div style={{ height: 1, background: "var(--borde)", margin: "6px 8px" }} />
            <ItemMenu
              icono={Sparkles}
              titulo="Asistente IA"
              sub="Pregunta sobre dosis, usos y alternativas"
              destacado
              onClick={() => abrir("ia")}
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <HojaRecordatorios open={sub === "recordatorios"} onClose={() => setSub(null)} />
      <HojaComparar open={sub === "comparar"} onClose={() => setSub(null)} />
      <HojaAyuda open={sub === "ayuda"} onClose={() => setSub(null)} />
      <HojaChatIA open={sub === "ia"} onClose={() => setSub(null)} />
    </>
  );
}

/* ───────────────────────── Sub-hoja: Recordatorios ───────────────────────── */

function HojaRecordatorios({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { recordatorios, agregar, eliminar } = useRecordatorios();
  const [nuevo, setNuevo] = useState("");

  const fmtFecha = (ms: number) =>
    new Date(ms).toLocaleDateString("es-VE", { day: "2-digit", month: "short" });

  const onAgregar = () => {
    const t = nuevo.trim();
    if (!t) return;
    agregar(t);
    setNuevo("");
  };

  return (
    <HojaBase open={open} onClose={onClose} titulo="Recordatorios de resurtido">
      <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 14px" }}>
        Guardamos en este dispositivo cuándo reponer tus medicamentos.
      </p>

      {recordatorios.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "26px 18px",
            background: "var(--blanco)",
            border: "1px dashed var(--borde)",
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--tinta)" }}>Sin recordatorios aún</div>
          <div style={{ fontSize: 12.5, color: "var(--tinta-tenue)", marginTop: 3 }}>
            Agrega un medicamento abajo o desde sus resultados de búsqueda.
          </div>
        </div>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
          {recordatorios.map((r) => (
            <li
              key={r.termino}
              className="flex items-center gap-3"
              style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 14, padding: "13px 14px" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--tinta)", textTransform: "capitalize" }}>
                  {r.termino}
                </div>
                <div className="dy-num" style={{ fontSize: 12, color: "var(--tinta-tenue)", marginTop: 1 }}>
                  Próximo el {fmtFecha(r.proximoMs)}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Eliminar recordatorio de ${r.termino}`}
                onClick={() => eliminar(r.termino)}
                className="dy-foco flex h-9 w-9 items-center justify-center rounded-[10px]"
                style={{ background: "var(--fondo-suave)", border: "1px solid var(--borde)", color: "var(--tinta-tenue)" }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAgregar()}
          placeholder="Nombre del medicamento…"
          aria-label="Nuevo recordatorio"
          className="dy-foco flex-1"
          style={{
            height: 46,
            padding: "0 14px",
            background: "var(--blanco)",
            border: "1px solid var(--borde)",
            borderRadius: 13,
            fontSize: 14,
            color: "var(--tinta)",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={onAgregar}
          className="dy-foco flex items-center justify-center gap-1.5"
          style={{
            height: 46,
            padding: "0 16px",
            background: "var(--verde-cruz)",
            color: "var(--papel)",
            border: 0,
            borderRadius: 13,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Añadir
        </button>
      </div>
    </HojaBase>
  );
}

/* ───────────────────────── Sub-hoja: Comparar ────────────────────────────── */

function HojaComparar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <HojaBase open={open} onClose={onClose} titulo="Comparar precios">
      <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.55, margin: "10px 0 14px" }}>
        Busca un medicamento y toca <strong style={{ color: "var(--tinta)" }}>Comparar</strong> en dos o más
        resultados. Verás el mismo producto entre farmacias, ordenado por precio.
      </p>
      <div
        className="flex items-center gap-3"
        style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 14, padding: "13px 14px" }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--fondo-suave)", color: "var(--verde-cruz)" }}
        >
          <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
        </span>
        <span style={{ fontSize: 13, color: "var(--tinta-suave)" }}>
          El comparador aparece sobre tus resultados de búsqueda.
        </span>
      </div>
    </HojaBase>
  );
}

/* ───────────────────────── Sub-hoja: Ayuda ───────────────────────────────── */

const FAQS = [
  "¿Cómo funciona DosisYa?",
  "¿Necesito récipe médico?",
  "¿Cómo se calcula el precio en Bs?",
];

function HojaAyuda({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <HojaBase open={open} onClose={onClose} titulo="Ayuda">
      <div
        style={{ margin: "14px 0 16px", background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 16, overflow: "hidden" }}
      >
        {FAQS.map((q, i) => (
          <a
            key={q}
            href={WA_SOPORTE}
            target="_blank"
            rel="noopener noreferrer"
            className="dy-foco flex items-center gap-3"
            style={{
              padding: 14,
              borderBottom: i < FAQS.length - 1 ? "1px solid #eef0eb" : "none",
              color: "var(--tinta)",
              textDecoration: "none",
            }}
          >
            <span style={{ flex: 1, fontSize: 14 }}>{q}</span>
            <ChevronRight className="h-[18px] w-[18px]" style={{ color: "#c3c6c0" }} aria-hidden="true" />
          </a>
        ))}
      </div>
      <a
        href={WA_SOPORTE}
        target="_blank"
        rel="noopener noreferrer"
        className="dy-foco flex items-center justify-center gap-2"
        style={{
          height: 48,
          background: "#25D366",
          color: "#fff",
          borderRadius: 13,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" /> Escríbenos por WhatsApp
      </a>
    </HojaBase>
  );
}

/* ───────────────────────── Sub-hoja: Chat IA ─────────────────────────────── */

type Mensaje = { de: "ia" | "yo"; texto: string };

const CHAT_SEED: Mensaje[] = [
  { de: "ia", texto: "Hola, soy tu asistente. Pregúntame por dosis, usos o alternativas de un medicamento." },
];

function HojaChatIA({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(CHAT_SEED);
  const [texto, setTexto] = useState("");

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    setMensajes((m) => [
      ...m,
      { de: "yo", texto: t },
      { de: "ia", texto: "Función en desarrollo — pronto podré responder tus dudas sobre este medicamento." },
    ]);
    setTexto("");
  };

  return (
    <HojaBase open={open} onClose={onClose} tituloNodo={
      <span className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}>
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]" style={{ background: "var(--verde-cruz)", color: "var(--papel)" }}>
          <Sparkles className="h-[17px] w-[17px]" aria-hidden="true" />
        </span>
        Asistente IA
      </span>
    }>
      <div className="flex flex-col gap-2.5" style={{ marginTop: 14, maxHeight: "46dvh", overflowY: "auto" }}>
        {mensajes.map((m, i) => (
          <div
            key={i}
            style={
              m.de === "ia"
                ? { alignSelf: "flex-start", maxWidth: "82%", background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: "16px 16px 16px 5px", padding: "11px 13px", fontSize: 13, color: "var(--tinta)", lineHeight: 1.45 }
                : { alignSelf: "flex-end", maxWidth: "82%", background: "var(--verde-cruz)", color: "#eaf3ef", borderRadius: "16px 16px 5px 16px", padding: "11px 13px", fontSize: 13, lineHeight: 1.45 }
            }
          >
            {m.texto}
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-2"
        style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 14, padding: "0 6px 0 14px", height: 48, marginTop: 14 }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Escribe tu pregunta…"
          aria-label="Escribe tu pregunta al asistente"
          className="flex-1"
          style={{ border: 0, outline: "none", background: "transparent", fontSize: 13.5, color: "var(--tinta)" }}
        />
        <button
          type="button"
          aria-label="Enviar"
          onClick={enviar}
          className="dy-foco flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: "var(--verde-cruz)", color: "var(--papel)", border: 0 }}
        >
          <Send className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </HojaBase>
  );
}

/* ───────────────────────── Piezas compartidas ────────────────────────────── */

function HojaBase({
  open,
  onClose,
  titulo,
  tituloNodo,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titulo?: string;
  tituloNodo?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="dosisya-ui fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-3xl outline-none"
          style={{ background: "var(--papel)", padding: "10px 18px 24px" }}
          aria-describedby={undefined}
        >
          <Asa />
          <div className="flex items-center justify-between">
            {tituloNodo ?? (
              <Drawer.Title style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}>
                {titulo}
              </Drawer.Title>
            )}
            {tituloNodo && <Drawer.Title className="sr-only">{titulo ?? "Detalle"}</Drawer.Title>}
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="dy-foco flex h-[34px] w-[34px] items-center justify-center rounded-[11px]"
              style={{ background: "var(--fondo-suave)", border: 0, color: "var(--tinta-suave)" }}
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Asa() {
  return (
    <div
      aria-hidden="true"
      style={{ width: 38, height: 4, borderRadius: 999, background: "#d8dad3", margin: "2px auto 14px" }}
    />
  );
}

function ItemMenu({
  icono: Icono,
  titulo,
  sub,
  destacado,
  onClick,
}: {
  icono: LucideIcon;
  titulo: string;
  sub: string;
  destacado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dy-foco flex w-full items-center gap-3 text-left"
      style={{ background: "none", border: 0, borderRadius: 14, padding: "13px 8px", cursor: "pointer" }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={
          destacado
            ? { background: "var(--verde-cruz)", color: "var(--papel)" }
            : { background: "var(--fondo-suave)", color: "var(--verde-cruz)" }
        }
      >
        <Icono className="h-5 w-5" aria-hidden="true" />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 500, color: "var(--tinta)" }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--tinta-tenue)", marginTop: 1 }}>{sub}</span>
      </span>
      <ChevronRight className="h-[18px] w-[18px]" style={{ color: "#c3c6c0" }} aria-hidden="true" />
    </button>
  );
}
