import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cambiarEstadoFarmacia,
  getFarmaciasAdmin,
  requiereUbicacionAntesDeActivar,
  type EstadoAfiliacion,
} from "./adminApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ACARIGUA = { lat: 9.5578, lng: -69.2113 };

/** fetch falso que captura el body y devuelve 200. */
function stubFetch() {
  const spy = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: "success", data: {} }), { status: 200 }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

function bodyDe(spy: ReturnType<typeof stubFetch>) {
  return JSON.parse(spy.mock.calls[0][1].body as string);
}

describe("requiereUbicacionAntesDeActivar", () => {
  it("interrumpe al activar una farmacia sin coordenadas", () => {
    expect(requiereUbicacionAntesDeActivar({ ubicacion_configurada: false }, "activa")).toBe(true);
  });

  it("no interrumpe si ya tiene coordenadas", () => {
    expect(requiereUbicacionAntesDeActivar({ ubicacion_configurada: true }, "activa")).toBe(false);
  });

  it.each<EstadoAfiliacion>(["inactiva", "pendiente"])(
    "no interrumpe al pasar a '%s': suspender o rechazar no necesitan ubicación",
    (estado) => {
      expect(requiereUbicacionAntesDeActivar({ ubicacion_configurada: false }, estado)).toBe(false);
    },
  );

  it("no interrumpe si el backend no manda el campo", () => {
    // Un backend anterior al cambio no envía `ubicacion_configurada`; bloquear
    // ahí dejaría al superadmin sin poder aprobar a nadie.
    expect(requiereUbicacionAntesDeActivar({}, "activa")).toBe(false);
    expect(requiereUbicacionAntesDeActivar({ ubicacion_configurada: undefined }, "activa")).toBe(
      false,
    );
  });
});

describe("cambiarEstadoFarmacia", () => {
  it("manda las coordenadas cuando se le pasan", async () => {
    const spy = stubFetch();
    await cambiarEstadoFarmacia("tok", "f1", "activa", ACARIGUA);
    expect(bodyDe(spy)).toEqual({ estado_afiliacion: "activa", ...ACARIGUA });
  });

  it("omite lat/lng si no se le pasan, para que el backend conserve la ubicación", async () => {
    const spy = stubFetch();
    await cambiarEstadoFarmacia("tok", "f1", "inactiva");
    const body = bodyDe(spy);
    expect(body).toEqual({ estado_afiliacion: "inactiva" });
    // Mandar lat/lng en null o undefined no es lo mismo que omitirlas.
    expect("lat" in body).toBe(false);
    expect("lng" in body).toBe(false);
  });

  it("usa PATCH sobre la ruta del estado, sin trailing slash", async () => {
    const spy = stubFetch();
    await cambiarEstadoFarmacia("tok", "abc-123", "activa");
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain("/api/v1/admin/farmacias/abc-123/estado");
    expect(String(url).endsWith("/estado")).toBe(true);
    expect(init.method).toBe("PATCH");
  });

  it("traduce 401 a UNAUTHORIZED para que la superficie cierre sesión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    await expect(cambiarEstadoFarmacia("tok", "f1", "activa")).rejects.toThrow("UNAUTHORIZED");
  });
});

/**
 * Un 200 con el cuerpo mal formado hacía estallar `data.farmacias.filter(...)`
 * durante el render de TablaFarmacias. Como el throw ocurría dentro del árbol
 * de React, se llevaba la ruta COMPLETA: el superadmin perdía las pestañas y
 * solo veía el error genérico en inglés, sin forma de reintentar.
 *
 * Validando en el queryFn, el fallo se convierte en el estado de error que la
 * vista ya sabe mostrar.
 */
describe("getFarmaciasAdmin — respuestas mal formadas", () => {
  const responder = (body: unknown, status = 200) =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
    );

  it("devuelve la lista cuando el cuerpo es correcto", async () => {
    responder({ data: { farmacias: [{ id: "f1" }], totales: { pendientes: 1 } } });
    const r = await getFarmaciasAdmin("tok");
    expect(r.farmacias).toHaveLength(1);
    expect(r.totales.pendientes).toBe(1);
  });

  it.each([
    ["sin campo data", { status: "success" }],
    ["data en null", { data: null }],
    ["data sin farmacias", { data: { totales: {} } }],
    ["farmacias no es un array", { data: { farmacias: "muchas" } }],
    ["cuerpo que no es JSON", null],
  ])("lanza en vez de dejar reventar el render: %s", async (_caso, body) => {
    if (body === null) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 200 })));
    } else {
      responder(body);
    }
    await expect(getFarmaciasAdmin("tok")).rejects.toThrow();
  });

  it("rellena los totales que falten en vez de fallar: la lista vale más", async () => {
    responder({ data: { farmacias: [] } });
    const r = await getFarmaciasAdmin("tok");
    expect(r.totales).toEqual({
      total_farmacias: 0,
      pendientes: 0,
      sin_ubicacion: 0,
      leads_mes_red: 0,
      deuda_red_usd: 0,
    });
  });

  it("conserva los totales que sí vienen", async () => {
    responder({ data: { farmacias: [], totales: { total_farmacias: 9, sin_ubicacion: 3 } } });
    const r = await getFarmaciasAdmin("tok");
    expect(r.totales.total_farmacias).toBe(9);
    expect(r.totales.sin_ubicacion).toBe(3);
    expect(r.totales.leads_mes_red).toBe(0); // el que falta, en neutro
  });
});
