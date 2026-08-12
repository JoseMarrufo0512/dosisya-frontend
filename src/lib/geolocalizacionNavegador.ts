/*
 * geolocalizacionNavegador.ts — llamada de bajo nivel a getCurrentPosition.
 *
 * Vive aparte porque la usan dos consumidores con estrategias distintas ante
 * el fallo: useGeolocalizacion (buscador público) cae en silencio al centro
 * de Acarigua; CampoUbicacion (registro/panel/superadmin) NO puede caer en
 * silencio porque eso registraría a una farmacia en una dirección que no es
 * la suya, así que avisa y pide las coordenadas a mano. Antes cada uno
 * reimplementaba la misma llamada con las mismas opciones — divergían si
 * alguien tocaba una sin la otra.
 */

export type ErrorGeolocalizacion =
  | { tipo: "no_soportado" }
  | { tipo: "permiso_denegado" }
  | { tipo: "otro" };

const OPCIONES_GPS: PositionOptions = { enableHighAccuracy: true, timeout: 10000 };

export function obtenerPosicionActual(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject({ tipo: "no_soportado" } satisfies ErrorGeolocalizacion);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) =>
        reject({
          tipo: err.code === err.PERMISSION_DENIED ? "permiso_denegado" : "otro",
        } satisfies ErrorGeolocalizacion),
      OPCIONES_GPS,
    );
  });
}
