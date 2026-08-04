import { describe, expect, test } from "vitest";
import { alternarComparacion, resolverSeleccionados, claveResultado } from "./filtros";
import type { ResultadoFarmacia } from "./api";

function crearResultado(overrides: Partial<ResultadoFarmacia> = {}): ResultadoFarmacia {
  return {
    farmacia_id: "farmacia-1",
    farmacia_nombre: "Farmacia Test",
    direccion: "Calle Falsa 123",
    whatsapp: "+584121234567",
    nivel_suscripcion: "gratuita",
    es_premium: false,
    tiene_delivery: false,
    lat: 9.55,
    lng: -69.2,
    medicamento_id: "med-1",
    medicamento_nombre: "Acetaminofén",
    marca_comercial: null,
    presentacion: "Tabletas 500mg x 10",
    precio_usd: 1.5,
    precio_ves: 55,
    stock_disponible: true,
    distancia_m: 800,
    score_similitud: 1,
    ...overrides,
  };
}

describe("alternarComparacion", () => {
  test("agrega una clave nueva a la selección", () => {
    expect(alternarComparacion([], "a", 3)).toEqual(["a"]);
  });

  test("quita una clave ya seleccionada (toggle)", () => {
    expect(alternarComparacion(["a", "b"], "a", 3)).toEqual(["b"]);
  });

  test("no agrega más allá del máximo permitido", () => {
    expect(alternarComparacion(["a", "b", "c"], "d", 3)).toEqual(["a", "b", "c"]);
  });
});

describe("resolverSeleccionados", () => {
  test("resuelve claves contra los resultados actuales, en el orden de las claves", () => {
    const r1 = crearResultado({ farmacia_id: "f1" });
    const r2 = crearResultado({ farmacia_id: "f2" });
    const claves = [claveResultado(r2), claveResultado(r1)];
    expect(resolverSeleccionados(claves, [r1, r2])).toEqual([r2, r1]);
  });

  test("descarta claves que ya no están en los resultados actuales", () => {
    const r1 = crearResultado({ farmacia_id: "f1" });
    const claveObsoleta = "farmacia-fantasma-med-1";
    expect(resolverSeleccionados([claveObsoleta, claveResultado(r1)], [r1])).toEqual([r1]);
  });
});
