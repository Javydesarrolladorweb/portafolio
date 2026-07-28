import { config } from './config.js';
import { logger } from './logger.js';
import { getStore } from './db/store.js';
import { generateReply } from './agent/index.js';
import { sendText, markAsReadAndTyping } from './whatsapp/client.js';

/**
 * Punto de entrada de la lógica de negocio. Recibe el payload ya parseado y
 * verificado del webhook y procesa todo lo que traiga dentro.
 *
 * Meta puede meter varios `entry` y varios `changes` en una sola llamada, así
 * que hay que recorrerlo todo, no quedarse con `entry[0].changes[0]`.
 */
export async function handleWebhookPayload(payload) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      // Mensajes salientes que TÚ escribiste desde la app de WhatsApp Business.
      // Con Coexistence activo, Meta los reenvía aquí. Es la señal de que un
      // humano tomó la conversación: callamos al bot un rato.
      for (const echo of value.message_echoes ?? []) {
        await handleHumanTakeover(echo);
      }

      // Acuses de entrega/lectura. No requieren acción, pero los errores de
      // entrega sí conviene verlos en los logs.
      for (const status of value.statuses ?? []) {
        if (status.errors?.length) {
          logger.warn('Error de entrega de WhatsApp', {
            status: status.status,
            errors: status.errors,
          });
        }
      }

      for (const message of value.messages ?? []) {
        await handleIncomingMessage(message, value);
      }
    }
  }
}

async function handleHumanTakeover(echo) {
  // Meta ha usado tanto `to` como `recipient_id` para el destinatario del eco
  // según la versión de la API. Aceptamos ambos en vez de fallar en silencio.
  const waId = echo.to ?? echo.recipient_id;
  if (!waId) {
    logger.warn('Eco sin destinatario identificable', { keys: Object.keys(echo) });
    return;
  }

  const store = getStore();
  const pausedUntil = new Date(
    Date.now() + config.agent.humanTakeoverMinutes * 60_000
  ).toISOString();

  await store.upsertConversation(waId, { pausedUntil });
  logger.info('Humano tomó la conversación desde la app', {
    waId,
    minutos: config.agent.humanTakeoverMinutes,
  });
}

async function handleIncomingMessage(message, value) {
  const waId = message.from;
  const store = getStore();

  const displayName =
    value.contacts?.find((contact) => contact.wa_id === waId)?.profile?.name ?? null;

  const conversation = await store.upsertConversation(waId, { displayName });

  const text = extractIncomingText(message);

  // La deduplicación va ANTES de responder. Meta reintenta el webhook si no
  // devolvemos 200 en unos segundos, y sin esto el cliente recibiría la misma
  // respuesta dos o tres veces.
  const isNew = await store.appendMessage(waId, {
    role: 'user',
    content: text ?? `[${message.type}]`,
    waMessageId: message.id,
  });

  if (!isNew) {
    logger.info('Mensaje duplicado ignorado', { waId, messageId: message.id });
    return;
  }

  if (isPaused(conversation)) {
    logger.info('Bot en pausa, no responde', { waId, pausedUntil: conversation.pausedUntil });
    return;
  }

  await markAsReadAndTyping(message.id);

  // Solo sabemos leer texto. El resto lo reconocemos y lo derivamos, en vez de
  // ignorarlo en silencio.
  if (text === null) {
    const reply =
      'Recibí tu archivo, pero por aquí solo puedo leer texto. Cuéntame en un mensaje qué necesitas y te ayudo; si hace falta que Javier lo revise, se lo paso.';
    await deliver(waId, reply);
    return;
  }

  try {
    const history = await store.getHistory(waId, config.agent.historyLimit);
    // getHistory ya incluye el mensaje que acabamos de guardar; lo quitamos
    // para no mandarlo dos veces.
    const previous = history.slice(0, -1);

    const { text: reply, escalated } = await generateReply({
      history: previous,
      userMessage: text,
      context: { waId, displayName },
    });

    await deliver(waId, reply);

    logger.info('Respuesta enviada', { waId, escalated });
  } catch (error) {
    logger.error('Fallo generando la respuesta', { waId, reason: error.message });

    // Que el cliente no se quede sin respuesta ante un fallo nuestro.
    await deliver(
      waId,
      'Estoy teniendo un problema técnico en este momento. Le aviso a Javier para que te responda directamente.'
    ).catch(() => {});

    await store.upsertConversation(waId, {
      pausedUntil: new Date(Date.now() + config.agent.humanTakeoverMinutes * 60_000).toISOString(),
    });
  }
}

async function deliver(waId, text) {
  await sendText(waId, text);
  await getStore().appendMessage(waId, { role: 'assistant', content: text });
}

export function isPaused(conversation) {
  if (!conversation?.pausedUntil) return false;
  return new Date(conversation.pausedUntil).getTime() > Date.now();
}

/**
 * Extrae texto de los tipos de mensaje que sí sabemos leer.
 * Devuelve null para audio, imagen, documento, ubicación, etc.
 */
export function extractIncomingText(message) {
  switch (message.type) {
    case 'text':
      return message.text?.body?.trim() || null;
    case 'button':
      return message.button?.text?.trim() || null;
    case 'interactive':
      return (
        message.interactive?.button_reply?.title?.trim() ||
        message.interactive?.list_reply?.title?.trim() ||
        null
      );
    default:
      return null;
  }
}
