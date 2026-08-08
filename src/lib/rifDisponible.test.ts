import { afterEach, describe, expect, it, vi } from "vitest";
import { verificarRifDisponible } from "./rifDisponible";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verificarRifDisponible", () => {
  it("devuelve 'available' cuando el backend dice disponible: true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { disponible: true } }), { status: 200 }),
      ),
    );

    const result = await verificarRifDisponible("J-12345678-9");

    expect(result).toBe("available");
  });

  it("devuelve 'taken' cuando el backend dice disponible: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { disponible: false } }), { status: 200 }),
      ),
    );

    const result = await verificarRifDisponible("J-12345678-9");

    expect(result).toBe("taken");
  });

  it("devuelve 'error' cuando el backend responde con status no-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const result = await verificarRifDisponible("J-12345678-9");

    expect(result).toBe("error");
  });

  it("devuelve 'error' cuando fetch rechaza (red caída)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await verificarRifDisponible("J-12345678-9");

    expect(result).toBe("error");
  });

  it("codifica el RIF como query param en la URL correcta", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { disponible: true } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await verificarRifDisponible("J-12345678-9");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/v1/auth/rif-disponible");
    expect(url).toContain("rif=J-12345678-9");
  });
});
