/**
 * Content-Security-Policy con nonce por-request (D1 del delta de seguridad).
 *
 * Isomorfo y SIN imports de Node: este módulo lo importa `router.tsx` (que va
 * al bundle del cliente). El ALS vive en `server.ts` (solo servidor) y cablea
 * el lector vía `_setNonceReader`; en el cliente el lector queda en su valor
 * por defecto (undefined), que es lo correcto —el nonce solo importa en SSR.
 *
 * Medición (Fase 0) confirmó que las únicas fuentes de script fuera de 'self'
 * son los scripts inline de hidratación de TanStack (cubiertos por el nonce) y
 * el config.js de PostHog (cubierto por 'strict-dynamic', que propaga confianza
 * a lo que cargue un script ya confiable). Por eso no hace falta listar hosts
 * en script-src. style-src conserva 'unsafe-inline' a propósito (riesgo menor).
 */

/** Nonce base64 de 128 bits. Web Crypto global: funciona en Node 19+ y navegador. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Construye la cadena CSP bloqueante para un nonce dado. */
export function construirCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://us.i.posthog.com https://*.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.sentry.io",
    "form-action 'self'",
    "frame-src 'self'",
  ].join("; ");
}

/** Indirección: el servidor inyecta el lector real (ALS); el cliente no. */
let leerNonce: () => string | undefined = () => undefined;

/** Lo llama `server.ts` una vez, con un lector respaldado por AsyncLocalStorage. */
export function _setNonceReader(fn: () => string | undefined): void {
  leerNonce = fn;
}

/** Nonce del request actual (SSR) o undefined (cliente / fuera de request). */
export function getRequestNonce(): string | undefined {
  return leerNonce();
}
