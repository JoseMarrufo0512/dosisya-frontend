import { useEffect, useState } from "react";
import {
  obtenerPosicionActual,
  type ErrorGeolocalizacion,
} from "@/lib/geolocalizacionNavegador";

// Fallback: Acarigua, Venezuela
export const FALLBACK_COORDS = { lat: 9.5569, lng: -69.1982 };

/*
 * Mensaje del banner cuando caemos al centro de Acarigua. NO interpolamos el
 * error crudo: `obtenerPosicionActual` rechaza con un objeto `{ tipo }` (no es
 * Error), así que `String(err)` imprimía literalmente "[object Object]" en la
 * UI. Mapeamos `tipo` → texto humano y accionable, sin jerga técnica.
 */
function mensajeUbicacionFallback(err: unknown): string {
  const base = "Usando ubicación aproximada (Acarigua).";
  const tipo = (err as Partial<ErrorGeolocalizacion> | null)?.tipo;
  if (tipo === "permiso_denegado")
    return `${base} Activa el permiso de ubicación para ver las farmacias más cercanas.`;
  if (tipo === "no_soportado")
    return `${base} Tu navegador no comparte la ubicación.`;
  return `${base} No pudimos obtener tu ubicación.`;
}

export interface GeolocalizacionState {
  lat: number | null;
  lng: number | null;
  error: string | null;
  cargando: boolean;
}

export function useGeolocalizacion(): GeolocalizacionState {
  const [state, setState] = useState<GeolocalizacionState>({
    lat: null,
    lng: null,
    error: null,
    cargando: true,
  });

  useEffect(() => {
    let isMounted = true;
    obtenerPosicionActual()
      .then((pos) => {
        if (!isMounted) return;
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          error: null,
          cargando: false,
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setState({
          lat: FALLBACK_COORDS.lat,
          lng: FALLBACK_COORDS.lng,
          error: mensajeUbicacionFallback(err),
          cargando: false,
        });
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
