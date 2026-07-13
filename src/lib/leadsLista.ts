// ─────────────────────────────────────────────────────────────────────────────
// Lead multi-producto (pivote carrito, julio 2026).
//
// ESTRATEGIA: fan-out — un POST por medicamento.
//
// La tabla leads_interacciones tiene `medicamento_buscado_id` (UUID único),
// no un array. Hasta que el backend añada soporte de columna array, enviamos
// un lead por cada medicamento de la lista. Esto es incluso mejor para
// facturación: cada item del carrito queda registrado individualmente.
//
// ⚠️ keepalive es CRÍTICO: al abrir wa.me el navegador abandona la página y
// mata los fetch pendientes. Con keepalive:true la petición sobrevive al
// unload. Fire-and-forget: jamás bloquea la apertura de WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE } from "./api";
import type { OrigenLead } from "./leads";

// leads_interacciones.medicamento_buscado_id es UUID (nullable). Los items
// añadidos desde el escáner de récipe usan IDs sintéticos ("recipe-losartán")
// que el backend rechazaría → el lead completo se perdería en silencio.
// Para esos casos el lead se envía con medicamento_buscado_id = null: la
// interacción CPC cuenta igual, solo que sin referencia de inventario.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ítem mínimo que el fan-out necesita de la Lista Médica. */
export interface ItemLeadLista {
  medicamentoId: string | number;
  origen?: OrigenLead;
}

export function registrarLeadLista(
  farmaciaId: string | number,
  items: ItemLeadLista[],
): void {
  if (items.length === 0) return;

  // Fan-out: un lead por medicamento (schema actual de leads_interacciones)
  // ⚠️ Si el backend añade soporte de array en el futuro, este es el único
  // lugar que hay que cambiar. Verifica en Supabase que los leads entren con
  // medicamento_buscado_id correcto (uno por fila).
  for (const { medicamentoId, origen } of items) {
    void fetch(`${API_BASE}/api/v1/leads/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmacia_id: farmaciaId,
        tipo_interaccion: "clic_whatsapp",
        medicamento_buscado_id: UUID_RE.test(String(medicamentoId)) ? medicamentoId : null,
        // Items previos a la feature no traen origen → lista_medica (nunca
        // premium por accidente, misma regla que el backend)
        origen: origen ?? "lista_medica",
      }),
      keepalive: true,
    }).catch(() => {
      /* fire-and-forget: nunca interrumpe al usuario */
    });
  }
}
