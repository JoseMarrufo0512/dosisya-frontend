import type { AdminLoginResponse } from "@/lib/adminApi";

const K_TOKEN = "super_token";
const K_ROL = "super_rol";
const K_EMAIL = "super_email";

export function guardarSesionSuper(r: AdminLoginResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_TOKEN, r.auth_token);
  localStorage.setItem(K_ROL, r.rol);
  localStorage.setItem(K_EMAIL, r.email);
}

export function getSuperToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(K_TOKEN);
}

export function esSuperadmin(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(K_TOKEN)) &&
    localStorage.getItem(K_ROL) === "superadmin";
}

export function cerrarSesionSuper(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(K_TOKEN);
  localStorage.removeItem(K_ROL);
  localStorage.removeItem(K_EMAIL);
}

/**
 * Maneja una respuesta 401/403 de la API de superadmin: limpia la sesión local.
 * La navegación a /super/login queda a cargo del componente que llama a esta
 * función (requiere useNavigate, solo disponible dentro de componentes React).
 */
export function manejarNoAutorizado(): void {
  cerrarSesionSuper();
}
