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

export function registrarLeadLista(
  farmaciaId: string | number,
  medicamentoIds: Array<string | number>,
): void {
  if (medicamentoIds.length === 0) return;

  // Fan-out: un lead por medicamento (schema actual de leads_interacciones)
  // ⚠️ Si el backend añade soporte de array en el futuro, este es el único
  // lugar que hay que cambiar. Verifica en Supabase que los leads entren con
  // medicamento_buscado_id correcto (uno por fila).
  for (const medId of medicamentoIds) {
    void fetch(`${API_BASE}/api/v1/leads/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmacia_id: farmaciaId,
        tipo_interaccion: "clic_whatsapp",
        medicamento_buscado_id: medId,
      }),
      keepalive: true,
    }).catch(() => {
      /* fire-and-forget: nunca interrumpe al usuario */
    });
  }
}
