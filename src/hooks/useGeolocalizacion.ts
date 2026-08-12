import { useEffect, useState } from "react";
import { obtenerPosicionActual } from "@/lib/geolocalizacionNavegador";

// Fallback: Acarigua, Venezuela
export const FALLBACK_COORDS = { lat: 9.5569, lng: -69.1982 };

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
          error: `Usando ubicación predeterminada: Acarigua (${err instanceof Error ? err.message : String(err)})`,
          cargando: false,
        });
      });
    return () => { isMounted = false; };
  }, []);

  return state;
}
