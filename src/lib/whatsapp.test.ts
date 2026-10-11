import { describe, expect, it } from "vitest";
import {
  construirMensajeLista,
  construirMensajeProducto,
  construirUrlWhatsApp,
  sanitizarTelefono,
} from "./whatsapp";
import type { ItemLista } from "@/hooks/useListaMedica";

function item(overrides: Partial<ItemLista> = {}): ItemLista {
  return {
    medicamentoId: "med-1",
    nombre: "Losartán",
    presentacion: "Tabletas 50mg x 30",
    cantidad: 1,
    agregadoEn: Date.now(),
    ...overrides,
  };
}

describe("sanitizarTelefono", () => {
  it("deja solo dígitos, quitando +, espacios y guiones", () => {
    expect(sanitizarTelefono("+58 412-123-4567")).toBe("584121234567");
  });

  it("null/undefined/vacío devuelven string vacío", () => {
    expect(sanitizarTelefono(null)).toBe("");
    expect(sanitizarTelefono(undefined)).toBe("");
    expect(sanitizarTelefono("")).toBe("");
  });
});

describe("construirUrlWhatsApp", () => {
  it("devuelve null si la farmacia no tiene teléfono (evita botón roto)", () => {
    expect(construirUrlWhatsApp(null, "hola")).toBeNull();
    expect(construirUrlWhatsApp(undefined, "hola")).toBeNull();
    expect(construirUrlWhatsApp("", "hola")).toBeNull();
  });

  it("genera una URL wa.me con el teléfono sanitizado", () => {
    const url = construirUrlWhatsApp("+58 412-123-4567", "hola");
    expect(url).toBe("https://wa.me/584121234567?text=hola");
  });

  it("URL-encodea el mensaje (saltos de línea, asteriscos, emojis)", () => {
    const mensaje = "Hola 👋\n*negrita*";
    const url = construirUrlWhatsApp("584121234567", mensaje);
    expect(url).toBe(`https://wa.me/584121234567?text=${encodeURIComponent(mensaje)}`);
  });
});

describe("construirMensajeLista", () => {
  it("numera los items con presentación y cantidad", () => {
    const mensaje = construirMensajeLista("Farmacia Central", [
      item({ nombre: "Losartán", presentacion: "Tabletas 50mg x 30", cantidad: 2 }),
      item({ nombre: "Metformina", presentacion: "Tabletas 850mg x 30", cantidad: 1 }),
    ]);
    expect(mensaje).toContain("1. Losartán · Tabletas 50mg x 30 — x2");
    expect(mensaje).toContain("2. Metformina · Tabletas 850mg x 30");
    expect(mensaje).not.toContain("Metformina · Tabletas 850mg x 30 — x1");
  });

  it("incluye la marca comercial entre paréntesis cuando existe", () => {
    const mensaje = construirMensajeLista("Farmacia Central", [item({ marcaComercial: "Cozaar" })]);
    expect(mensaje).toContain("Losartán (Cozaar) ·");
  });

  it("añade la nota de confirmación cuando hay items de escaner_recipe", () => {
    const mensaje = construirMensajeLista("Farmacia Central", [item({ origen: "escaner_recipe" })]);
    expect(mensaje).toContain("confirma contra la receta física");
  });

  it("NO añade la nota si ningún item viene del escáner", () => {
    const mensaje = construirMensajeLista("Farmacia Central", [item({ origen: "lista_medica" })]);
    expect(mensaje).not.toContain("confirma contra la receta física");
  });
});

describe("construirMensajeProducto", () => {
  it("incluye nombre, presentación y precio formateado a 2 decimales", () => {
    const mensaje = construirMensajeProducto(
      "Farmacia Central",
      "Losartán",
      "Tabletas 50mg x 30",
      12.5,
    );
    expect(mensaje).toContain("Losartán (Tabletas 50mg x 30)");
    expect(mensaje).toContain("$12.50");
  });
});

describe("construirMensajeLista — marcador de récipe (hallazgo B-03)", () => {
  it("marca solo las líneas que requieren récipe", () => {
    const mensaje = construirMensajeLista("Farmacia San Rafael", [
      item({ nombre: "Losartán", condicionDispensacion: "receta" }),
      item({ medicamentoId: "med-2", nombre: "Acetaminofén", condicionDispensacion: "libre" }),
    ]);

    expect(mensaje).toContain("1. Losartán · Tabletas 50mg x 30 (requiere récipe)");
    expect(mensaje).toContain("2. Acetaminofén · Tabletas 50mg x 30");
    expect(mensaje).not.toContain("Acetaminofén · Tabletas 50mg x 30 (requiere récipe)");
  });

  it("no marca nada cuando la condición es desconocida", () => {
    const mensaje = construirMensajeLista("Farmacia San Rafael", [
      item({ nombre: "Vitamina C" }), // sin condicionDispensacion
    ]);

    expect(mensaje).not.toContain("requiere récipe");
  });

  it("nunca afirma que el paciente tiene el récipe", () => {
    // Decisión explícita de la spec: el mensaje no pone palabras en boca del
    // paciente. El recordatorio va en la app, no en el texto.
    const mensaje = construirMensajeLista("Farmacia San Rafael", [
      item({ condicionDispensacion: "receta" }),
    ]);

    expect(mensaje).not.toMatch(/tengo (el|mi) récipe/i);
    expect(mensaje).not.toMatch(/llevo (el|mi) récipe/i);
  });

  it("el marcador convive con la nota del escáner de récipe", () => {
    const mensaje = construirMensajeLista("Farmacia San Rafael", [
      item({ origen: "escaner_recipe", condicionDispensacion: "receta" }),
    ]);

    expect(mensaje).toContain("(requiere récipe)");
    expect(mensaje).toContain("leídos por IA");
  });
});

describe("construirMensajeProducto — marcador de récipe", () => {
  it("añade el marcador cuando el producto requiere récipe", () => {
    const mensaje = construirMensajeProducto(
      "Farmacia San Rafael",
      "Losartán",
      "Tabletas 50mg x 30",
      3.5,
      "receta",
    );

    expect(mensaje).toContain("(requiere récipe)");
  });

  it("no añade nada si es libre o desconocido", () => {
    expect(
      construirMensajeProducto("F", "Vitamina C", "Tabletas x 10", 1.5, "libre"),
    ).not.toContain("requiere récipe");
    expect(
      construirMensajeProducto("F", "Vitamina C", "Tabletas x 10", 1.5, null),
    ).not.toContain("requiere récipe");
  });
});
