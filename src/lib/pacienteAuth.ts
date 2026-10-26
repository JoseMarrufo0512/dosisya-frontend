// Sesión del paciente (login opcional, registro v2). Espejo de adminAuth.ts
// pero para el paciente B2C. Guardado en localStorage; SSR-safe.

const K_TOKEN = "paciente_token";
const K_PERFIL = "paciente_perfil";

export type Genero = "femenino" | "masculino" | "no_binario" | "no_especifica";

export interface PacientePerfil {
  paciente_id: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  documento: string;
  genero: Genero | null;
}

export interface SesionPaciente extends PacientePerfil {
  auth_token: string;
}

export function guardarSesionPaciente(s: SesionPaciente): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_TOKEN, s.auth_token);
  const { auth_token: _omit, ...perfil } = s;
  void _omit;
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
