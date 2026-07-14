import { API_BASE } from "@/lib/api";

export type EstadoAfiliacion = "pendiente" | "activa" | "inactiva";

export interface FarmaciaAdmin {
  id: string;
  nombre: string;
  whatsapp: string;
  sector: string;
  punto_referencia: string;
  estado_afiliacion: EstadoAfiliacion;
  nivel_suscripcion: "gratuita" | "premium";
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

export async function getFarmaciasAdmin(
  token: string,
): Promise<AdminFarmaciasResponse> {
  const res = await fetch(`${API_BASE}/api/v1/admin/farmacias`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo cargar la lista de farmacias");
  const json = await res.json();
  return json.data as AdminFarmaciasResponse;
}

export async function cambiarEstadoFarmacia(
  token: string,
  id: string,
  estado: EstadoAfiliacion,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/farmacias/${id}/estado`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ estado_afiliacion: estado }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo cambiar el estado");
}
