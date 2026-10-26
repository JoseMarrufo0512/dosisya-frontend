import { API_BASE } from "@/lib/api";

/**
 * Cierra la sesión en el servidor: expira la cookie HttpOnly `auth_token` (D4).
 *
 * La sesión del panel farmacia y la del superadmin comparten la MISMA cookie
 * (ambas se emiten en `auth.py` con el nombre `auth_token`), así que este único
 * endpoint sirve para las dos. Como la cookie es HttpOnly, JS no la puede
 * borrar: solo el servidor la expira con un `Set-Cookie; Max-Age=0`.
 *
 * Fire-and-forget: el logout del cliente (borrar los marcadores locales y
 * navegar al login) no debe esperar ni fallar por la red. Si el POST falla, la
 * cookie sigue viva hasta que expire sola (TTL) o hasta el próximo login, que
 * la sobrescribe — degradación aceptable, nunca deja al usuario atrapado.
 */
export async function cerrarSesionServidor(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    // Silencioso a propósito (ver docstring): no bloquear el logout del cliente.
  }
}
