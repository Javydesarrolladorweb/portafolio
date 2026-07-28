#!/usr/bin/env node
/**
 * Servidor local para desarrollo. Monta el mismo handler que usa Vercel, así
 * que lo que pruebas aquí es exactamente lo que se despliega.
 *
 *   node --env-file=.env scripts/dev-server.js
 *
 * Para que Meta pueda alcanzarlo, expón el puerto con un túnel:
 *
 *   ngrok http 3000
 *
 * y pon la URL pública + /api/webhook en el panel de webhooks de Meta.
 */

import http from 'node:http';
import handler from '../api/webhook.js';

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);

const server = http.createServer((req, res) => {
  if (!req.url.startsWith('/api/webhook')) {
    res.statusCode = 404;
    return res.end('Not found');
  }

  // El handler usa la API de respuesta de Vercel (status/send), que no existe
  // en http.ServerResponse. La añadimos aquí.
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.send = (body) => {
    res.end(body);
    return res;
  };

  Promise.resolve(handler(req, res)).catch((error) => {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Webhook escuchando en http://localhost:${PORT}/api/webhook`);
});
