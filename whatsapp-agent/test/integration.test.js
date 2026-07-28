import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Prueba de extremo a extremo del flujo del webhook, interceptando `fetch`.
 * Tanto el cliente de WhatsApp como el SDK de Anthropic salen por ahí, así que
 * un solo stub cubre las dos integraciones y ejercita el camino real:
 * payload → deduplicación → agente → bucle de herramientas → envío.
 */

process.env.WHATSAPP_TOKEN = 'token-de-prueba';
process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
process.env.WHATSAPP_VERIFY_TOKEN = 'verify';
process.env.WHATSAPP_APP_SECRET = 'secret';
process.env.ANTHROPIC_API_KEY = 'sk-ant-de-prueba';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

const { handleWebhookPayload } = await import('../src/handler.js');
const { resetStore } = await import('../src/db/store.js');

const realFetch = globalThis.fetch;

// El SDK de Anthropic captura `globalThis.fetch` cuando se construye el
// cliente, y el cliente se cachea a nivel de módulo. Si cada test reemplazase
// `globalThis.fetch`, el cliente seguiría usando el stub del primer test. Por
// eso instalamos UN solo stub permanente que delega en un handler mutable.
let currentHandler = null;

globalThis.fetch = async (url, options) => {
  if (!currentHandler) return realFetch(url, options);
  return currentHandler(url, options);
};

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function claudeMessage(content, stopReason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

/**
 * @param {object[]} claudeReplies Respuestas a devolver, en orden.
 * @returns {{ sent: string[], anthropicCalls: object[], restore: () => void }}
 */
function stubFetch(claudeReplies) {
  const sent = [];
  const anthropicCalls = [];
  const queue = [...claudeReplies];

  currentHandler = async (url, options = {}) => {
    const href = typeof url === 'string' ? url : url.toString();
    const body = options.body ? JSON.parse(options.body) : {};

    if (href.includes('api.anthropic.com')) {
      anthropicCalls.push(body);
      const next = queue.shift();
      assert.ok(next, 'se pidió a Claude más veces de las previstas');
      return jsonResponse(next);
    }

    if (href.includes('graph.facebook.com')) {
      if (body.type === 'text') sent.push(body.text.body);
      return jsonResponse({ messages: [{ id: 'wamid.OUT' }] });
    }

    throw new Error(`fetch inesperado a ${href}`);
  };

  return {
    sent,
    anthropicCalls,
    restore: () => {
      currentHandler = null;
    },
  };
}

function inboundPayload(text, messageId = 'wamid.IN1') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '0',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '573106255406', phone_number_id: '1234567890' },
              contacts: [{ profile: { name: 'Ana Gómez' }, wa_id: '573001112233' }],
              messages: [
                {
                  from: '573001112233',
                  id: messageId,
                  timestamp: '1750000000',
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

test('responde a un mensaje entrante de texto', async () => {
  resetStore();
  const stub = stubFetch([
    claudeMessage([{ type: 'text', text: 'Hola Ana, claro que sí. ¿Qué tipo de sitio necesitas?' }]),
  ]);

  try {
    await handleWebhookPayload(inboundPayload('Hola, necesito una página web'));

    assert.equal(stub.sent.length, 1);
    assert.match(stub.sent[0], /Hola Ana/);

    // El prompt de sistema debe ir cacheado y las herramientas presentes.
    const [request] = stub.anthropicCalls;
    assert.equal(request.model, 'claude-opus-5');
    assert.equal(request.system[0].cache_control.type, 'ephemeral');
    assert.equal(request.tools.length, 3);
    assert.equal(request.output_config.effort, 'low');
    assert.deepEqual(request.messages, [
      { role: 'user', content: 'Hola, necesito una página web' },
    ]);
  } finally {
    stub.restore();
  }
});

test('ignora el reintento de Meta para el mismo mensaje', async () => {
  resetStore();
  const stub = stubFetch([claudeMessage([{ type: 'text', text: 'Respuesta única' }])]);

  try {
    const payload = inboundPayload('¿Cuánto cuesta una tienda online?', 'wamid.DUP');
    await handleWebhookPayload(payload);
    await handleWebhookPayload(payload); // reintento idéntico

    assert.equal(stub.sent.length, 1, 'solo debe enviarse una respuesta');
    assert.equal(stub.anthropicCalls.length, 1, 'solo debe llamarse a Claude una vez');
  } finally {
    stub.restore();
  }
});

test('ejecuta una herramienta y continúa el bucle', async () => {
  resetStore();
  const stub = stubFetch([
    claudeMessage(
      [
        { type: 'text', text: 'Perfecto, lo anoto.' },
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'guardar_lead',
          input: { nombre: 'Ana Gómez', servicio: 'tienda online' },
        },
      ],
      'tool_use'
    ),
    claudeMessage([{ type: 'text', text: 'Listo Ana. ¿Para cuándo lo necesitas?' }]),
  ]);

  try {
    await handleWebhookPayload(inboundPayload('Soy Ana y quiero una tienda online'));

    assert.equal(stub.anthropicCalls.length, 2, 'debe haber una segunda vuelta tras la herramienta');

    // La segunda petición conserva el turno del asistente con el bloque
    // tool_use y añade el tool_result en un único mensaje de usuario.
    const [, second] = stub.anthropicCalls;
    const assistantTurn = second.messages[1];
    assert.equal(assistantTurn.role, 'assistant');
    assert.ok(assistantTurn.content.some((block) => block.type === 'tool_use'));

    const resultTurn = second.messages[2];
    assert.equal(resultTurn.role, 'user');
    assert.equal(resultTurn.content.length, 1);
    assert.equal(resultTurn.content[0].type, 'tool_result');
    assert.equal(resultTurn.content[0].tool_use_id, 'toolu_1');

    assert.equal(stub.sent.length, 1);
    assert.match(stub.sent[0], /Listo Ana/);
  } finally {
    stub.restore();
  }
});

test('escalar_a_humano silencia al bot en los siguientes mensajes', async () => {
  resetStore();
  const stub = stubFetch([
    claudeMessage(
      [
        {
          type: 'tool_use',
          id: 'toolu_esc',
          name: 'escalar_a_humano',
          input: { motivo: 'Pide precio', resumen: 'Quiere cotización de tienda online' },
        },
      ],
      'tool_use'
    ),
    claudeMessage([{ type: 'text', text: 'Javier te responde en un momento.' }]),
  ]);

  try {
    await handleWebhookPayload(inboundPayload('Necesito una cotización', 'wamid.A'));
    assert.equal(stub.sent.length, 1);

    // Un mensaje posterior no debe generar respuesta automática.
    await handleWebhookPayload(inboundPayload('¿Sigues ahí?', 'wamid.B'));
    assert.equal(stub.sent.length, 1, 'el bot debe permanecer en silencio');
  } finally {
    stub.restore();
  }
});

test('un mensaje escrito desde la app pausa al bot', async () => {
  resetStore();
  const stub = stubFetch([claudeMessage([{ type: 'text', text: 'no debería enviarse' }])]);

  try {
    await handleWebhookPayload({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '0',
          changes: [
            {
              field: 'message_echoes',
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '1234567890' },
                message_echoes: [
                  {
                    from: '573106255406',
                    to: '573001112233',
                    id: 'wamid.ECHO',
                    type: 'text',
                    text: { body: 'Hola Ana, soy Javier.' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    await handleWebhookPayload(inboundPayload('Gracias Javier', 'wamid.C'));

    assert.equal(stub.sent.length, 0, 'el bot no debe pisar la respuesta del humano');
    assert.equal(stub.anthropicCalls.length, 0);
  } finally {
    stub.restore();
  }
});

test('los mensajes no soportados se derivan sin llamar a Claude', async () => {
  resetStore();
  const stub = stubFetch([]);

  try {
    await handleWebhookPayload({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '0',
          changes: [
            {
              field: 'messages',
              value: {
                contacts: [{ profile: { name: 'Ana' }, wa_id: '573001112233' }],
                messages: [
                  {
                    from: '573001112233',
                    id: 'wamid.IMG',
                    type: 'image',
                    image: { id: 'media-1', mime_type: 'image/jpeg' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    assert.equal(stub.anthropicCalls.length, 0);
    assert.equal(stub.sent.length, 1);
    assert.match(stub.sent[0], /solo puedo leer texto/);
  } finally {
    stub.restore();
  }
});

test('una negativa del clasificador no rompe la conversación', async () => {
  resetStore();
  const stub = stubFetch([claudeMessage([], 'refusal')]);

  try {
    await handleWebhookPayload(inboundPayload('...', 'wamid.REF'));

    assert.equal(stub.sent.length, 1);
    assert.match(stub.sent[0], /Javier/);
  } finally {
    stub.restore();
  }
});
