import { API_BASE, type NivelSuscripcion } from "@/lib/api";

export type EstadoAfiliacion = "pendiente" | "activa" | "inactiva";

export interface FarmaciaAdmin {
  id: string;
  nombre: string;
  whatsapp: string;
  sector: string;
  punto_referencia: string;
  estado_afiliacion: EstadoAfiliacion;
  nivel_suscripcion: NivelSuscripcion;
  created_at: string;
  leads_mes: number;
  deuda_usd: number;
  lat?: number | null;
  lng?: number | null;
  /** false ⇒ sigue en (0,0): aprobarla la deja activa pero fuera del buscador. */
  ubicacion_configurada?: boolean;
}

export interface TotalesRed {
  total_farmacias: number;
  pendientes: number;
  /** Farmacias que no pueden aparecer en el buscador por no tener coordenadas. */
  sin_ubicacion?: number;
  leads_mes_red: number;
  deuda_red_usd: number;
}

export interface AdminFarmaciasResponse {
  farmacias: FarmaciaAdmin[];
  totales: TotalesRed;
}

export interface AdminLoginResponse {
  auth_token: string;
  rol: "superadmin";
  email: string;
  usuario_id: string;
}

export async function adminLogin(
  correo: string,
  password: string,
): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, password }),
  });
  if (!res.ok) throw new Error("Credenciales inválidas");
  const json = await res.json();
  return json.data as AdminLoginResponse;
}

/**
 * Fetch autenticado para la API de superadmin. Añade el Bearer token y traduce
 * 401/403 al error "UNAUTHORIZED" que las superficies usan para cerrar sesión y
 * redirigir a /super/login (ver manejarNoAutorizado en adminAuth.ts).
 * El Content-Type solo se añade cuando hay body (peticiones GET no lo llevaban).
 */
async function adminFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  return res;
}

/** Totales neutros: evita que la cabecera reviente si el backend los omite. */
const TOTALES_VACIOS: TotalesRed = {
  total_farmacias: 0,
  pendientes: 0,
  sin_ubicacion: 0,
  leads_mes_red: 0,
  deuda_red_usd: 0,
};

export async function getFarmaciasAdmin(
  token: string,
): Promise<AdminFarmaciasResponse> {
  const res = await adminFetch("/api/v1/admin/farmacias", token);
  if (!res.ok) throw new Error("No se pudo cargar la lista de farmacias");

  const json = await res.json().catch(() => null);

  /* Validar la forma acá y no en la tabla. Un 200 cuyo `data` no trae
     `farmacias` hacía estallar `data.farmacias.filter(...)` durante el render,
     y como el throw ocurría dentro del árbol de React se llevaba por delante
     la ruta COMPLETA: el superadmin perdía hasta las pestañas y solo veía el
     error genérico en inglés, sin forma de reintentar.

     Lanzando desde el queryFn, el fallo se convierte en el estado de error que
     la vista ya sabe mostrar, con su botón de Reintentar. */
  const data = json?.data;
  if (!data || !Array.isArray(data.farmacias)) {
    throw new Error("No se pudo cargar la lista de farmacias");
  }

  return {
    farmacias: data.farmacias as FarmaciaAdmin[],
    // `totales` es secundario: si falta, mostrar la lista vale más que fallar.
    totales: { ...TOTALES_VACIOS, ...(data.totales ?? {}) },
  };
}

/**
 * ¿Hay que pedirle coordenadas al superadmin antes de aplicar este cambio?
 *
 * Solo al ACTIVAR: suspender o rechazar no necesitan ubicación. Una farmacia
 * activa en (0,0) queda invisible en el buscador (ST_DWithin la descarta) y
 * empieza a facturar por leads que nunca va a recibir.
 *
 * `ubicacion_configurada` es opcional en el tipo porque un backend viejo no lo
 * manda; en ese caso no se interrumpe el flujo (solo `=== false` interrumpe).
 */
export function requiereUbicacionAntesDeActivar(
  farmacia: Pick<FarmaciaAdmin, "ubicacion_configurada">,
  estado: EstadoAfiliacion,
): boolean {
  return estado === "activa" && farmacia.ubicacion_configurada === false;
}

/**
 * Cambia el estado de afiliación y, opcionalmente, ubica la farmacia.
 *
 * Las coordenadas viajan juntas o no viajan (el backend devuelve 400 con una
 * sola). Sirven para no aprobar una farmacia que sigue en (0,0): quedaría
 * activa pero invisible en el buscador, cobrando por leads que no va a recibir.
 */
export async function cambiarEstadoFarmacia(
  token: string,
  id: string,
  estado: EstadoAfiliacion,
  coords?: { lat: number; lng: number },
): Promise<void> {
  const res = await adminFetch(`/api/v1/admin/farmacias/${id}/estado`, token, {
    method: "PATCH",
    body: JSON.stringify({ estado_afiliacion: estado, ...(coords ?? {}) }),
  });
  if (!res.ok) throw new Error("No se pudo cambiar el estado");
}
