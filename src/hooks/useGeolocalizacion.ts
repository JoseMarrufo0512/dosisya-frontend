import { useEffect, useState } from "react";

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
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({
        lat: FALLBACK_COORDS.lat,
        lng: FALLBACK_COORDS.lng,
        error: "Usando ubicación predeterminada: Acarigua",
        cargando: false,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          error: null,
          cargando: false,
        });
      },
      () => {
        setState({
          lat: FALLBACK_COORDS.lat,
          lng: FALLBACK_COORDS.lng,
          error: "Usando ubicación predeterminada: Acarigua",
          cargando: false,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  return state;
}
