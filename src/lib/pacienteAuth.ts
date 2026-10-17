// Sesión del paciente (login opcional). Espejo de adminAuth.ts pero para el
// paciente B2C. Guardado en localStorage; SSR-safe.

const K_TOKEN = "paciente_token";
const K_PERFIL = "paciente_perfil";

export interface PacientePerfil {
  paciente_id: string;
  telefono: string;
  nombre: string;
}

export interface VerificarCodigoResponse {
  paciente_id: string;
  auth_token: string;
  telefono: string;
  nombre: string;
  es_nuevo: boolean;
}

export function guardarSesionPaciente(r: VerificarCodigoResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_TOKEN, r.auth_token);
  const perfil: PacientePerfil = {
    paciente_id: r.paciente_id,
    telefono: r.telefono,
    nombre: r.nombre,
  };
  localStorage.setItem(K_PERFIL, JSON.stringify(perfil));
}

export function actualizarPerfilGuardado(perfil: PacientePerfil): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_PERFIL, JSON.stringify(perfil));
}

export function getPacienteToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(K_TOKEN);
}

export function esPacienteLogueado(): boolean {
  return getPacienteToken() !== null;
}

export function getPacientePerfil(): PacientePerfil | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(K_PERFIL);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PacientePerfil;
  } catch {
    return null;
  }
}

export function cerrarSesionPaciente(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(K_TOKEN);
  localStorage.removeItem(K_PERFIL);
}
