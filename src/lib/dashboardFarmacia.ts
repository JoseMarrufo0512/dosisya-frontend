/*
 * dashboardFarmacia.ts — cliente del Dashboard B2B.
 *
 * Contrato verificado contra GET /api/v1/farmacias/{farmacia_id}/dashboard
 * (DosisYa-Backend/src/dosisya/routers/farmacias.py, 2026-07-25):
 *  - Requiere Authorization: Bearer <auth_token>. Sin trailing slash.
 *  - 401/403 → sesión inválida. Devuelve `data` con los campos de abajo.
 *
 * Campos que el backend SÍ entrega y aquí se mapean. Lo que el diseño del
 * handoff pedía y el backend NO tiene (delta vs mes anterior, conversión,
 * distancia por lead, "estado" del lead, saldo prepago, leads-por-día) NO se
 * fabrica: se omite. Ver nota al pie del archivo.
 */

import { API_BASE } from "./api";
import type {
  DashboardFarmaciaProps,
  KpiItem,
  LeadFila,
} from "@/components/panel/DashboardFarmacia";

export interface LeadRecienteAPI {
  lead_id: string;
  fecha_hora: string; // ISO
  tipo_interaccion: string;
  medicamento_buscado_id?: string | null;
  medicamento_nombre?: string | null;
  medicamento_marca?: string | null;
}

export interface DashboardFarmaciaData {
  farmacia_id?: string;
  nombre_farmacia?: string;
  estado_afiliacion?: string;
  nivel_suscripcion?: string;
  whatsapp?: string;
  sector?: string;
  punto_referencia?: string;
  pacientes_interesados_hoy?: number;
  busquedas_zona?: number | null;
  busquedas_zona_disponible?: boolean;
  inventario?: Array<{
    id?: string;
    nombre: string;
    marca_comercial?: string | null;
    presentacion?: string;
    /** COALESCE(stock_disponible, false) del backend: booleano de disponibilidad. */
    stock?: boolean;
    precio_usd?: number;
  }>;
  total_leads_mes_actual?: number;
  leads_recipe_mes_actual?: number;
  deuda_estimada_usd?: number;
  tarifa_por_lead_usd?: number;
  leads_recientes?: LeadRecienteAPI[];
  total_leads_recientes_mostrados?: number;
}

export type ResultadoDashboard =
  | { status: "ok"; data: DashboardFarmaciaData }
  | { status: "unauthorized" }
  | { status: "error" };

/** Lee credenciales de sesión guardadas por el login del panel B2B. */
function credencialesSesion(): { farmaciaId: string; token: string } | null {
  if (typeof window === "undefined") return null;
  const farmaciaId = localStorage.getItem("farmacia_id");
  const token = localStorage.getItem("auth_token");
  if (!farmaciaId || !token) return null;
  return { farmaciaId, token };
}

export async function obtenerDashboardFarmacia(): Promise<ResultadoDashboard> {
  const cred = credencialesSesion();
  if (!cred) return { status: "unauthorized" };

  try {
    const res = await fetch(
      `${API_BASE}/api/v1/farmacias/${cred.farmaciaId}/dashboard`,
      { headers: { Authorization: `Bearer ${cred.token}` } },
    );
    if (res.status === 401 || res.status === 403) return { status: "unauthorized" };
    if (!res.ok) return { status: "error" };
    const json = await res.json();
    return { status: "ok", data: (json?.data ?? json ?? {}) as DashboardFarmaciaData };
  } catch {
    return { status: "error" };
  }
}

// ── Formateo es-VE ───────────────────────────────────────────────────────────

/** "$0,35" a partir de un número USD. */
export function fmtUsd(n: number | undefined | null): string {
  const v = typeof n === "number" ? n : 0;
  return "$" + v.toFixed(2).replace(".", ",");
}

/** Hora local "10:24" a partir de un ISO. */
export function fmtHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

// Etiqueta + tono legible por humano para cada tipo de interacción (enum PG).
// Tonos: "verde" = contacto real (whatsapp/llamar), "neutral" = navegación.
const TIPO_INTERACCION: Record<string, { texto: string; tono: "verde" | "ambar" | "neutral" }> = {
  clic_whatsapp: { texto: "WhatsApp", tono: "verde" },
  clic_llamar: { texto: "Llamada", tono: "verde" },
  ver_mapa: { texto: "Vio el mapa", tono: "neutral" },
  ver_detalle: { texto: "Vio detalle", tono: "neutral" },
  compartir: { texto: "Compartió", tono: "neutral" },
  capture_pantalla: { texto: "Captura", tono: "ambar" },
};

export function etiquetaInteraccion(tipo: string): {
  texto: string;
  tono: "verde" | "ambar" | "neutral";
} {
  return TIPO_INTERACCION[tipo] ?? { texto: tipo, tono: "neutral" };
}

/** Traduce el contrato del backend a las props del dashboard visual.
 *  No fabrica datos: los KPIs sin fuente en el backend se omiten. */
export function mapearDashboard(data: DashboardFarmaciaData): DashboardFarmaciaProps {
  const totalMes = data.total_leads_mes_actual ?? 0;
  const tarifa = data.tarifa_por_lead_usd ?? 0;
  const deuda = data.deuda_estimada_usd ?? 0;
  const hoy = data.pacientes_interesados_hoy ?? 0;
  const recipeMes = data.leads_recipe_mes_actual ?? 0;

  const kpis: KpiItem[] = [
    {
      etiqueta: "Leads este mes",
      valor: String(totalMes),
      nota: recipeMes > 0 ? `${recipeMes} con récipe digital` : "clics facturables",
    },
    { etiqueta: "Costo por lead", valor: fmtUsd(tarifa), nota: "por clic a WhatsApp", valorVerde: true },
    { etiqueta: "Inversión del mes", valor: fmtUsd(deuda), nota: `${totalMes} leads facturados` },
    { etiqueta: "Pacientes hoy", valor: String(hoy), nota: "clics a WhatsApp hoy" },
  ];

  const leads: LeadFila[] = (data.leads_recientes ?? []).map((l) => {
    const marca = l.medicamento_marca ? ` · ${l.medicamento_marca}` : "";
    return {
      hora: fmtHora(l.fecha_hora),
      medicamento: (l.medicamento_nombre ?? "Medicamento") + marca,
      interaccion: etiquetaInteraccion(l.tipo_interaccion),
      costo: fmtUsd(tarifa),
    };
  });

  return {
    kpis,
    leads,
    leadsSubtitulo: "Este mes",
    resumen: {
      titulo: "Deuda estimada del mes",
      monto: fmtUsd(deuda),
      nota: "Se acumula por cada clic a WhatsApp",
    },
    // El backend aún no entrega una serie diaria → sin gráfica por día.
    barras: undefined,
  };
}

/*
 * Brechas backend ↔ diseño del handoff (a resolver server-side si se quieren):
 *  - % vs mes anterior  → falta agregación del mes previo.
 *  - Conversión         → falta tabla de búsquedas (busquedas_zona = null).
 *  - Distancia por lead → leads_recientes no incluye distancia_m.
 *  - "Estado" del lead  → no existe; se muestra tipo_interaccion en su lugar.
 *  - Saldo prepago      → el modelo es post-pago: se muestra deuda_estimada_usd.
 *  - Leads por día      → falta serie diaria; la gráfica se omite.
 */
