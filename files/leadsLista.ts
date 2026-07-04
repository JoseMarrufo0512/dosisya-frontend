// ─────────────────────────────────────────────────────────────────────────────
// Lead multi-producto (pivote carrito, julio 2026).
//
// ⚠️ keepalive es CRÍTICO: al abrir wa.me el navegador abandona la página y
// mata cualquier fetch pendiente. Sin `keepalive: true` el lead se pierde en
// silencio (= facturación perdida). Con keepalive la petición sobrevive a la
// navegación. Fire-and-forget: jamás bloquea la apertura de WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? "";

export function registrarLeadLista(
  farmaciaId: string | number,
  medicamentoIds: Array<string | number>,
): void {
  if (medicamentoIds.length === 0) return;

  void fetch(`${API_URL}/api/v1/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // ⚠️ Si tu backend espera OTRO nombre para el array (p. ej. "medicamentos"),
    // este es el ÚNICO lugar que hay que tocar. Verifica en Supabase que el
    // primer lead de prueba se inserte correctamente.
    body: JSON.stringify({
      farmacia_id: farmaciaId,
      tipo_accion: "clic_whatsapp",
      medicamento_ids: medicamentoIds,
    }),
    keepalive: true,
  }).catch(() => {
    /* fire-and-forget: nunca interrumpe al usuario */
  });
}
