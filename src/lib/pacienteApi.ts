// Cliente HTTP de la auth del paciente. Mismo-origen: usa API_BASE ("" en
// cliente → ruta relativa proxeada). Respuestas de auth llegan envueltas en
// { data: ... } (igual que adminApi).

import { z } from "zod";
import { API_BASE } from "@/lib/api";
import {
  getPacienteToken,
  type PacientePerfil,
  type VerificarCodigoResponse,
} from "@/lib/pacienteAuth";

const PREFIX = "/api/v1/paciente";

const sesionSchema = z.object({
  paciente_id: z.string(),
  auth_token: z.string(),
  telefono: z.string(),
  nombre: z.string(),
  es_nuevo: z.boolean(),
});

const perfilSchema = z.object({
  paciente_id: z.string(),
  telefono: z.string(),
  nombre: z.string(),
});

async function leerData(res: Response): Promise<unknown> {
  const json = (await res.json()) as { data?: unknown };
  return json.data;
}

export async function solicitarCodigo(telefono: string): Promise<void> {
  const res = await fetch(`${API_BASE}${PREFIX}/auth/solicitar-codigo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telefono }),
  });
  if (res.status === 429) throw new Error("Espera un momento antes de pedir otro código.");
  if (!res.ok) throw new Error("No se pudo enviar el código. Intenta de nuevo.");
}

export async function verificarCodigo(
  telefono: string,
  codigo: string,
): Promise<VerificarCodigoResponse> {
  const res = await fetch(`${API_BASE}${PREFIX}/auth/verificar-codigo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telefono, codigo }),
  });
  if (!res.ok) throw new Error("Código incorrecto o vencido.");
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

export async function actualizarNombre(nombre: string): Promise<PacientePerfil> {
  const token = getPacienteToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const res = await fetch(`${API_BASE}${PREFIX}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nombre }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo guardar el nombre.");
  return perfilSchema.parse(await leerData(res));
}
