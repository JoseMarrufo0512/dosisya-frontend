import { afterEach, describe, expect, it, vi } from "vitest";
import {
  actualizarPerfilGuardado,
  cerrarSesionPaciente,
  esPacienteLogueado,
  getPacientePerfil,
  getPacienteToken,
  guardarSesionPaciente,
} from "./pacienteAuth";


// El entorno de vitest es "node" (sin jsdom): simulamos window + localStorage
// en memoria para que el módulo (que guarda con `typeof window`) funcione.
const memoriaStorage = new Map<string, string>();
vi.stubGlobal("window", {});
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoriaStorage.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memoriaStorage.set(k, String(v));
  },
  removeItem: (k: string) => {
    memoriaStorage.delete(k);
  },
  clear: () => memoriaStorage.clear(),
});

afterEach(() => localStorage.clear());

const RESP = {
  paciente_id: "pac-1",
  auth_token: "tok-abc",
  telefono: "+584141234567",
  nombre: "Ana",
  es_nuevo: false,
};

describe("pacienteAuth", () => {
  it("guarda y recupera la sesión", () => {
    guardarSesionPaciente(RESP);
    expect(getPacienteToken()).toBe("tok-abc");
    expect(esPacienteLogueado()).toBe(true);
    expect(getPacientePerfil()).toEqual({
      paciente_id: "pac-1",
      telefono: "+584141234567",
      nombre: "Ana",
    });
  });

  it("sin sesión devuelve null/false", () => {
    expect(getPacienteToken()).toBeNull();
    expect(esPacienteLogueado()).toBe(false);
    expect(getPacientePerfil()).toBeNull();
  });

  it("cerrar sesión limpia todo", () => {
    guardarSesionPaciente(RESP);
    cerrarSesionPaciente();
    expect(getPacienteToken()).toBeNull();
    expect(getPacientePerfil()).toBeNull();
  });

  it("actualizarPerfilGuardado cambia el perfil sin tocar el token", () => {
    guardarSesionPaciente(RESP);
    actualizarPerfilGuardado({ paciente_id: "pac-1", telefono: "+584141234567", nombre: "Ana María" });
    expect(getPacienteToken()).toBe("tok-abc"); // token intacto
    expect(getPacientePerfil()?.nombre).toBe("Ana María");
  });
});
