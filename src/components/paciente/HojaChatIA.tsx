/*
 * HojaChatIA — hoja del Asistente IA (bottom-sheet). UI lista; la respuesta real
 * necesita un endpoint de chat en el backend (aún no existe). Se abre desde la
 * hoja "Más" y desde la burbuja flotante (misma instancia, controlada por App).
 */
import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { HojaBase } from "./_hojaBase";
import { useBackDismiss } from "@/hooks/useBackDismiss";

type Mensaje = { de: "ia" | "yo"; texto: string };

const CHAT_SEED: Mensaje[] = [
  { de: "ia", texto: "Hola, soy tu asistente. Pregúntame por dosis, usos o alternativas de un medicamento." },
];

export function HojaChatIA({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(CHAT_SEED);
  const [texto, setTexto] = useState("");

  useBackDismiss(open, onClose);

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
    <HojaBase
      open={open}
      onClose={onClose}
      titulo="Asistente IA"
      tituloNodo={
        <span className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}>
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]" style={{ background: "var(--verde-cruz)", color: "var(--papel)" }}>
            <Sparkles className="h-[17px] w-[17px]" aria-hidden="true" />
          </span>
          Asistente IA
        </span>
      }
    >
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
