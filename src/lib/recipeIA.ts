// ─────────────────────────────────────────────────────────────────────────────
// Escáner de Récipe con IA — cliente API (spec receta-ia-y-carrito.md, Flujo 2)
//
// El frontend envía la imagen al backend FastAPI; SOLO el backend habla con
// Gemini (regla #5 de CLAUDE.md). Este módulo solo transporta la imagen y
// recibe el JSON de resultados.
//
// MOCK TEMPORAL: mientras el endpoint del backend no exista, usamos un mock
// con datos hardcoded y un delay simulado. Busca "MOCK" para ubicar el código
// que hay que eliminar cuando el endpoint esté listo.
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE } from "./api";

// ── Tipos del contrato backend ──────────────────────────────────────────────

/** Un medicamento extraído por Gemini Vision del récipe. */
export interface MedicamentoReceta {
  /** Nombre del principio activo o marca detectada (ej: "Losartán") */
  medicamento: string;
  /** Cantidad recetada (ej: "2 cajas", "30 tabletas") */
  cantidad: string;
  /** Alternativas sugeridas por principio activo (pueden ser 0..N) */
  alternativas: string[];
}

/** Respuesta envuelta del endpoint POST /api/v1/ia/analizar-recipe */
export interface RespuestaRecipe {
  status: "success" | "error";
  message: string;
  data: MedicamentoReceta[] | null;
}

// ── Constantes ──────────────────────────────────────────────────────────────

/** Timeout de la llamada (Gemini Vision puede tardar 10-30s). */
const RECIPE_TIMEOUT_MS = 45_000;

/** Tamaño máximo aceptado (10 MB). */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** MIME types aceptados para la imagen del récipe. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

// ── Validación ──────────────────────────────────────────────────────────────

export function validarImagen(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Solo se aceptan imágenes (JPEG, PNG, WebP o HEIC).";
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `La imagen es muy grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.`;
  }
  return null; // válida
}

// ── MOCK TEMPORAL — eliminar cuando el backend implemente el endpoint ────────
// Simula una respuesta exitosa tras 3s de delay para desarrollar la UI.

const MOCK_HABILITADO = true; // ← Cambiar a false cuando el backend esté listo

const MOCK_RESPUESTA: RespuestaRecipe = {
  status: "success",
  message: "Récipe analizado exitosamente.",
  data: [
    {
      medicamento: "Losartán",
      cantidad: "2 cajas",
      alternativas: ["Valsartán", "Candesartán"],
    },
    {
      medicamento: "Metformina",
      cantidad: "1 caja",
      alternativas: ["Gliclazida"],
    },
    {
      medicamento: "Atorvastatina",
      cantidad: "1 caja",
      alternativas: ["Rosuvastatina", "Simvastatina"],
    },
  ],
};

async function mockAnalizarRecipe(): Promise<RespuestaRecipe> {
  await new Promise((r) => setTimeout(r, 3000));
  return MOCK_RESPUESTA;
}

// ── Función principal ───────────────────────────────────────────────────────

/**
 * Envía la imagen del récipe al backend para análisis con Gemini Vision.
 *
 * @param imagen - Archivo de imagen capturado por la cámara o seleccionado.
 * @returns Respuesta tipada con los medicamentos extraídos.
 */
export async function analizarRecipe(imagen: File): Promise<RespuestaRecipe> {
  // ── MOCK: quitar este bloque cuando el endpoint exista ──
  if (MOCK_HABILITADO) {
    return mockAnalizarRecipe();
  }
  // ── FIN MOCK ──

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECIPE_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.append("file", imagen);

    const res = await fetch(`${API_BASE}/api/v1/ia/analizar-recipe`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        status: "error",
        message: txt || `Error del servidor (${res.status})`,
        data: null,
      };
    }

    const json = (await res.json()) as RespuestaRecipe;
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
