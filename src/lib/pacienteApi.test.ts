import { describe, it, expect, vi, beforeEach } from "vitest";
import { registro, login, googleLogin } from "./pacienteApi";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: async () => body,
    }),
  );
}

const SESION = {
  paciente_id: "p1",
  auth_token: "t",
  nombre: "Ana",
  apellido: "Pérez",
  correo: "ana@b.com",
  telefono: "+584141234567",
  documento: "V1",
  genero: "femenino" as const,
};

describe("pacienteApi", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("registro devuelve la sesión parseada", async () => {
    mockFetchOnce(201, { data: SESION });
    const s = await registro({
      nombre: "Ana",
      apellido: "Pérez",
      correo: "ana@b.com",
      telefono: "04141234567",
      documento: "V1",
      genero: "femenino",
      password: "supersecreta",
    });
    expect(s.auth_token).toBe("t");
    expect(s.correo).toBe("ana@b.com");
  });

  it("registro mapea el 409 con el code de {error:{code}}", async () => {
    mockFetchOnce(409, { error: { code: "correo_en_uso", message: "x" } });
    await expect(
      registro({
        nombre: "Ana",
        apellido: "P",
        correo: "ana@b.com",
        telefono: "04141234567",
        documento: "V1",
        genero: null,
        password: "supersecreta",
      }),
    ).rejects.toThrow(/correo ya está registrado/i);
  });

  it("login lanza en 401", async () => {
    mockFetchOnce(401, null);
    await expect(login("ana@b.com", "mala")).rejects.toThrow();
  });

  it("googleLogin devuelve 'completar' cuando el perfil está incompleto", async () => {
    mockFetchOnce(200, {
      data: {
        perfil_incompleto: true,
        preregistro_token: "pre",
        prefill: { nombre: "Nuevo", correo: "n@gmail.com" },
      },
    });
    const r = await googleLogin("idtok");
    expect(r.tipo).toBe("completar");
    if (r.tipo === "completar") expect(r.preregistroToken).toBe("pre");
  });

  it("googleLogin devuelve 'sesion' cuando la cuenta existe", async () => {
    mockFetchOnce(200, { data: SESION });
    const r = await googleLogin("idtok");
    expect(r.tipo).toBe("sesion");
  });
});
