import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";
import { routeTree } from "./routeTree.gen";
import { getRequestNonce } from "./lib/csp";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Nonce por-request (SSR) → <Scripts> lo pone en cada <script> inline de
  // hidratación, para la CSP bloqueante sin 'unsafe-inline'. En cliente es undefined.
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ssr: { nonce: getRequestNonce() },
  });

  if (!router.isServer) {
    Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router));
  }

  return router;
};
