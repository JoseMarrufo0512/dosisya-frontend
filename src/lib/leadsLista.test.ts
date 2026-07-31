import { describe, expect, it, vi } from "vitest";
import * as leadsModule from "./leads";
import { registrarLeadLista } from "./leadsLista";

describe("registrarLeadLista — fan-out (un POST por medicamento)", () => {
  it("emite exactamente un lead por cada item de la lista", () => {
    const postLeadSpy = vi.spyOn(leadsModule, "postLead").mockImplementation(() => {});

    registrarLeadLista("farmacia-1", [
      { medicamentoId: "med-a" },
      { medicamentoId: "med-b" },
      { medicamentoId: "med-c" },
    ]);

    expect(postLeadSpy).toHaveBeenCalledTimes(3);
    expect(postLeadSpy.mock.calls.map((c) => c[0].medicamentoId)).toEqual([
      "med-a",
      "med-b",
      "med-c",
    ]);
    postLeadSpy.mockRestore();
  });

  it("lista vacía no emite ningún lead", () => {
    const postLeadSpy = vi.spyOn(leadsModule, "postLead").mockImplementation(() => {});

    registrarLeadLista("farmacia-1", []);

    expect(postLeadSpy).not.toHaveBeenCalled();
    postLeadSpy.mockRestore();
  });

  it("usa origen 'lista_medica' por defecto cuando el item no lo especifica", () => {
    const postLeadSpy = vi.spyOn(leadsModule, "postLead").mockImplementation(() => {});

    registrarLeadLista("farmacia-1", [{ medicamentoId: "med-a" }]);

    expect(postLeadSpy.mock.calls[0][0].origen).toBe("lista_medica");
    postLeadSpy.mockRestore();
  });

  it("respeta el origen explícito de cada item (p. ej. escaner_recipe)", () => {
    const postLeadSpy = vi.spyOn(leadsModule, "postLead").mockImplementation(() => {});

    registrarLeadLista("farmacia-1", [
      { medicamentoId: "med-a", origen: "escaner_recipe" },
      { medicamentoId: "med-b" },
    ]);

    expect(postLeadSpy.mock.calls[0][0].origen).toBe("escaner_recipe");
    expect(postLeadSpy.mock.calls[1][0].origen).toBe("lista_medica");
    postLeadSpy.mockRestore();
  });

  it("cada lead se envía con tipo_interaccion clic_whatsapp y keepalive:true", () => {
    const postLeadSpy = vi.spyOn(leadsModule, "postLead").mockImplementation(() => {});

    registrarLeadLista("farmacia-1", [{ medicamentoId: "med-a" }]);

    const arg = postLeadSpy.mock.calls[0][0];
    expect(arg.tipo).toBe("clic_whatsapp");
    expect(arg.keepalive).toBe(true);
    postLeadSpy.mockRestore();
  });
});
