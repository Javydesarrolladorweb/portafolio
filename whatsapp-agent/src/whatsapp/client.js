import { config } from '../config.js';
import { logger } from '../logger.js';

function graphUrl(path) {
  const { apiVersion, phoneNumberId } = config.whatsapp;
  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/${path}`;
}

async function post(path, payload) {
  const response = await fetch(graphUrl(path), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.whatsapp.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Los errores de Meta traen un objeto `error` con code y message. Los
    // registramos completos porque el código concreto es lo único que
    // distingue "token caducado" de "fuera de la ventana de 24h".
    logger.error('Error de la Graph API de WhatsApp', {
      status: response.status,
      error: body.error,
    });
    throw new Error(
      `WhatsApp API ${response.status}: ${body.error?.message ?? 'error desconocido'}`
    );
  }

  return body;
}

/**
 * Envía un mensaje de texto libre. Solo funciona dentro de la ventana de
 * servicio de 24 horas desde el último mensaje del cliente. Fuera de ella hay
 * que usar una plantilla aprobada (`sendTemplate`).
 *
 * WhatsApp corta los textos largos, así que troceamos en bloques de 4000
 * caracteres respetando saltos de párrafo cuando se puede.
 */
export async function sendText(to, text) {
  for (const chunk of splitMessage(text)) {
    await post('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: chunk, preview_url: true },
    });
  }
}

/**
 * Envía una plantilla aprobada. Es la única forma de escribir a un cliente
 * fuera de la ventana de 24h (y la única que tiene coste por mensaje).
 */
export async function sendTemplate(to, templateName, languageCode = 'es', components = []) {
  return post('messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length ? { components } : {}),
    },
  });
}

/**
 * Marca el mensaje como leído (doble check azul) y muestra "escribiendo…".
 * Es cosmético, pero sin esto el cliente ve el mensaje sin leer durante los
 * segundos que tarda Claude en responder y suele reescribir.
 */
export async function markAsReadAndTyping(messageId) {
  try {
    await post('messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    });
  } catch (error) {
    // Nunca debe tumbar la respuesta: es un adorno.
    logger.warn('No se pudo marcar como leído', { reason: error.message });
  }
}

/** WhatsApp rechaza cuerpos de texto de más de 4096 caracteres. */
export function splitMessage(text, limit = 4000) {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return [trimmed];

  const chunks = [];
  let rest = trimmed;

  while (rest.length > limit) {
    // Preferimos cortar en un salto de párrafo, luego en un salto de línea,
    // luego en un espacio. El corte duro es el último recurso.
    const window = rest.slice(0, limit);
    const breakpoint = Math.max(
      window.lastIndexOf('\n\n'),
      window.lastIndexOf('\n'),
      window.lastIndexOf(' ')
    );
    const cut = breakpoint > limit * 0.5 ? breakpoint : limit;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) chunks.push(rest);
  return chunks;
}
