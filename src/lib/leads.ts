import { API_BASE } from "./api";

export type TipoInteraccion =
  | "click_whatsapp"
  | "clic_llamar"
  | "ver_mapa"
  | "compartir"
  | "capture_pantalla";

export async function registrarLead(
  farmaciaId: string,
  tipo: TipoInteraccion,
  medicamentoId?: string,
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
    });
  } catch {
    // Silencio intencional: los leads CPC nunca deben romper el UX
  }
}
