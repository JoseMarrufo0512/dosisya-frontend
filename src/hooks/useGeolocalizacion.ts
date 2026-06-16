import { useCallback, useEffect, useState } from "react";
import type { Coords } from "@/lib/api";

// Fallback: Barquisimeto, Venezuela
export const FALLBACK_COORDS: Coords = { lat: 10.0647, lng: -69.3471 };

export type GeoStatus = "idle" | "loading" | "ok" | "denied";

export function useGeolocalizacion(autoRequest = true) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("ok");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const setManual = useCallback((c: Coords) => {
    setCoords(c);
    setStatus("ok");
  }, []);

  const useFallback = useCallback(() => {
    setCoords(FALLBACK_COORDS);
    setStatus("ok");
  }, []);

  useEffect(() => {
    if (autoRequest) request();
  }, [autoRequest, request]);

  return { coords, status, request, setManual, useFallback };
}
