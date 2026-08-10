import { describe, expect, it } from "vitest";
import { aNumero, parsearParCoordenadas } from "./coordenadas";

// Acarigua centro — la zona real de operación.
const LAT = "9.5578";
const LNG = "-69.2113";

describe("aNumero", () => {
  it("acepta el punto decimal", () => {
    expect(aNumero("9.5578")).toBe(9.5578);
  });

  it("acepta la coma decimal, que es lo que se escribe en es-VE", () => {
    expect(aNumero("9,5578")).toBe(9.5578);
    expect(aNumero("-69,2113")).toBe(-69.2113);
  });

  it("ignora espacios alrededor", () => {
    expect(aNumero("  9.5578  ")).toBe(9.5578);
  });

  it("devuelve NaN para texto que no es número", () => {
    expect(aNumero("por la plaza")).toBeNaN();
  });
});

describe("parsearParCoordenadas", () => {
  it("ambas vacías es 'ausente': el usuario no está fijando ubicación", () => {
    expect(parsearParCoordenadas("", "")).toEqual({ estado: "ausente" });
    expect(parsearParCoordenadas("   ", "  ")).toEqual({ estado: "ausente" });
  });

  it("devuelve las coordenadas cuando el par está completo", () => {
    const res = parsearParCoordenadas(LAT, LNG);
    expect(res).toEqual({ estado: "ok", coords: { lat: 9.5578, lng: -69.2113 } });
  });

  it("normaliza la coma antes de validar", () => {
    const res = parsearParCoordenadas("9,5578", "-69,2113");
    expect(res).toEqual({ estado: "ok", coords: { lat: 9.5578, lng: -69.2113 } });
  });

  it("marca error en el campo que falta si vino una sola", () => {
    const soloLat = parsearParCoordenadas(LAT, "");
    expect(soloLat.estado).toBe("error");
    if (soloLat.estado === "error") expect(soloLat.errores).toHaveProperty("lng");

    const soloLng = parsearParCoordenadas("", LNG);
    expect(soloLng.estado).toBe("error");
    if (soloLng.estado === "error") expect(soloLng.errores).toHaveProperty("lat");
  });

  it("rechaza coordenadas fuera de rango", () => {
    expect(parsearParCoordenadas("91", "0").estado).toBe("error");
    expect(parsearParCoordenadas("0", "-181").estado).toBe("error");
  });

  it("rechaza texto que no es número", () => {
    expect(parsearParCoordenadas("por la plaza", LNG).estado).toBe("error");
  });

  it("acepta (0,0) explícito en vez de tratarlo como vacío", () => {
    // 0 es falsy: una comprobación con `if (!lat)` leería este par como
    // ausente, y una farmacia no podría corregir su ubicación a mano.
    const res = parsearParCoordenadas("0", "0");
    expect(res).toEqual({ estado: "ok", coords: { lat: 0, lng: 0 } });
  });

  it("acepta el borde exacto del rango", () => {
    expect(parsearParCoordenadas("90", "180").estado).toBe("ok");
    expect(parsearParCoordenadas("-90", "-180").estado).toBe("ok");
  });
});
