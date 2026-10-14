import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { solicitarCodigo, verificarCodigo } from "./pacienteApi";

// El entorno de vitest es "node" (sin jsdom): simulamos window + localStorage
// en memoria, igual que pacienteAuth.test.ts, para que localStorage.clear() funcione.
const memoriaStorage = new Map<string, string>();
vi.stubGlobal("window", {});
// Se define con defineProperty (no vi.stubGlobal) para que vi.unstubAllGlobals()
// del afterEach no lo borre antes de que localStorage.clear() se ejecute.
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: {
    getItem: (k: string) => memoriaStorage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoriaStorage.set(k, String(v));
    },
    removeItem: (k: string) => {
      memoriaStorage.delete(k);
    },
    clear: () => memoriaStorage.clear(),
  },
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function ok(json: unknown) {
  return { ok: true, status: 200, json: async () => json } as Response;
}

describe("pacienteApi", () => {
  it("solicitarCodigo hace POST con el teléfono", async () => {
    fetchMock.mockResolvedValue(ok({ status: "success" }));
    await solicitarCodigo("04141234567");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/paciente/auth/solicitar-codigo",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ telefono: "04141234567" }),
      }),
    );
  });

  it("verificarCodigo devuelve la sesión parseada de data", async () => {
    const resp = {
      paciente_id: "pac-1",
      auth_token: "tok",
      telefono: "+584141234567",
      nombre: "",
      es_nuevo: true,
    };
    fetchMock.mockResolvedValue(ok({ data: resp }));
    const r = await verificarCodigo("04141234567", "042317");
    expect(r).toEqual(resp);
  });

  it("verificarCodigo lanza en 401", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response);
    await expect(verificarCodigo("04141234567", "000000")).rejects.toThrow();
  });
});
