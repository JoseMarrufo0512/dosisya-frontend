// Runtime Node.js estándar (default de Vercel Functions / Fluid Compute), no
// Edge: dependencias como tailwind-merge y partes internas de TanStack Start
// SSR no son compatibles con el runtime Edge y rompían el deploy.
import server from '../dist/server/server.js';

export default function (request) {
  return server.fetch(request, process.env, {});
}
