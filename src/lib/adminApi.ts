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
}

export interface TotalesRed {
  total_farmacias: number;
  pendientes: number;
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

export async function getFarmaciasAdmin(
  token: string,
): Promise<AdminFarmaciasResponse> {
  const res = await adminFetch("/api/v1/admin/farmacias", token);
  if (!res.ok) throw new Error("No se pudo cargar la lista de farmacias");
  const json = await res.json();
  return json.data as AdminFarmaciasResponse;
}

export async function cambiarEstadoFarmacia(
  token: string,
  id: string,
  estado: EstadoAfiliacion,
): Promise<void> {
  const res = await adminFetch(`/api/v1/admin/farmacias/${id}/estado`, token, {
    method: "PATCH",
    body: JSON.stringify({ estado_afiliacion: estado }),
  });
  if (!res.ok) throw new Error("No se pudo cambiar el estado");
}
