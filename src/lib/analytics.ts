import posthog from "posthog-js";

// Funnel de conversión (búsqueda → Lista Médica → contacto). Sin VITE_POSTHOG_KEY
// queda en no-op (dev local no manda eventos). Autocapture y session recording
// quedan apagados a propósito: solo mandamos los eventos explícitos de abajo,
// nada de clics/inputs genéricos de un paciente que nunca creó cuenta.
const key = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let inicializado = false;

function asegurarInit(): boolean {
  if (inicializado) return true;
  if (typeof window === "undefined" || !key) return false;
  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    autocapture: false,
    disable_session_recording: true,
  });
  inicializado = true;
  return true;
}

/** Evento de funnel. No-op si VITE_POSTHOG_KEY no está configurada o en SSR. */
export function track(evento: string, propiedades?: Record<string, unknown>): void {
  if (!asegurarInit()) return;
  posthog.capture(evento, propiedades);
}
