// ─────────────────────────────────────────────────────────────────────────────
// Compresión de imagen en el navegador — canvas nativo, sin dependencias.
//
// Las fotos de récipe salen del celular en 3-8 MB; comprimirlas a ~1600px
// JPEG reduce el upload (redes lentas) y el procesamiento de Gemini Vision
// (spec: receta-ia-optimizacion-gemini.md).
//
// Garantía: NUNCA lanza ni bloquea el flujo. Si el navegador no puede
// decodificar (ej. HEIC en Chrome) o el resultado sale más grande, devuelve
// el archivo original — el backend acepta hasta 10 MB igual que antes.
// ─────────────────────────────────────────────────────────────────────────────

/** Lado mayor máximo tras redimensionar. Suficiente para letra manuscrita. */
const MAX_DIMENSION_PX = 1600;

/** Calidad JPEG del resultado (0-1). */
const JPEG_QUALITY = 0.8;

/** Por debajo de este tamaño no vale la pena recomprimir. */
const MIN_BYTES_PARA_COMPRIMIR = 300 * 1024;

/** Reemplaza la extensión por .jpg (el output del canvas siempre es JPEG). */
function nombreJpeg(nombre: string): string {
  const base = nombre.replace(/\.[^.]+$/, "");
  return `${base || "recipe"}.jpg`;
}

/**
 * Comprime una imagen a JPEG de máx. 1600px de lado mayor.
 *
 * @param file - Imagen original de cámara o galería.
 * @returns El archivo comprimido, o el original si comprimir no aplica/falla.
 */
export async function comprimirImagen(file: File): Promise<File> {
  if (file.size < MIN_BYTES_PARA_COMPRIMIR) return file;

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const escala = Math.min(
        1,
        MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height),
      );
      const ancho = Math.max(1, Math.round(bitmap.width * escala));
      const alto = Math.max(1, Math.round(bitmap.height * escala));

      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, ancho, alto);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );

      // Si el canvas falló o "comprimir" agrandó el archivo, usar el original.
      if (!blob || blob.size >= file.size) return file;

      return new File([blob], nombreJpeg(file.name), { type: "image/jpeg" });
    } finally {
      bitmap.close();
    }
  } catch {
    // HEIC en Chrome, imagen corrupta, navegador viejo… → enviar original.
    return file;
  }
}
