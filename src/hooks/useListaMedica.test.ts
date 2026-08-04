import { describe, expect, test } from "vitest";
import { claveItem, farmaciaUnicaDeLista, type ItemLista } from "./useListaMedica";

function crearItem(overrides: Partial<ItemLista> = {}): ItemLista {
  return {
    medicamentoId: "med-1",
    nombre: "Acetaminofén",
    presentacion: "Tabletas 500mg x 10",
    cantidad: 1,
    agregadoEn: Date.now(),
    farmaciaId: "farmacia-1",
    farmaciaNombre: "Farmacia San Rafael Premium",
    farmaciaWhatsapp: "+584125551001",
    ...overrides,
  };
}

describe("claveItem", () => {
  test("combina farmaciaId y medicamentoId", () => {
    expect(claveItem({ farmaciaId: "f1", medicamentoId: "m1" })).toBe("f1-m1");
  });

  test("dos farmacias distintas con el mismo medicamento producen claves distintas", () => {
    const a = claveItem({ farmaciaId: "f1", medicamentoId: "m1" });
    const b = claveItem({ farmaciaId: "f2", medicamentoId: "m1" });
    expect(a).not.toBe(b);
  });

  test("sin farmaciaId (récipe IA) sigue siendo una clave estable", () => {
    expect(claveItem({ farmaciaId: undefined, medicamentoId: "recipe-losartan" })).toBe(
      "sin-farmacia-recipe-losartan",
    );
  });
});

describe("farmaciaUnicaDeLista", () => {
  test("lista vacía → null", () => {
    expect(farmaciaUnicaDeLista([])).toBeNull();
  });

  test("todos los ítems de la misma farmacia → la devuelve", () => {
    const lista = [crearItem(), crearItem({ medicamentoId: "med-2" })];
    expect(farmaciaUnicaDeLista(lista)).toEqual({
      id: "farmacia-1",
      nombre: "Farmacia San Rafael Premium",
      whatsapp: "+584125551001",
    });
  });

  test("ítems de farmacias distintas → null (hay que elegir)", () => {
    const lista = [crearItem(), crearItem({ medicamentoId: "med-2", farmaciaId: "farmacia-2" })];
    expect(farmaciaUnicaDeLista(lista)).toBeNull();
  });

  test("ítem sin farmacia (del escáner de récipe) → null", () => {
    const lista = [crearItem({ farmaciaId: undefined, farmaciaNombre: undefined, farmaciaWhatsapp: undefined })];
    expect(farmaciaUnicaDeLista(lista)).toBeNull();
  });
});
