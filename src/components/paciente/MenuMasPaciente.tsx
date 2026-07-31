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
  ChevronRight,
  Plus,
  Trash2,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { useRecordatorios } from "@/hooks/useLocalStorage";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import { HojaBase, Asa } from "./_hojaBase";

const WA_SOPORTE = "https://wa.me/584120000000?text=Hola%20DosisYa%2C%20necesito%20ayuda";

type SubHoja = "recordatorios" | "comparar" | "ayuda" | null;

export function MenuMasPaciente({
  open,
  onOpenChange,
  onAbrirChatIA,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAbrirChatIA: () => void;
}) {
  const [sub, setSub] = useState<SubHoja>(null);
  // Botón atrás cierra la sub-hoja abierta (Recordatorios/Comparar/Ayuda/IA).
  useBackDismiss(sub !== null, () => setSub(null));
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
              style={{
                fontSize: 17,
                fontWeight: 500,
                color: "var(--tinta)",
                letterSpacing: "-0.02em",
                padding: "0 2px 6px",
              }}
            >
              Más opciones
            </Drawer.Title>
            <ItemMenu
              icono={Bell}
              titulo="Recordatorios para reponer"
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
              onClick={() => {
                onOpenChange(false);
                onAbrirChatIA();
              }}
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <HojaRecordatorios open={sub === "recordatorios"} onClose={() => setSub(null)} />
      <HojaComparar open={sub === "comparar"} onClose={() => setSub(null)} />
      <HojaAyuda open={sub === "ayuda"} onClose={() => setSub(null)} />
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
    <HojaBase open={open} onClose={onClose} titulo="Recordatorios para reponer">
      <p
        style={{
          fontSize: 13,
          color: "var(--tinta-suave)",
          lineHeight: 1.5,
          margin: "10px 0 14px",
        }}
      >
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
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--tinta)" }}>
            Sin recordatorios aún
          </div>
          <div style={{ fontSize: 12.5, color: "var(--tinta-tenue)", marginTop: 3 }}>
            Agrega un medicamento abajo o desde sus resultados de búsqueda.
          </div>
        </div>
      ) : (
        <ul
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {recordatorios.map((r) => (
            <li
              key={r.termino}
              className="flex items-center gap-3"
              style={{
                background: "var(--blanco)",
                border: "1px solid var(--borde)",
                borderRadius: 14,
                padding: "13px 14px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--tinta)",
                    textTransform: "capitalize",
                  }}
                >
                  {r.termino}
                </div>
                <div
                  className="dy-num"
                  style={{ fontSize: 12, color: "var(--tinta-tenue)", marginTop: 1 }}
                >
                  Próximo el {fmtFecha(r.proximoMs)}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Eliminar recordatorio de ${r.termino}`}
                onClick={() => eliminar(r.termino)}
                className="dy-foco flex h-9 w-9 items-center justify-center rounded-[10px]"
                style={{
                  background: "var(--fondo-suave)",
                  border: "1px solid var(--borde)",
                  color: "var(--tinta-tenue)",
                }}
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
      <p
        style={{
          fontSize: 13,
          color: "var(--tinta-suave)",
          lineHeight: 1.55,
          margin: "10px 0 14px",
        }}
      >
        Busca un medicamento y toca <strong style={{ color: "var(--tinta)" }}>Comparar</strong> en
        dos o más resultados. Verás el mismo producto entre farmacias, ordenado por precio.
      </p>
      <div
        className="flex items-center gap-3"
        style={{
          background: "var(--blanco)",
          border: "1px solid var(--borde)",
          borderRadius: 14,
          padding: "13px 14px",
        }}
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
        style={{
          margin: "14px 0 16px",
          background: "var(--blanco)",
          border: "1px solid var(--borde)",
          borderRadius: 16,
          overflow: "hidden",
        }}
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
            <ChevronRight
              className="h-[18px] w-[18px]"
              style={{ color: "#c3c6c0" }}
              aria-hidden="true"
            />
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

/* ───────────────────────── Pieza compartida ─────────────────────────────── */

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
      style={{
        background: "none",
        border: 0,
        borderRadius: 14,
        padding: "13px 8px",
        cursor: "pointer",
      }}
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
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 500, color: "var(--tinta)" }}>
          {titulo}
        </span>
        <span style={{ display: "block", fontSize: 12, color: "var(--tinta-tenue)", marginTop: 1 }}>
          {sub}
        </span>
      </span>
      <ChevronRight className="h-[18px] w-[18px]" style={{ color: "#c3c6c0" }} aria-hidden="true" />
    </button>
  );
}
