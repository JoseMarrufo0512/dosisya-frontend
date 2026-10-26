// Cliente HTTP de la auth del paciente (registro v2). Mismo-origen: usa
// API_BASE ("" en cliente → ruta relativa proxeada). Respuestas de éxito llegan
// envueltas en { data: ... }; los conflictos 409 en { error: { code, message } }
// (misma convención que el backend auth.py).

import { z } from "zod";
import { API_BASE } from "@/lib/api";
import {
  getPacienteToken,
  type Genero,
  type PacientePerfil,
  type SesionPaciente,
} from "@/lib/pacienteAuth";

const PREFIX = "/api/v1/paciente";

const generoSchema = z.enum(["femenino", "masculino", "no_binario", "no_especifica"]).nullable();

const sesionSchema = z.object({
  paciente_id: z.string(),
  auth_token: z.string(),
  nombre: z.string(),
  apellido: z.string(),
  correo: z.string(),
  telefono: z.string(),
  documento: z.string(),
  genero: generoSchema,
});
const perfilSchema = sesionSchema.omit({ auth_token: true });
const googleSchema = z.union([
  sesionSchema,
  z.object({
    perfil_incompleto: z.literal(true),
    preregistro_token: z.string(),
    prefill: z.object({ nombre: z.string(), correo: z.string() }),
  }),
]);

async function leerData(res: Response): Promise<unknown> {
  const json = (await res.json()) as { data?: unknown };
  return json.data;
}

async function leerCodigoError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: { code?: string } };
    return json.error?.code ?? "";
  } catch {
    return "";
  }
}

export interface DatosRegistro {
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  documento: string;
  genero: Genero | null;
  password: string;
}

const MSG_409: Record<string, string> = {
  correo_en_uso: "Ese correo ya está registrado.",
  documento_en_uso: "Ese documento ya está registrado.",
  telefono_en_uso: "Ese teléfono ya está registrado.",
};

export async function registro(d: DatosRegistro): Promise<SesionPaciente> {
  const res = await fetch(`${API_BASE}${PREFIX}/registro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d),
  });
  if (res.status === 409) {
    const code = await leerCodigoError(res);
    throw new Error(MSG_409[code] ?? "Ese dato ya está registrado.");
  }
  if (!res.ok) throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");
  return sesionSchema.parse(await leerData(res));
}

export async function login(correo: string, password: string): Promise<SesionPaciente> {
  const res = await fetch(`${API_BASE}${PREFIX}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, password }),
  });
  if (res.status === 401) throw new Error("Correo o contraseña incorrectos.");
  if (!res.ok) throw new Error("No se pudo iniciar sesión. Intenta de nuevo.");
  return sesionSchema.parse(await leerData(res));
}

export type ResultadoGoogle =
  | { tipo: "sesion"; sesion: SesionPaciente }
  | { tipo: "completar"; preregistroToken: string; prefill: { nombre: string; correo: string } };

export async function googleLogin(idToken: string): Promise<ResultadoGoogle> {
  const res = await fetch(`${API_BASE}${PREFIX}/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) throw new Error("No se pudo verificar tu cuenta de Google.");
  const data = googleSchema.parse(await leerData(res));
  if ("perfil_incompleto" in data) {
    return { tipo: "completar", preregistroToken: data.preregistro_token, prefill: data.prefill };
  }
  return { tipo: "sesion", sesion: data };
}

export async function completarPerfilGoogle(
  preregistroToken: string,
  d: { telefono: string; documento: string; genero: Genero | null },
): Promise<SesionPaciente> {
  const res = await fetch(`${API_BASE}${PREFIX}/google/completar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${preregistroToken}` },
    body: JSON.stringify(d),
  });
  if (res.status === 409) {
    const code = await leerCodigoError(res);
    throw new Error(MSG_409[code] ?? "Ese teléfono o documento ya está registrado.");
  }
  if (!res.ok) throw new Error("No se pudo completar tu perfil. Intenta de nuevo.");
  return sesionSchema.parse(await leerData(res));
}

export async function obtenerPerfil(): Promise<PacientePerfil> {
  const token = getPacienteToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const res = await fetch(`${API_BASE}${PREFIX}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo cargar el perfil.");
  return perfilSchema.parse(await leerData(res));
}

export async function actualizarPerfil(cambios: {
  nombre?: string;
  apellido?: string;
  genero?: Genero | null;
}): Promise<PacientePerfil> {
  const token = getPacienteToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const res = await fetch(`${API_BASE}${PREFIX}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cambios),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo guardar.");
  return perfilSchema.parse(await leerData(res));
}
