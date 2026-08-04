import { describe, expect, test } from "vitest";
import { alLimpiarBusqueda } from "./estadoResultados";

describe("alLimpiarBusqueda", () => {
  test("resetea vista, término de búsqueda y query al estado inicial", () => {
    expect(alLimpiarBusqueda()).toEqual({
      estado: "hero",
      query: "",
      terminoBuscado: "",
    });
  });
});
