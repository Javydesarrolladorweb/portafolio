import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Capa de persistencia con dos implementaciones tras la misma interfaz:
 *
 *   - Supabase, cuando SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY están puestas.
 *   - Memoria, si no lo están.
 *
 * La de memoria existe para poder levantar el proyecto en local sin crear una
 * base de datos. En producción NO sirve: cada invocación serverless arranca en
 * frío, así que el historial se pierde y la deduplicación no funciona (el
 * cliente recibiría respuestas repetidas).
 */

let warnedAboutMemory = false;

function createMemoryStore() {
  const conversations = new Map(); // wa_id -> { waId, displayName, pausedUntil }
  const messages = new Map(); // wa_id -> [{ role, content, waMessageId, createdAt }]
  const seenMessageIds = new Set();
  const leads = [];

  return {
    kind: 'memory',

    async getConversation(waId) {
      return conversations.get(waId) ?? null;
    },

    async upsertConversation(waId, patch = {}) {
      const existing = conversations.get(waId) ?? { waId, displayName: null, pausedUntil: null };
      const updated = { ...existing, ...patch, waId };
      conversations.set(waId, updated);
      return updated;
    },

    async getHistory(waId, limit) {
      return (messages.get(waId) ?? []).slice(-limit).map(({ role, content }) => ({ role, content }));
    },

    async appendMessage(waId, { role, content, waMessageId = null }) {
      if (waMessageId) {
        if (seenMessageIds.has(waMessageId)) return false;
        seenMessageIds.add(waMessageId);
      }
      const list = messages.get(waId) ?? [];
      list.push({ role, content, waMessageId, createdAt: new Date().toISOString() });
      messages.set(waId, list);
      return true;
    },

    async saveLead(waId, lead) {
      leads.push({ waId, ...lead, createdAt: new Date().toISOString() });
    },
  };
}

function createSupabaseStore() {
  const client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false },
  });

  return {
    kind: 'supabase',

    async getConversation(waId) {
      const { data, error } = await client
        .from('conversations')
        .select('wa_id, display_name, paused_until')
        .eq('wa_id', waId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        waId: data.wa_id,
        displayName: data.display_name,
        pausedUntil: data.paused_until,
      };
    },

    async upsertConversation(waId, patch = {}) {
      const row = { wa_id: waId, last_message_at: new Date().toISOString() };
      if ('displayName' in patch) row.display_name = patch.displayName;
      if ('pausedUntil' in patch) row.paused_until = patch.pausedUntil;

      const { data, error } = await client
        .from('conversations')
        .upsert(row, { onConflict: 'wa_id' })
        .select('wa_id, display_name, paused_until')
        .single();

      if (error) throw error;

      return {
        waId: data.wa_id,
        displayName: data.display_name,
        pausedUntil: data.paused_until,
      };
    },

    async getHistory(waId, limit) {
      // Ordenamos por `id` y no por `created_at`: dos mensajes de la misma
      // ráfaga pueden compartir timestamp al milisegundo y el orden quedaría
      // indefinido, mezclando los turnos del historial.
      const { data, error } = await client
        .from('messages')
        .select('id, role, content')
        .eq('wa_id', waId)
        .order('id', { ascending: false })
        .limit(limit);

      if (error) throw error;
      // Vienen del más reciente al más antiguo; Claude los espera al revés.
      return data.reverse().map(({ role, content }) => ({ role, content }));
    },

    async appendMessage(waId, { role, content, waMessageId = null }) {
      const { error } = await client
        .from('messages')
        .insert({ wa_id: waId, role, content, wa_message_id: waMessageId });

      if (error) {
        // 23505 = unique_violation sobre wa_message_id. Significa que ya
        // procesamos este mensaje: es un reintento de Meta, no un fallo.
        if (error.code === '23505') return false;
        throw error;
      }
      return true;
    },

    async saveLead(waId, lead) {
      const { error } = await client.from('leads').insert({ wa_id: waId, ...lead });
      if (error) throw error;
    },
  };
}

let instance = null;

export function getStore() {
  if (instance) return instance;

  if (config.supabase.enabled) {
    instance = createSupabaseStore();
  } else {
    if (!warnedAboutMemory) {
      logger.warn(
        'Supabase no configurado: usando almacenamiento en memoria. ' +
          'No apto para producción — se pierde el historial y falla la deduplicación.'
      );
      warnedAboutMemory = true;
    }
    instance = createMemoryStore();
  }

  return instance;
}

/** Solo para tests. */
export function resetStore() {
  instance = null;
}
