// ─────────────────────────────────────────────────────────────────────────────
// Escáner de Récipe con IA — modo farmacéutico (panel B2B, protegido con JWT)
//
// Igual que recipeIA.ts: el frontend solo transporta la imagen, SOLO el
// backend habla con el proveedor de IA (regla #5 de CLAUDE.md). Este modo
// devuelve campos técnicos de dispensación en vez del resumen simple del
// escáner público — nunca datos de paciente/médico.
//
// Contrato verificado contra DosisYa-Backend/src/dosisya/routers/farmacias.py:
//   POST /api/v1/farmacias/{farmacia_id}/ia/analizar-recipe — requiere
//   Authorization: Bearer <token> y plan Premium. Mismos límites de imagen
//   (MIME, 10 MB) que el escáner público. Envelope:
//   {status, message, data:[{nombre_comercial, principio_activo,
//   concentracion_mg, forma_farmaceutica, cantidad_total_unidades,
//   posologia_detallada, via_administracion}]}
//
// Spec: docs/superpowers/specs/2026-08-05-modo-farmaceutico-escaner-recipe-design.md
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE } from "./api";
import { comprimirImagen } from "./comprimirImagen";
import { validarImagen } from "./recipeIA";

export { validarImagen };

/** Un medicamento extraído por la IA en modo farmacéutico. */
export interface MedicamentoRecetaFarmacia {
  nombre_comercial: string;
  principio_activo: string;
  concentracion_mg: string;
  forma_farmaceutica: string;
  cantidad_total_unidades: string;
  posologia_detallada: string;
  via_administracion: string;
}

/**
 * Igual que MedicamentoRecetaFarmacia, con un id estable de sesión de
 * escaneo (no persiste, no viene del backend) — usado como `key` de React.
 */
export interface MedicamentoRecetaFarmaciaUI extends MedicamentoRecetaFarmacia {
  id: string;
}

/** Respuesta envuelta del endpoint POST .../ia/analizar-recipe (farmacia). */
export interface RespuestaRecipeFarmacia {
  status: "success" | "error";
  message: string;
  data: MedicamentoRecetaFarmacia[] | null;
}

const RECIPE_TIMEOUT_MS = 45_000;

/** Lee credenciales de sesión guardadas por el login del panel B2B. */
function credencialesSesion(): { farmaciaId: string; token: string } | null {
  if (typeof window === "undefined") return null;
  const farmaciaId = localStorage.getItem("farmacia_id");
  const token = localStorage.getItem("auth_token");
  if (!farmaciaId || !token) return null;
  return { farmaciaId, token };
}

/**
 * Envía la imagen del récipe al backend para análisis en modo farmacéutico.
 * Requiere sesión de farmacia activa (login del panel B2B) y plan Premium.
 */
export async function analizarRecipeFarmacia(
  imagen: File,
): Promise<RespuestaRecipeFarmacia> {
  const cred = credencialesSesion();
  if (!cred) {
    return {
      status: "error",
      message: "Sesión no encontrada. Inicia sesión de nuevo.",
      data: null,
    };
  }

  const imagenAEnviar = await comprimirImagen(imagen);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECIPE_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.append("file", imagenAEnviar);

    const res = await fetch(
      `${API_BASE}/api/v1/farmacias/${cred.farmaciaId}/ia/analizar-recipe`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cred.token}` },
        body: formData,
        signal: controller.signal,
      },
    );

    if (res.status === 403) {
      return {
        status: "error",
        message: "Esta función requiere el plan Premium.",
        data: null,
      };
    }

    if (res.status === 401) {
      return {
        status: "error",
        message: "Tu sesión expiró. Inicia sesión de nuevo.",
        data: null,
      };
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        status: "error",
        message: txt || `Error del servidor (${res.status})`,
        data: null,
      };
    }

    const json = (await res.json()) as RespuestaRecipeFarmacia;
    return json;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        status: "error",
        message:
          "El análisis tardó demasiado. Intenta con una foto más clara o con mejor iluminación.",
        data: null,
      };
    }
    return {
      status: "error",
      message: "Error de conexión. Revisa tu internet e intenta de nuevo.",
      data: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
