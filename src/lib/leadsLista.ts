// ─────────────────────────────────────────────────────────────────────────────
// Lead multi-producto (pivote carrito, julio 2026).
//
// ⚠️ keepalive es CRÍTICO: al abrir wa.me el navegador abandona la página y
// mata cualquier fetch pendiente. Sin `keepalive: true` el lead se pierde en
// silencio (= facturación perdida). Con keepalive la petición sobrevive a la
// navegación. Fire-and-forget: jamás bloquea la apertura de WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE } from "./api";

export function registrarLeadLista(
  farmaciaId: string | number,
  medicamentoIds: Array<string | number>,
): void {
  if (medicamentoIds.length === 0) return;

  void fetch(`${API_BASE}/api/v1/leads/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // ⚠️ Si tu backend espera OTRO nombre para el array (p. ej. "medicamentos")
    // o para el tipo (p. ej. "tipo_accion"), este es el ÚNICO lugar que hay
    // que tocar. Verifica en Supabase que el primer lead de prueba se inserte.
    // El campo canónico del enum PostgreSQL en leads.ts es "tipo_interaccion".
    body: JSON.stringify({
      farmacia_id: farmaciaId,
      tipo_interaccion: "clic_whatsapp",
      medicamento_ids: medicamentoIds,
    }),
    keepalive: true,
  }).catch(() => {
    /* fire-and-forget: nunca interrumpe al usuario */
  });
}
