/**
 * Logger mínimo en JSON. Vercel, Railway y Fly agrupan por línea, así que una
 * línea = un evento. Nunca registra el cuerpo del mensaje del cliente ni tokens.
 */

const REDACTED = '[redactado]';

function scrub(value) {
  if (value === null || typeof value !== 'object') return value;
  const out = Array.isArray(value) ? [] : {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = /token|secret|key|authorization/i.test(key) ? REDACTED : scrub(val);
  }
  return out;
}

function emit(level, message, meta) {
  const line = {
    level,
    message,
    time: new Date().toISOString(),
    ...(meta ? scrub(meta) : {}),
  };
  const stream = level === 'error' ? console.error : console.log;
  stream(JSON.stringify(line));
}

export const logger = {
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
};
