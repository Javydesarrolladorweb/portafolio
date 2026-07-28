import { config as appConfig } from '../src/config.js';
import { logger } from '../src/logger.js';
import { isValidSignature, readRawBody } from '../src/whatsapp/verify.js';
import { handleWebhookPayload } from '../src/handler.js';

/**
 * Vercel entrega el cuerpo ya parseado por defecto, pero la firma de Meta se
 * calcula sobre los bytes originales: reparsear y re-serializar cambia el JSON
 * y la validación falla siempre. De ahí `bodyParser: false`.
 */
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === 'GET') return handleVerification(req, res);
  if (req.method === 'POST') return handleEvent(req, res);

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}

/**
 * Meta llama con GET una sola vez, al guardar la URL del webhook en el panel.
 * Espera el `hub.challenge` en texto plano si el token coincide.
 */
function handleVerification(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === appConfig.whatsapp.verifyToken) {
    logger.info('Webhook verificado por Meta');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  }

  logger.warn('Verificación de webhook rechazada', { mode });
  return res.status(403).end();
}

async function handleEvent(req, res) {
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    logger.error('No se pudo leer el cuerpo de la petición', { reason: error.message });
    return res.status(400).end();
  }

  if (
    !isValidSignature(rawBody, req.headers['x-hub-signature-256'], appConfig.whatsapp.appSecret)
  ) {
    logger.warn('Firma de webhook inválida — petición descartada');
    return res.status(401).end();
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    logger.warn('Cuerpo de webhook no es JSON válido');
    return res.status(400).end();
  }

  // Respondemos 200 ANTES de llamar a Claude. Meta reintenta el webhook si
  // tardamos, y una respuesta del modelo puede pasar de 20 segundos. La función
  // sigue viva hasta que el handler resuelve, así que el await de abajo se
  // ejecuta igual.
  res.status(200).end();

  try {
    await handleWebhookPayload(payload);
  } catch (error) {
    // Ya respondimos 200: aquí solo queda registrar.
    logger.error('Fallo procesando el webhook', { reason: error.message, stack: error.stack });
  }
}
