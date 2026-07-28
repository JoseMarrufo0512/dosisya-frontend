import { API_BASE } from "./api";

/**
 * Tipos de interacción cobrable (Lead CPC).
 *
 * Valores canónicos del enum PostgreSQL (tabla leads_interacciones).
 * El backend también acepta "click_whatsapp" via normalizar_tipo_interaccion(),
 * pero aquí usamos los canónicos directamente para máxima consistencia.
 *
 * Interacciones activas en la UI (todas usan el valor CANÓNICO del enum):
 *   WhatsApp   → "clic_whatsapp"   (ComparadorPanel)
 *   Ver mapa   → "ver_mapa"        (TarjetaResultado)
 *   Guardar    → "capture_pantalla" (TarjetaResultado)
 *   Compartir  → "compartir"       (TarjetaResultado)
 */
export type TipoInteraccion =
  | "clic_whatsapp" // Valor CANÓNICO del enum PostgreSQL — usado en TarjetaResultado
  | "click_whatsapp" // Alias del frontend (aceptado por backend via normalización)
  | "clic_llamar" // Reservado — botón de llamada (próxima iteración)
  | "ver_mapa" // Botón "Ver mapa"
  | "ver_detalle" // Reservado — expansión de tarjeta (próxima iteración)
  | "compartir" // Botón "Compartir"
  | "capture_pantalla"; // Botón "Guardar info"

/**
 * Origen del lead — por dónde entró el medicamento antes de generar el lead.
 * Debe coincidir EXACTO con origen_lead_enum de PostgreSQL (migración 007).
 * "escaner_recipe" es el lead premium facturable.
 */
export type OrigenLead = "busqueda" | "lista_medica" | "escaner_recipe";

// leads_interacciones.medicamento_buscado_id es UUID (nullable). Los items
// añadidos desde el escáner de récipe usan IDs sintéticos ("recipe-losartán")
// que el backend rechazaría → el lead completo se perdería en silencio. Para
// esos casos el lead se envía con medicamento_buscado_id = null: la interacción
// CPC cuenta igual, solo que sin referencia de inventario.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function medicamentoIdOrNull(id: string | number | null | undefined): string | null {
  return id != null && UUID_RE.test(String(id)) ? String(id) : null;
}

/** Campos del POST /api/v1/leads/ (schema de leads_interacciones). */
export interface LeadPayload {
  farmaciaId: string | number;
  tipo: TipoInteraccion;
  /** UUID del medicamento; IDs no-UUID se envían como null (ver UUID_RE). */
  medicamentoId?: string | number | null;
  origen: OrigenLead;
  /** true cuando el clic abre wa.me y el navegador puede abandonar la página. */
  keepalive?: boolean;
}

/**
 * Único punto de envío de leads CPC (POST /api/v1/leads/, con trailing slash).
 * Fire-and-forget: los errores se tragan para nunca romper el UX.
 *
 * ⚠️ Si el backend añade soporte de array en medicamento_buscado_id, este es el
 * único lugar (junto a registrarLeadLista) que hay que cambiar.
 */
export function postLead(p: LeadPayload): void {
  void fetch(`${API_BASE}/api/v1/leads/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      farmacia_id: p.farmaciaId,
      tipo_interaccion: p.tipo,
      medicamento_buscado_id: medicamentoIdOrNull(p.medicamentoId),
      origen: p.origen,
    }),
    // keepalive: la petición sobrevive si el navegador abandona la página
    // (crítico cuando el clic abre wa.me).
    keepalive: p.keepalive ?? false,
  }).catch(() => {
    // Silencio intencional: los leads CPC nunca deben romper el UX
  });
}

/**
 * Registra un lead CPC de una interacción individual (clic en tarjeta).
 *
 * @param farmaciaId  UUID de la farmacia (obtenido de ResultadoFarmacia.farmacia_id)
 * @param tipo        Tipo de interacción (ver TipoInteraccion)
 * @param medicamentoId  UUID del medicamento buscado (opcional)
 */
export async function registrarLead(
  farmaciaId: string,
  tipo: TipoInteraccion,
  medicamentoId?: string,
  opts?: { keepalive?: boolean; origen?: OrigenLead },
): Promise<void> {
  postLead({
    farmaciaId,
    tipo,
    medicamentoId: medicamentoId ?? null,
    // Clic directo en tarjeta = "busqueda" salvo que el caller diga otra cosa
    origen: opts?.origen ?? "busqueda",
    keepalive: opts?.keepalive ?? false,
  });
}
