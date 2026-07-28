import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { isValidSignature } from '../src/whatsapp/verify.js';
import { splitMessage } from '../src/whatsapp/client.js';
import { extractIncomingText, isPaused } from '../src/handler.js';
import { getStore, resetStore } from '../src/db/store.js';

// ---------------------------------------------------------------------------
// Firma del webhook
// ---------------------------------------------------------------------------

const SECRET = 'app-secret-de-prueba';

function sign(body, secret = SECRET) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

test('acepta una firma válida', () => {
  const body = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
  assert.equal(isValidSignature(body, sign(body), SECRET), true);
});

test('rechaza una firma generada con otro secreto', () => {
  const body = Buffer.from('{"hola":true}');
  assert.equal(isValidSignature(body, sign(body, 'otro-secreto'), SECRET), false);
});

test('rechaza si el cuerpo cambió después de firmar', () => {
  const original = Buffer.from('{"a":1}');
  const signature = sign(original);
  assert.equal(isValidSignature(Buffer.from('{"a":2}'), signature, SECRET), false);
});

test('rechaza cabecera ausente o con prefijo incorrecto', () => {
  const body = Buffer.from('{}');
  assert.equal(isValidSignature(body, undefined, SECRET), false);
  assert.equal(isValidSignature(body, 'sha1=abc', SECRET), false);
});

test('rechaza una firma de longitud distinta sin lanzar', () => {
  const body = Buffer.from('{}');
  assert.equal(isValidSignature(body, 'sha256=abcd', SECRET), false);
});

// ---------------------------------------------------------------------------
// Troceado de mensajes largos
// ---------------------------------------------------------------------------

test('no trocea mensajes cortos', () => {
  assert.deepEqual(splitMessage('  hola  '), ['hola']);
});

test('trocea respetando el límite', () => {
  const text = Array.from({ length: 500 }, (_, i) => `frase numero ${i}`).join(' ');
  const chunks = splitMessage(text, 200);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 200, `trozo de ${chunk.length} caracteres`);
  }
  // Ningún contenido se pierde por el camino.
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), text.replace(/\s+/g, ' '));
});

test('prefiere cortar en saltos de párrafo', () => {
  const text = 'a'.repeat(90) + '\n\n' + 'b'.repeat(90);
  const [first] = splitMessage(text, 100);
  assert.equal(first, 'a'.repeat(90));
});

// ---------------------------------------------------------------------------
// Extracción de texto entrante
// ---------------------------------------------------------------------------

test('extrae texto de los tipos soportados', () => {
  assert.equal(extractIncomingText({ type: 'text', text: { body: ' hola ' } }), 'hola');
  assert.equal(extractIncomingText({ type: 'button', button: { text: 'Sí' } }), 'Sí');
  assert.equal(
    extractIncomingText({
      type: 'interactive',
      interactive: { button_reply: { title: 'Ver precios' } },
    }),
    'Ver precios'
  );
});

test('devuelve null para tipos no soportados', () => {
  for (const type of ['image', 'audio', 'document', 'location', 'sticker']) {
    assert.equal(extractIncomingText({ type }), null, `tipo ${type}`);
  }
});

test('devuelve null si el texto viene vacío', () => {
  assert.equal(extractIncomingText({ type: 'text', text: { body: '   ' } }), null);
});

// ---------------------------------------------------------------------------
// Pausa por intervención humana
// ---------------------------------------------------------------------------

test('la pausa solo aplica mientras no haya vencido', () => {
  assert.equal(isPaused(null), false);
  assert.equal(isPaused({ pausedUntil: null }), false);
  assert.equal(isPaused({ pausedUntil: new Date(Date.now() - 1000).toISOString() }), false);
  assert.equal(isPaused({ pausedUntil: new Date(Date.now() + 60_000).toISOString() }), true);
});

// ---------------------------------------------------------------------------
// Deduplicación
// ---------------------------------------------------------------------------

test('el mismo wa_message_id no se guarda dos veces', async () => {
  resetStore();
  const store = getStore();

  const first = await store.appendMessage('573001112233', {
    role: 'user',
    content: 'hola',
    waMessageId: 'wamid.ABC',
  });
  const second = await store.appendMessage('573001112233', {
    role: 'user',
    content: 'hola',
    waMessageId: 'wamid.ABC',
  });

  assert.equal(first, true, 'el primero debe guardarse');
  assert.equal(second, false, 'el reintento de Meta debe descartarse');

  const history = await store.getHistory('573001112233', 10);
  assert.equal(history.length, 1);
});

test('los mensajes sin id (los nuestros) siempre se guardan', async () => {
  resetStore();
  const store = getStore();

  await store.appendMessage('573001112233', { role: 'assistant', content: 'uno' });
  await store.appendMessage('573001112233', { role: 'assistant', content: 'dos' });

  const history = await store.getHistory('573001112233', 10);
  assert.equal(history.length, 2);
});

test('getHistory respeta el límite y el orden cronológico', async () => {
  resetStore();
  const store = getStore();

  for (let i = 0; i < 5; i += 1) {
    await store.appendMessage('573001112233', { role: 'user', content: `m${i}` });
  }

  const history = await store.getHistory('573001112233', 3);
  assert.deepEqual(
    history.map((m) => m.content),
    ['m2', 'm3', 'm4']
  );
});
