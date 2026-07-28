import crypto from 'node:crypto';

/**
 * Valida la cabecera X-Hub-Signature-256 que Meta envía en cada webhook.
 *
 * Sin esta validación, cualquiera que conozca la URL puede inyectar mensajes
 * falsos y hacer que el agente responda (y gaste tokens) a peticiones que
 * nunca pasaron por WhatsApp.
 *
 * @param {Buffer} rawBody Cuerpo crudo, sin parsear. Reparsear y re-serializar
 *   el JSON cambia los bytes y la firma deja de coincidir.
 * @param {string | undefined} signatureHeader Valor de `x-hub-signature-256`.
 * @param {string} appSecret App Secret de Meta.
 */
export function isValidSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const received = signatureHeader.slice('sha256='.length);

  // Ambos son hex de 64 caracteres; si la longitud difiere, timingSafeEqual
  // lanza en vez de devolver false, así que lo comprobamos antes.
  if (received.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(received, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

/**
 * Lee el cuerpo crudo de una petición Node (IncomingMessage) como Buffer.
 * Necesario porque la firma se calcula sobre los bytes originales.
 */
export async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
