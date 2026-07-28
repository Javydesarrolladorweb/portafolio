-- Esquema para Supabase (PostgreSQL).
-- Ejecútalo en el SQL Editor de tu proyecto antes del primer despliegue.

-- ---------------------------------------------------------------------------
-- Conversaciones: una fila por número de WhatsApp.
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  wa_id           text primary key,           -- número en formato E.164 sin "+"
  display_name    text,                       -- nombre del perfil de WhatsApp
  paused_until    timestamptz,                -- si es futuro, el bot no responde
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Mensajes: historial completo, en ambos sentidos.
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id            bigserial primary key,
  wa_id         text not null references conversations (wa_id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  -- ID del mensaje en WhatsApp. UNIQUE es lo que hace la deduplicación:
  -- Meta reintenta el webhook si no respondemos 200 a tiempo, y sin esto
  -- el agente contestaría dos veces al mismo mensaje.
  wa_message_id text unique,
  created_at    timestamptz not null default now()
);

create index if not exists messages_wa_id_created_at_idx
  on messages (wa_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Leads: lo que el agente califica durante la conversación.
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id          bigserial primary key,
  wa_id       text not null references conversations (wa_id) on delete cascade,
  nombre      text,
  servicio    text,
  presupuesto text,
  urgencia    text,
  notas       text,
  created_at  timestamptz not null default now()
);

create index if not exists leads_created_at_idx on leads (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: el backend usa la service role key, que salta RLS. Activamos RLS sin
-- políticas para que la anon key (si algún día se filtra) no pueda leer nada.
-- ---------------------------------------------------------------------------
alter table conversations enable row level security;
alter table messages      enable row level security;
alter table leads         enable row level security;
