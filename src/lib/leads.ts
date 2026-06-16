import { API_BASE } from "./api";

export type TipoInteraccion =
  | "clic_whatsapp"
  | "clic_llamar"
  | "ver_mapa"
  | "ver_detalle"
  | "compartir"
  | "capture_pantalla";

export async function registrarLead(
  farmaciaId: string,
  medicamentoId: string,
  tipo: TipoInteraccion,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/leads/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmacia_id: farmaciaId,
        medicamento_buscado_id: medicamentoId,
        tipo_interaccion: tipo,
      }),
    });
  } catch {
    // Silent — analytics nunca debe romper UX
  }
}
