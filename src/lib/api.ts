// Cliente HTTP base de DosisYa
//
// Contrato verificado contra GET /api/v1/medicamentos/buscar (medicamentos.py).
// El endpoint ya devuelve los campos con los nombres correctos via SQL aliases:
//   - whatsapp       → f.telefono_whatsapp AS whatsapp
//   - es_premium     → (f.nivel_suscripcion = 'premium') AS es_premium
//   - lat / lng      → ST_Y/ST_X(f.ubicacion) AS lat/lng
//   - medicamento_nombre → im.principio_activo AS medicamento_nombre

import * as Sentry from "@sentry/tanstackstart-react";

/** Nivel de suscripción de una farmacia (columna nivel_suscripcion en BD). */
export type NivelSuscripcion = "gratuita" | "premium";

/**
 * Condición de dispensación del medicamento (hallazgo B-03).
 *
 * `null` = desconocido: el principio activo no está en la tabla curada. NO
 * significa "venta libre" — la app nunca afirma eso. Los errores no son
 * simétricos: decir "requiere récipe" cuando no lo requiere cuesta un papel de
 * más; decir "venta libre" cuando sí lo requiere cuesta un traslado en falso.
 * Solo se hace la afirmación cautelosa.
 *
 * `"controlado"` no aparece en esta unión a propósito: el backend lo filtra en
 * SQL y nunca llega al cliente.
 */
export type CondicionDispensacion = "libre" | "receta" | null;

export interface ResultadoFarmacia {
  farmacia_id: string;
  farmacia_nombre: string;
  direccion: string;
  /** Número de WhatsApp (alias de telefono_whatsapp en el backend) */
  whatsapp: string;
  nivel_suscripcion: NivelSuscripcion;
  /** Calculado server-side: nivel_suscripcion === 'premium' */
  es_premium: boolean;
  tiene_delivery: boolean;
  /** Latitud extraída de la columna PostGIS ubicacion */
  lat: number;
  /** Longitud extraída de la columna PostGIS ubicacion */
  lng: number;
  medicamento_id: string;
  /** Alias de principio_activo en el backend */
  medicamento_nombre: string;
  marca_comercial: string | null;
  presentacion: string;
  precio_usd: number;
  precio_ves: number;
  stock_disponible: boolean;
  condicion_dispensacion: CondicionDispensacion;
  distancia_m: number;
  score_similitud: number;
}

export interface RespuestaAPI {
  status: "success" | "error";
  message: string;
  data: {
    total: number;
    limite_aplicado?: number;
    resultados: ResultadoFarmacia[];
  } | null;
}

export interface ParamsBusqueda {
  q: string;
  lat: number;
  lng: number;
  radio?: number;
  con_delivery?: boolean;
}

// URL base del backend — modelo "mismo-origen" (proxy en el borde).
//
// El NAVEGADOR nunca llama al dominio del backend directamente: usa rutas
// relativas /api/v1/* contra el propio dominio del frontend, y la petición se
// reenvía al backend por detrás (server-side):
//   DEV local:        proxy de Vite (vite.config.mts) → localhost:8000 / DEV_API_PROXY
//   PRODUCCIÓN:       rewrite de Vercel (vercel.json) → backend FastAPI
// Así, para el navegador, la llamada deja de ser cross-site: las extensiones de
// privacidad/adblockers del escritorio ya no pueden bloquearla (el celular
// nunca se vio afectado porque no corre esas extensiones). Como el proxy es
// server-side, tampoco depende de la lista CORS del backend.
//
// El SERVIDOR (SSR) SÍ necesita la URL absoluta: no hay origen para resolver
// una ruta relativa, y además ningún adblocker corre ahí. import.meta.env.SSR
// se resuelve estáticamente por bundle, así que el cliente queda en ""
// (relativo) y el servidor en la URL absoluta del backend.
//
// NUNCA dejar el fallback del servidor en una URL de frontend (loops de red).
export const API_BASE: string = import.meta.env.SSR
  ? ((import.meta.env.VITE_API_URL as string | undefined) ??
    "https://proyecto-dosis-ya.vercel.app")
  : "";

// Log de diagnóstico solo en desarrollo (no llega a producción)
if (import.meta.env.DEV) {
  console.log(`[DosisYa API] Backend → ${API_BASE || "(proxy Vite → localhost:8000)"}`);
}

export async function buscarMedicamentos(
  params: ParamsBusqueda,
  signal?: AbortSignal,
): Promise<RespuestaAPI> {
  try {
    const qs = new URLSearchParams({
      q: params.q,
      lat: String(params.lat),
      lng: String(params.lng),
      ...(params.radio !== undefined ? { radio: String(params.radio) } : {}),
      ...(params.con_delivery !== undefined ? { con_delivery: String(params.con_delivery) } : {}),
    });
    const res = await fetch(`${API_BASE}/api/v1/medicamentos/buscar?${qs.toString()}`, { signal });
    if (!res.ok) {
      Sentry.captureException(new Error(`API Error: ${res.status}`));
      return { status: "error", message: `Error ${res.status}`, data: null };
    }
    const json = (await res.json()) as RespuestaAPI;
    return json;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    Sentry.captureException(err);
    return { status: "error", message: "Error de red", data: null };
  }
}
