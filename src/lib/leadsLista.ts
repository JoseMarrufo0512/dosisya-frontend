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

export async function registrarLeadLista(
  farmaciaId: string | number,
  items: ItemLeadLista[],
): Promise<void> {
  if (items.length === 0) return;

  // Fan-out: un lead por medicamento (schema actual de leads_interacciones).
  // Disparamos los N POST en PARALELO (Promise.all), no serializados: al
  // abrir wa.me el navegador pasa a segundo plano de inmediato, y no hay
  // garantía de que la pestaña siga viva el tiempo suficiente para esperar
  // leads secuenciales — eso arriesgaría perder leads 2..N (revenue CPC
  // real). keepalive:true protege cada request individualmente aunque la
  // página se descargue. postLead nunca rechaza (ver leads.ts), así que
  // Promise.all es seguro: no hay excepción de un item que pueda abortar
  // los demás.
  await Promise.all(
    items.map(({ medicamentoId, origen }) =>
      postLead({
        farmaciaId,
        tipo: "clic_whatsapp",
        medicamentoId,
        // Items previos a la feature no traen origen → lista_medica (nunca
        // premium por accidente, misma regla que el backend)
        origen: origen ?? "lista_medica",
        keepalive: true,
      }),
    ),
  );
}
