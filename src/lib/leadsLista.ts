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

import { postLead, type OrigenLead } from "./leads";

/** Ítem mínimo que el fan-out necesita de la Lista Médica. */
export interface ItemLeadLista {
  medicamentoId: string | number;
  origen?: OrigenLead;
}

/**
 * Fire-and-forget para quien no espera esta promesa (SelectorFarmacia abre
 * wa.me sin esperarla) — pero es una promesa real: `postLead` retorna el
 * fetch, así que este `await` sí serializa, uno a la vez, en vez de disparar
 * N fetches simultáneos que saturan la cola de conexiones del navegador
 * (máx. 6 por origen) y provocaban que leads masivos se abortaran o perdieran.
 */
export async function registrarLeadLista(
  farmaciaId: string | number,
  items: ItemLeadLista[],
): Promise<void> {
  if (items.length === 0) return;

  // Fan-out: un lead por medicamento (schema actual de leads_interacciones).
  for (const { medicamentoId, origen } of items) {
    await postLead({
      farmaciaId,
      tipo: "clic_whatsapp",
      medicamentoId,
      // Items previos a la feature no traen origen → lista_medica (nunca
      // premium por accidente, misma regla que el backend)
      origen: origen ?? "lista_medica",
      keepalive: true,
    });
  }
}
