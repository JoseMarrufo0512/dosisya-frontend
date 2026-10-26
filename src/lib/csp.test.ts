import { describe, it, expect, afterEach } from "vitest";
import {
  generateNonce,
  construirCsp,
  getRequestNonce,
  _setNonceReader,
} from "./csp";

describe("generateNonce", () => {
  it("devuelve base64 de ≥128 bits (16 bytes → 24 chars)", () => {
    const n = generateNonce();
    expect(n).toMatch(/^[A-Za-z0-9+/]{22,}={0,2}$/);
    // 16 bytes en base64 = 24 caracteres (con padding)
    expect(atob(n).length).toBe(16);
  });

  it("es único entre llamadas", () => {
    const vistos = new Set(Array.from({ length: 200 }, () => generateNonce()));
    expect(vistos.size).toBe(200);
  });
});

describe("construirCsp", () => {
  const nonce = "AbC123+/xyz==";
  const csp = construirCsp(nonce);

  it("script-src usa nonce + strict-dynamic y NO unsafe-inline", () => {
    const script = csp.match(/script-src ([^;]*)/)?.[1] ?? "";
    expect(script).toContain(`'nonce-${nonce}'`);
    expect(script).toContain("'strict-dynamic'");
    expect(script).toContain("'self'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  it("style-src conserva unsafe-inline (bajo riesgo) + Google Fonts", () => {
    const style = csp.match(/style-src ([^;]*)/)?.[1] ?? "";
    expect(style).toContain("'unsafe-inline'");
    expect(style).toContain("https://fonts.googleapis.com");
  });

  it("conserva connect-src con PostHog y Sentry", () => {
    const connect = csp.match(/connect-src ([^;]*)/)?.[1] ?? "";
    expect(connect).toContain("https://*.posthog.com");
    expect(connect).toContain("https://us.i.posthog.com");
    expect(connect).toContain("https://*.ingest.us.sentry.io");
  });

  it("mantiene las directivas de endurecimiento", () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("font-src e img-src intactos", () => {
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com data:");
    expect(csp).toContain("img-src 'self' data: blob: https:");
  });
});

describe("lector de nonce por-request (indirección isomorfa)", () => {
  afterEach(() => _setNonceReader(() => undefined));

  it("por defecto devuelve undefined (cliente / sin SSR)", () => {
    expect(getRequestNonce()).toBeUndefined();
  });

  it("devuelve lo que el servidor cablee", () => {
    _setNonceReader(() => "nonce-de-prueba");
    expect(getRequestNonce()).toBe("nonce-de-prueba");
  });
});

describe("construirCsp — Google Identity Services", () => {
  it("permite accounts.google.com en connect-src y frame-src", () => {
    const csp = construirCsp("n0nce");
    expect(csp).toMatch(/connect-src[^;]*https:\/\/accounts\.google\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/accounts\.google\.com/);
  });
});
