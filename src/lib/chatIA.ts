/*
 * Cliente del chat del Asistente IA (paciente).
 *
 * Habla con POST /api/v1/ia/chat del backend (que a su vez llama a Gemini; el
 * frontend NUNCA llama a Gemini directo — CLAUDE.md §4.5). Degradación elegante:
 * ante cualquier fallo lanza un `ErrorChat` con un código, para que la UI diga
 * qué pasó en vez de un "no pude responder" para todo.
 */
import { API_BASE } from "./api";
import * as Sentry from '@sentry/tanstackstart-react';

export type MensajeChat = { rol: "usuario" | "asistente"; texto: string };

/** Por qué falló la llamada, para que la UI elija el mensaje. */
export type CodigoErrorChat = "timeout" | "limite" | "no_disponible" | "desconocido";

export class ErrorChat extends Error {
  constructor(
    readonly codigo: CodigoErrorChat,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorChat";
  }
}

/** Tope duro del backend (`ChatRequest.mensajes`, max_length=20). */
const MAX_MENSAJES = 20;

/**
 * Tope duro del backend (`ChatMensaje.texto`, max_length=1000). Lo exportamos
 * para que la UI corte al escribir: pasarse devuelve un 422 que el usuario solo
 * ve como "no pude responder", sin pista de que el problema era el largo.
 */
export const MAX_CARACTERES_MENSAJE = 1000;

/**
 * Deja solo la cola del hilo que el backend acepta: máximo 20 mensajes y
 * empezando por el usuario.
 *
 * Sin esto el chat mandaba el hilo completo y a partir del turno 11 (semilla +
 * 11 preguntas + 10 respuestas = 22) el backend devolvía 422 para siempre: el
 * historial solo crece, así que ningún mensaje posterior volvía a funcionar.
 */
function recortarHilo(mensajes: MensajeChat[]): MensajeChat[] {
  const cola = mensajes.slice(-MAX_MENSAJES);
  // Si la cola arranca con el asistente (el saludo semilla, o un corte a mitad
  // de turno) la descartamos: los turnos deben abrir con el usuario.
  const inicio = cola.findIndex((m) => m.rol === "usuario");
  return inicio > 0 ? cola.slice(inicio) : cola;
}

/**
 * Techo del cliente, por encima del del backend (`GEMINI_CHAT_TIMEOUT_SECONDS`
 * 20s + 15s de buffer = 35s) para no abortar una respuesta que sí venía en
 * camino. Sin esto, una petición que nunca resuelve dejaba el chat trabado con
 * el input deshabilitado hasta recargar la página.
 */
const TIMEOUT_MS = 40_000;

export async function enviarMensajeChat(mensajes: MensajeChat[]): Promise<string> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

  // El try cubre también la lectura del cuerpo, no solo el fetch: unas cabeceras
  // que llegan y un cuerpo que nunca cierra dejarían el chat colgado igual.
  try {
    const res = await fetch(`${API_BASE}/api/v1/ia/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensajes: recortarHilo(mensajes) }),
      signal: control.signal,
    });

    if (!res.ok) {
      // 429 = rate limit (20/min por IP); 503/504 = Gemini caído/timeout/cuota.
      const codigo: CodigoErrorChat =
        res.status === 429
          ? "limite"
          : res.status === 503 || res.status === 504
            ? "no_disponible"
            : "desconocido";
      throw new ErrorChat(codigo, `El asistente respondió ${res.status}`);
    }

    const json = (await res.json()) as { data?: { respuesta?: unknown } };
    const respuesta = json?.data?.respuesta;
    if (typeof respuesta !== "string" || respuesta.trim() === "") {
      throw new ErrorChat("desconocido", "Respuesta vacía del asistente");
    }
    return respuesta;
  } catch (e) {
    if (control.signal.aborted) {
      throw new ErrorChat("timeout", `El asistente no respondió en ${TIMEOUT_MS} ms`);
    }
    if (e instanceof ErrorChat) throw e; // ya tipado arriba: no lo degrades
    Sentry.captureException(e);
    throw new ErrorChat("desconocido", `Falló la red: ${String(e)}`);
  } finally {
    clearTimeout(reloj);
  }
}
