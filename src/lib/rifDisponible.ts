import { API_BASE } from "./api";

/** Resultado de verificar si un RIF ya está registrado (wizard de registro, paso 1). */
export type RifCheckResult = "available" | "taken" | "error";

/**
 * Consulta GET /api/v1/auth/rif-disponible. Nunca lanza: una falla de red,
 * un status no-2xx, o un payload inesperado se traducen en "error" para que
 * el wizard pueda mostrar feedback sin romper el flujo de registro.
 */
export async function verificarRifDisponible(rif: string): Promise<RifCheckResult> {
  try {
    const url = `${API_BASE}/api/v1/auth/rif-disponible?rif=${encodeURIComponent(rif)}`;
    const res = await fetch(url);
    if (!res.ok) return "error";
    const json = await res.json().catch(() => null);
    if (json?.data?.disponible === true) return "available";
    if (json?.data?.disponible === false) return "taken";
    return "error";
  } catch {
    return "error";
  }
}
