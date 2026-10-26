import type { AdminLoginResponse } from "@/lib/adminApi";
import { cerrarSesionServidor } from "@/lib/sesionApi";

// D4: el JWT del superadmin ya NO se guarda en localStorage — vive en la cookie
// HttpOnly `auth_token`. Solo persistimos marcadores NO sensibles (rol, email)
// para el guard optimista y la UI. La enforcement real es el 401→login.
const K_ROL = "super_rol";
const K_EMAIL = "super_email";

export function guardarSesionSuper(r: AdminLoginResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_ROL, r.rol);
  localStorage.setItem(K_EMAIL, r.email);
}

export function esSuperadmin(): boolean {
  if (typeof window === "undefined") return false;
  // Marcador no sensible: solo decide el redirect optimista. El servidor valida
  // la cookie en cada request y responde 401 si no hay sesión real.
  return localStorage.getItem(K_ROL) === "superadmin";
}

export function cerrarSesionSuper(): void {
  if (typeof window === "undefined") return;
  // Expira la cookie HttpOnly en el servidor (fire-and-forget) y limpia los
  // marcadores locales.
  void cerrarSesionServidor();
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
