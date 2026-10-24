import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarMedicamentos } from "./api";

describe("buscarMedicamentos - lead_token", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("propaga data.lead_token de la respuesta", async () => {
    const body = {
      status: "success",
      message: "ok",
      data: { total: 0, resultados: [], lead_token: "tok.abc.def" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
    );
    const resp = await buscarMedicamentos({ q: "x", lat: 1, lng: 2 });
    expect(resp.data?.lead_token).toBe("tok.abc.def");
  });
});
