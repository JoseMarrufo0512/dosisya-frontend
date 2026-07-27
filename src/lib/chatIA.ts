/*
 * Cliente del chat del Asistente IA (paciente).
 *
 * Habla con POST /api/v1/ia/chat del backend (que a su vez llama a Gemini; el
 * frontend NUNCA llama a Gemini directo — CLAUDE.md §4.5). Degradación elegante:
 * ante cualquier fallo lanza un Error para que la UI muestre un mensaje amable.
 */
import { API_BASE } from "./api";

export type MensajeChat = { rol: "usuario" | "asistente"; texto: string };

export async function enviarMensajeChat(mensajes: MensajeChat[]): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/ia/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensajes }),
  });

  if (!res.ok) {
    throw new Error(`El asistente respondió ${res.status}`);
  }

  const json = (await res.json()) as { data?: { respuesta?: unknown } };
  const respuesta = json?.data?.respuesta;
  if (typeof respuesta !== "string" || respuesta.trim() === "") {
    throw new Error("Respuesta vacía del asistente");
  }
  return respuesta;
}
