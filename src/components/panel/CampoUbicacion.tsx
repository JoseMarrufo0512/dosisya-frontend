/*
 * CampoUbicacion — captura de coordenadas de una farmacia.
 *
 * Lo usan el wizard de registro y la sección Configuración del panel. Es el
 * único camino para que una farmacia salga del (0,0) con el que nace: mientras
 * siga ahí, ST_DWithin la descarta del buscador y su inventario es invisible.
 *
 * A diferencia de useGeolocalizacion —que para el buscador público cae en
 * silencio al centro de Acarigua— aquí un fallback silencioso registraría a la
 * farmacia en una dirección que no es la suya. Si el navegador falla se avisa
 * y se piden las coordenadas a mano.
 */

import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CampoUbicacionProps {
  lat: string;
  lng: string;
  onLatChange: (v: string) => void;
  onLngChange: (v: string) => void;
  /** Prefijo de los `id` para no colisionar si hay dos instancias montadas. */
  idPrefix?: string;
  errorLat?: string;
  errorLng?: string;
  /** Se llama cuando el navegador no puede dar la ubicación. */
  onAviso?: (mensaje: string) => void;
  /** Se llama tras detectar la posición, para feedback (toast, etc.). */
  onDetectada?: () => void;
  /**
   * Oculta el botón de GPS. El superadmin ubica farmacias ajenas desde su
   * escritorio: su posición no es la de la farmacia, así que ofrecerle
   * "usar mi ubicación actual" solo sirve para meter datos errados.
   */
  mostrarGps?: boolean;
}

export function CampoUbicacion({
  lat,
  lng,
  onLatChange,
  onLngChange,
  idPrefix = "ubi",
  errorLat,
  errorLng,
  onAviso,
  onDetectada,
  mostrarGps = true,
}: CampoUbicacionProps) {
  const [ubicando, setUbicando] = useState(false);

  const usarMiUbicacion = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      onAviso?.("Tu navegador no permite obtener la ubicación. Escribe las coordenadas a mano.");
      return;
    }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLatChange(pos.coords.latitude.toFixed(6));
        onLngChange(pos.coords.longitude.toFixed(6));
        setUbicando(false);
        onDetectada?.();
      },
      (err) => {
        setUbicando(false);
        onAviso?.(
          err.code === err.PERMISSION_DENIED
            ? "Diste permiso denegado a la ubicación. Actívalo o escribe las coordenadas a mano."
            : "No se pudo obtener la ubicación. Escribe las coordenadas a mano.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      {mostrarGps && (
        <Button
          type="button"
          variant="outline"
          onClick={usarMiUbicacion}
          disabled={ubicando}
          className="w-full sm:w-auto"
        >
          {ubicando ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Detectando…
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 mr-2" /> Usar mi ubicación actual
            </>
          )}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-lat`} style={{ fontSize: 12 }}>
            Latitud
          </Label>
          <Input
            id={`${idPrefix}-lat`}
            value={lat}
            onChange={(e) => onLatChange(e.target.value)}
            placeholder="9.5578"
            inputMode="decimal"
            aria-invalid={Boolean(errorLat)}
          />
          {errorLat && <p className="text-xs text-destructive">{errorLat}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-lng`} style={{ fontSize: 12 }}>
            Longitud
          </Label>
          <Input
            id={`${idPrefix}-lng`}
            value={lng}
            onChange={(e) => onLngChange(e.target.value)}
            placeholder="-69.2113"
            inputMode="decimal"
            aria-invalid={Boolean(errorLng)}
          />
          {errorLng && <p className="text-xs text-destructive">{errorLng}</p>}
        </div>
      </div>
    </div>
  );
}
