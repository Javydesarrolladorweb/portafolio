#!/usr/bin/env node
/**
 * Comprueba que las credenciales están puestas y que funcionan, antes de
 * desplegar. Ejecuta:
 *
 *   node --env-file=.env scripts/check-setup.js
 */

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? '✓' : '✗';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
}

function checkPresence() {
  const required = [
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_VERIFY_TOKEN',
    'WHATSAPP_APP_SECRET',
    'ANTHROPIC_API_KEY',
  ];

  for (const name of required) {
    record(`Variable ${name}`, Boolean(process.env[name]), process.env[name] ? '' : 'sin definir');
  }

  const supabaseConfigured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  record(
    'Supabase',
    true,
    supabaseConfigured
      ? 'configurado'
      : 'sin configurar — se usará memoria (solo válido en desarrollo)'
  );
}

async function checkWhatsApp() {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return record('Conexión con la Cloud API', false, 'faltan credenciales');
  }

  const version = process.env.WHATSAPP_API_VERSION ?? 'v23.0';
  const url = `https://graph.facebook.com/${version}/${WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    const body = await response.json();

    if (!response.ok) {
      return record('Conexión con la Cloud API', false, body.error?.message ?? `HTTP ${response.status}`);
    }

    record(
      'Conexión con la Cloud API',
      true,
      `${body.verified_name ?? 'sin nombre'} (${body.display_phone_number}) — calidad: ${body.quality_rating ?? 'n/d'}`
    );
  } catch (error) {
    record('Conexión con la Cloud API', false, error.message);
  }
}

async function checkAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return record('Conexión con Claude', false, 'falta ANTHROPIC_API_KEY');
  }

  const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model,
      max_tokens: 32,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Responde únicamente con la palabra: listo' }],
    });

    record('Conexión con Claude', true, `modelo ${response.model}`);
  } catch (error) {
    record('Conexión con Claude', false, error.message);
  }
}

async function checkSupabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { error } = await client.from('conversations').select('wa_id').limit(1);
    if (error) throw error;

    record('Tablas de Supabase', true, 'accesibles');
  } catch (error) {
    record('Tablas de Supabase', false, `${error.message} — ¿ejecutaste src/db/schema.sql?`);
  }
}

console.log('Comprobando configuración...\n');

checkPresence();
await checkWhatsApp();
await checkAnthropic();
await checkSupabase();

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas.`);

if (failed.length > 0) {
  console.log('\nRevisa lo marcado con ✗ antes de desplegar.');
  process.exit(1);
}
