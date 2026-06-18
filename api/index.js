export const config = {
  runtime: 'edge',
};

import server from '../dist/server/server.js';

export default function (request) {
  return server.fetch(request, process.env, {});
}
