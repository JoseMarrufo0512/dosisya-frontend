/**
 * Vercel Node.js serverless function — SSR adapter for TanStack Start
 *
 * TanStack Start compila el servidor como un Web Fetch API handler (ESM).
 * Vercel en runtime Node.js entrega un IncomingMessage (http estándar de Node).
 * Este módulo adapta ambos mundos: construye una URL absoluta desde los headers
 * x-forwarded-*, convierte el cuerpo a Buffer y pasa un Request válido al handler.
 */

"use strict";

let _server;

async function getServer() {
  if (!_server) {
    // dist/server/server.js es ESM — dynamic import funciona desde CJS
    const mod = await import("../dist/server/server.js");
    _server = mod.default;
  }
  return _server;
}

export default async function handler(req, res) {
  const server = await getServer();

  // Reconstruir URL absoluta (x-forwarded-* los pone Vercel/el proxy)
  const proto = (req.headers["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  const absoluteUrl = `${proto}://${host}${req.url}`;

  // Leer el body para métodos que lo admiten
  let body;
  if (!["GET", "HEAD"].includes((req.method || "GET").toUpperCase())) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length > 0) {
      body = Buffer.concat(chunks);
    }
  }

  // Construir los headers filtrando los hop-by-hop
  const HOP_BY_HOP = new Set(["connection", "keep-alive", "proxy-connection"]);
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (!val || HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(val) ? val.join(", ") : String(val));
  }

  // Web Fetch API Request con URL absoluta
  const request = new Request(absoluteUrl, {
    method: req.method || "GET",
    headers,
    body: body && body.length > 0 ? body : undefined,
  });

  try {
    const response = await server.fetch(request, process.env, {
      // ctx mínimo compatible con Cloudflare Workers y Vercel
      waitUntil: (promise) => {
        promise?.catch?.(() => {});
      },
    });

    // Escribir status
    res.statusCode = response.status;

    // Copiar headers de respuesta (omitir hop-by-hop)
    const SKIP_RESP = new Set([
      "connection",
      "keep-alive",
      "transfer-encoding",
      "upgrade",
      "proxy-authenticate",
      "proxy-authorization",
    ]);
    for (const [key, value] of response.headers.entries()) {
      if (!SKIP_RESP.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    // Enviar cuerpo como Buffer (maneja binarios, texto y streams)
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    console.error("[SSR Error]", err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
  }
};
