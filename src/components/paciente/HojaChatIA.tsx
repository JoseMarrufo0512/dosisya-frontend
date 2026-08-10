/*
 * HojaChatIA — hoja del Asistente IA (bottom-sheet). Responde vía
 * POST /api/v1/ia/chat (ver src/lib/chatIA.ts). Se abre desde la hoja "Más" y
 * desde la burbuja flotante (misma instancia, controlada por App).
 *
 * El botón "atrás" lo registra App junto al resto de las hojas, igual que
 * Lista/Escáner/Comparador/Más: el estado `open` lo posee App, así que el
 * registro vive donde vive el estado.
 */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Sparkles, Send } from "lucide-react";
import { HojaBase } from "./_hojaBase";
import {
  enviarMensajeChat,
  ErrorChat,
  MAX_CARACTERES_MENSAJE,
  type CodigoErrorChat,
  type MensajeChat,
} from "@/lib/chatIA";

/**
 * `error: true` marca las burbujas que escribimos nosotros cuando falla la
 * llamada. Se ven como un mensaje del asistente, pero NO viajan en el historial:
 * si no, le enseñábamos al modelo que él dijo "no pude responder" y encima
 * gastaban un turno del hilo.
 */
type Mensaje = { de: "ia" | "yo"; texto: string; error?: boolean };

const CHAT_SEED: Mensaje[] = [
  {
    de: "ia",
    texto: "Hola, soy tu asistente. Pregúntame por dosis, usos o alternativas de un medicamento.",
  },
];

/** Qué le decimos al paciente según por qué falló. Nunca detalles del proveedor. */
const MENSAJE_ERROR: Record<CodigoErrorChat, string> = {
  timeout: "El asistente tardó demasiado en responder. Intenta de nuevo.",
  limite: "Vas muy rápido. Espera un momento y vuelve a preguntar.",
  no_disponible: "El asistente está ocupado ahora mismo. Intenta en unos segundos.",
  desconocido: "No pude responder ahora, intenta de nuevo.",
};

export function HojaChatIA({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(CHAT_SEED);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // El área de mensajes es corta (46dvh): sin esto la respuesta nueva nacía
  // fuera de la vista y el usuario se quedaba mirando el saludo inicial.
  // También al reabrir la hoja, que remonta el contenedor con scrollTop 0.
  useEffect(() => {
    const cont = listaRef.current;
    if (!cont) return;
    cont.scrollTo({ top: cont.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [mensajes, open, reduce]);

  // El hilo sobrevive a cerrar y reabrir la hoja (cerrar sin querer en móvil es
  // demasiado fácil), así que el borrón es explícito. Bloqueado mientras hay una
  // respuesta en vuelo: si no, esa respuesta caería sobre el hilo ya vacío.
  const reiniciar = () => {
    if (enviando) return;
    setMensajes(CHAT_SEED);
    setTexto("");
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    const nuevos: Mensaje[] = [...mensajes, { de: "yo", texto: t }];
    setMensajes(nuevos);
    setTexto("");
    setEnviando(true);
    try {
      const historial: MensajeChat[] = nuevos
        .filter((m) => !m.error)
        .map((m) => ({
          rol: m.de === "yo" ? "usuario" : "asistente",
          texto: m.texto,
        }));
      const respuesta = await enviarMensajeChat(historial);
      setMensajes((m) => [...m, { de: "ia", texto: respuesta }]);
    } catch (e) {
      const codigo = e instanceof ErrorChat ? e.codigo : "desconocido";
      setMensajes((m) => [...m, { de: "ia", texto: MENSAJE_ERROR[codigo], error: true }]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <HojaBase
      open={open}
      onClose={onClose}
      titulo="Asistente IA"
      tituloNodo={
        <span
          className="flex items-center gap-2"
          style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}
        >
          <span
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]"
            style={{ background: "var(--verde-cruz)", color: "var(--papel)" }}
          >
            <Sparkles className="h-[17px] w-[17px]" aria-hidden="true" />
          </span>
          Asistente IA
        </span>
      }
    >
      {mensajes.length > CHAT_SEED.length && (
        <button
          type="button"
          onClick={reiniciar}
          disabled={enviando}
          className="dy-foco self-end"
          style={{
            marginTop: 10,
            marginBottom: -4,
            background: "transparent",
            border: 0,
            padding: "2px 4px",
            fontSize: 12,
            color: "var(--tinta-tenue)",
            opacity: enviando ? 0.5 : 1,
            cursor: enviando ? "default" : "pointer",
          }}
        >
          Nueva conversación
        </button>
      )}
      <div
        ref={listaRef}
        className="flex flex-col gap-2.5"
        style={{ marginTop: 14, maxHeight: "46dvh", overflowY: "auto" }}
      >
        {mensajes.map((m, i) => (
          <div
            key={i}
            style={
              m.de === "ia"
                ? {
                    alignSelf: "flex-start",
                    maxWidth: "82%",
                    background: "var(--blanco)",
                    border: "1px solid var(--borde)",
                    borderRadius: "16px 16px 16px 5px",
                    padding: "11px 13px",
                    fontSize: 13,
                    color: "var(--tinta)",
                    lineHeight: 1.45,
                  }
                : {
                    alignSelf: "flex-end",
                    maxWidth: "82%",
                    background: "var(--verde-cruz)",
                    color: "#eaf3ef",
                    borderRadius: "16px 16px 5px 16px",
                    padding: "11px 13px",
                    fontSize: 13,
                    lineHeight: 1.45,
                  }
            }
          >
            {m.texto}
          </div>
        ))}
      </div>
      {enviando && (
        <div
          style={{
            alignSelf: "flex-start",
            fontSize: 12,
            color: "var(--tinta-tenue)",
            marginTop: 6,
          }}
        >
          escribiendo…
        </div>
      )}
      {texto.length >= MAX_CARACTERES_MENSAJE - 100 && (
        // El corte de maxLength es silencioso: avisamos antes de llegar para que
        // pegar un texto largo no se sienta como que la app se comió parte.
        <div
          aria-live="polite"
          style={{
            alignSelf: "flex-end",
            fontSize: 11,
            color: texto.length >= MAX_CARACTERES_MENSAJE ? "var(--rojo)" : "var(--tinta-tenue)",
            marginTop: 6,
          }}
        >
          {texto.length}/{MAX_CARACTERES_MENSAJE}
        </div>
      )}
      <div
        className="flex items-center gap-2"
        style={{
          background: "var(--blanco)",
          border: "1px solid var(--borde)",
          borderRadius: 14,
          padding: "0 6px 0 14px",
          height: 48,
          marginTop: 14,
        }}
      >
        <input
          value={texto}
          // maxLength solo frena la edición manual: dictado, autocompletado o
          // algunos IME escriben el value directo y se lo saltan. Recortamos
          // también aquí para que el estado nunca pase del tope del backend.
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_CARACTERES_MENSAJE))}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Escribe tu pregunta…"
          aria-label="Escribe tu pregunta al asistente"
          maxLength={MAX_CARACTERES_MENSAJE}
          className="flex-1"
          disabled={enviando}
          style={{
            border: 0,
            outline: "none",
            background: "transparent",
            fontSize: 13.5,
            color: "var(--tinta)",
          }}
        />
        <button
          type="button"
          aria-label="Enviar"
          onClick={enviar}
          disabled={enviando}
          className="dy-foco flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: "var(--verde-cruz)",
            color: "var(--papel)",
            border: 0,
            opacity: enviando ? 0.6 : 1,
          }}
        >
          <Send className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </HojaBase>
  );
}
