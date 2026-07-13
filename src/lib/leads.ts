import { API_BASE } from "./api";

/**
 * Tipos de interacción cobrable (Lead CPC).
 *
 * Valores canónicos del enum PostgreSQL (tabla leads_interacciones).
 * El backend también acepta "click_whatsapp" via normalizar_tipo_interaccion(),
 * pero aquí usamos los canónicos directamente para máxima consistencia.
 *
 * Botones actuales de TarjetaResultado:
 *   WhatsApp   → "click_whatsapp"
 *   Ver mapa   → "ver_mapa"
 *   Guardar    → "capture_pantalla"
 *   Compartir  → "compartir"
 */
export type TipoInteraccion =
  | "clic_whatsapp"    // Valor CANÓNICO del enum PostgreSQL — usado en TarjetaResultado
  | "click_whatsapp"   // Alias del frontend (aceptado por backend via normalización)
  | "clic_llamar"      // Reservado — botón de llamada (próxima iteración)
  | "ver_mapa"         // Botón "Ver mapa"
  | "ver_detalle"      // Reservado — expansión de tarjeta (próxima iteración)
  | "compartir"        // Botón "Compartir"
  | "capture_pantalla"; // Botón "Guardar info"

/**
 * Registra un lead CPC en el backend de forma silenciosa.
 * Los errores se capturan internamente para nunca romper el UX.
 *
 * @param farmaciaId  UUID de la farmacia (obtenido de ResultadoFarmacia.farmacia_id)
 * @param tipo        Tipo de interacción (ver TipoInteraccion)
 * @param medicamentoId  UUID del medicamento buscado (opcional)
 */
export async function registrarLead(
  farmaciaId: string,
  tipo: TipoInteraccion,
  medicamentoId?: string,
  opts?: { keepalive?: boolean },
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/leads/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmacia_id: farmaciaId,
        tipo_interaccion: tipo,
        medicamento_buscado_id: medicamentoId ?? null,
      }),
      // keepalive: la petición sobrevive si el navegador abandona la página
      // (crítico cuando el clic abre wa.me — ver leadsLista.ts)
      keepalive: opts?.keepalive ?? false,
    });
  } catch {
    // Silencio intencional: los leads CPC nunca deben romper el UX
  }
}
