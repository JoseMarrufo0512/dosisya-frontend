// Cliente HTTP base de DosisYa
//
// Contrato verificado contra GET /api/v1/medicamentos/buscar (medicamentos.py).
// El endpoint ya devuelve los campos con los nombres correctos via SQL aliases:
//   - whatsapp       → f.telefono_whatsapp AS whatsapp
//   - es_premium     → (f.nivel_suscripcion = 'premium') AS es_premium
//   - lat / lng      → ST_Y/ST_X(f.ubicacion) AS lat/lng
//   - medicamento_nombre → im.principio_activo AS medicamento_nombre

export interface ResultadoFarmacia {
  farmacia_id: string;
  farmacia_nombre: string;
  direccion: string;
  /** Número de WhatsApp (alias de telefono_whatsapp en el backend) */
  whatsapp: string;
  nivel_suscripcion: "premium" | "gratuita";
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

// URL del backend — se lee desde la variable de entorno VITE_API_URL (definida en .env).
// Fallback al host de producción para evitar errores si la variable no está definida.
export const API_BASE =
  import.meta.env.VITE_API_URL ?? "https://proyecto-dosis-ya.vercel.app";

// Alias de conveniencia para consumidores existentes
export type Coords = { lat: number; lng: number };
export type Resultado = ResultadoFarmacia;

export async function buscarMedicamentos(
  params: ParamsBusqueda,
): Promise<RespuestaAPI> {
  try {
    const qs = new URLSearchParams({
      q: params.q,
      lat: String(params.lat),
      lng: String(params.lng),
      ...(params.radio !== undefined ? { radio: String(params.radio) } : {}),
      ...(params.con_delivery !== undefined
        ? { con_delivery: String(params.con_delivery) }
        : {}),
    });
    const res = await fetch(
      `${API_BASE}/api/v1/medicamentos/buscar?${qs.toString()}`,
    );
    const json = (await res.json()) as RespuestaAPI;
    return json;
  } catch {
    return { status: "error", message: "Error de red", data: null };
  }
}
