/*
 * coordenadas.ts — validación del par lat/lng de una farmacia.
 *
 * Vive aparte porque lo usan dos superficies (el wizard de registro y la
 * sección Configuración del panel) y el backend las trata igual en ambas:
 * `lat` y `lng` viajan juntas o no viajan — una sola devuelve 400.
 *
 * Por qué importa: una farmacia sin coordenadas nace en (0,0), y el buscador
 * la descarta por ST_DWithin (radio máximo 50 km; (0,0) queda a ~7 700 km de
 * Acarigua). Su inventario existe pero ningún paciente lo ve.
 */

import { z } from "zod";

export const coordsSchema = z.object({
  lat: z
    .number({ message: "Latitud inválida" })
    .min(-90, "Entre -90 y 90")
    .max(90, "Entre -90 y 90"),
  lng: z
    .number({ message: "Longitud inválida" })
    .min(-180, "Entre -180 y 180")
    .max(180, "Entre -180 y 180"),
});

export type Coordenadas = z.infer<typeof coordsSchema>;

/** "9,5578" y "9.5578" → 9.5578. En es-VE el separador decimal es la coma. */
export const aNumero = (s: string) => Number(s.trim().replaceAll(",", "."));

export type ResultadoCoordenadas =
  /** Ambas vacías: el usuario no está fijando ubicación. */
  | { estado: "ausente" }
  | { estado: "ok"; coords: Coordenadas }
  | { estado: "error"; errores: Record<string, string> };

/**
 * Valida el par tal como lo escribió el usuario, en texto.
 *
 * Se trabaja sobre strings y no sobre números para poder distinguir "vacío" de
 * "0": una farmacia sin configurar está literalmente en 0, y tratar el 0 como
 * ausente la dejaría sin poder corregirse.
 */
export function parsearParCoordenadas(
  latTexto: string,
  lngTexto: string,
): ResultadoCoordenadas {
  const latVacio = latTexto.trim() === "";
  const lngVacio = lngTexto.trim() === "";

  if (latVacio && lngVacio) return { estado: "ausente" };

  if (latVacio !== lngVacio) {
    return {
      estado: "error",
      errores: {
        [latVacio ? "lat" : "lng"]: "Completa latitud y longitud, o deja ambas vacías",
      },
    };
  }

  const parsed = coordsSchema.safeParse({
    lat: aNumero(latTexto),
    lng: aNumero(lngTexto),
  });
  if (parsed.success) return { estado: "ok", coords: parsed.data };

  const errores: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const k = issue.path[0] as string;
    if (k && !errores[k]) errores[k] = issue.message;
  }
  return { estado: "error", errores };
}
