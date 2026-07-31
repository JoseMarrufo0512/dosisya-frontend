import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postLead, registrarLead } from "./leads";
import { API_BASE } from "./api";

function ultimaLlamadaFetch() {
  const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
  const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 201 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postLead — guardia UUID de medicamento_buscado_id", () => {
  // Regresión: un ID sintético no filtrado se enviaría tal cual, el backend
  // lo rechazaría y el lead completo se perdería en silencio (ver leads.ts).
  it("convierte un ID sintético no-UUID (escáner de récipe) en null", () => {
    postLead({
      farmaciaId: "farmacia-1",
      tipo: "clic_whatsapp",
      medicamentoId: "recipe-losartán",
      origen: "escaner_recipe",
    });
    const { body } = ultimaLlamadaFetch();
    expect(body.medicamento_buscado_id).toBeNull();
  });

  it("preserva un UUID válido", () => {
    const uuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", medicamentoId: uuid, origen: "busqueda" });
    const { body } = ultimaLlamadaFetch();
    expect(body.medicamento_buscado_id).toBe(uuid);
  });

  it("preserva un UUID en mayúsculas", () => {
    const uuid = "3FA85F64-5717-4562-B3FC-2C963F66AFA6";
    postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", medicamentoId: uuid, origen: "busqueda" });
    const { body } = ultimaLlamadaFetch();
    expect(body.medicamento_buscado_id).toBe(uuid);
  });

  it("convierte null/undefined en null", () => {
    postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", medicamentoId: null, origen: "busqueda" });
    expect(ultimaLlamadaFetch().body.medicamento_buscado_id).toBeNull();

    postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", medicamentoId: undefined, origen: "busqueda" });
    expect(ultimaLlamadaFetch().body.medicamento_buscado_id).toBeNull();
  });
});

describe("postLead — contrato HTTP (POST /api/v1/leads/)", () => {
  it("apunta a la URL con trailing slash", () => {
    postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", origen: "busqueda" });
    expect(ultimaLlamadaFetch().url).toBe(`${API_BASE}/api/v1/leads/`);
  });

  it("usa método POST y Content-Type JSON", () => {
    postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", origen: "busqueda" });
    const { init } = ultimaLlamadaFetch();
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });

  it("envía el body en snake_case con los campos del contrato", () => {
    postLead({
      farmaciaId: "farmacia-1",
      tipo: "clic_whatsapp",
      medicamentoId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      origen: "lista_medica",
    });
    const { body } = ultimaLlamadaFetch();
    expect(body).toEqual({
      farmacia_id: "farmacia-1",
      tipo_interaccion: "clic_whatsapp",
      medicamento_buscado_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      origen: "lista_medica",
    });
  });

  it("propaga keepalive:true (crítico al abrir wa.me)", () => {
    postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", origen: "busqueda", keepalive: true });
    expect(ultimaLlamadaFetch().init.keepalive).toBe(true);
  });

  it("por defecto keepalive es false", () => {
    postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", origen: "busqueda" });
    expect(ultimaLlamadaFetch().init.keepalive).toBe(false);
  });

  it("nunca lanza si fetch rechaza (fire-and-forget)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(() =>
      postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", origen: "busqueda" }),
    ).not.toThrow();
  });
});

describe("registrarLead — origen por defecto", () => {
  it("usa origen 'busqueda' cuando no se especifica", async () => {
    await registrarLead("farmacia-1", "clic_whatsapp");
    expect(ultimaLlamadaFetch().body.origen).toBe("busqueda");
  });

  it("respeta el origen explícito del caller", async () => {
    await registrarLead("farmacia-1", "clic_whatsapp", undefined, { origen: "escaner_recipe" });
    expect(ultimaLlamadaFetch().body.origen).toBe("escaner_recipe");
  });
});
