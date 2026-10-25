import { AsyncLocalStorage } from "node:async_hooks";
import * as Sentry from "@sentry/tanstackstart-react";

import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { generateNonce, construirCsp, _setNonceReader } from "./lib/csp";

// Nonce por-request aislado por AsyncLocalStorage (Fluid Compute reusa la
// instancia entre requests concurrentes: un global filtraría nonces).
const nonceAls = new AsyncLocalStorage<string>();
_setNonceReader(() => nonceAls.getStore());

/** Emite la CSP bloqueante (con nonce) en respuestas HTML. */
function aplicarCsp(response: Response, nonce: string): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  try {
    response.headers.set("Content-Security-Policy", construirCsp(nonce));
    return response;
  } catch {
    // Headers inmutables: reconstruir (api/ssr.js bufferiza, no streamea al cliente).
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", construirCsp(nonce));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  nonce: string,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const error = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  Sentry.captureException(error);
  console.error(error);
  return new Response(renderErrorPage(nonce), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const nonce = generateNonce();
    return nonceAls.run(nonce, async () => {
      try {
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        return aplicarCsp(await normalizeCatastrophicSsrResponse(response, nonce), nonce);
      } catch (error) {
        Sentry.captureException(error);
        console.error(error);
        return aplicarCsp(
          new Response(renderErrorPage(nonce), {
            status: 500,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
          nonce,
        );
      }
    });
  },
};
