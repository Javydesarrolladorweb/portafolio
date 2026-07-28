/**
 * Configuración central. Lee de process.env y falla temprano si falta algo
 * imprescindible, en vez de fallar a mitad de una conversación.
 */

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa .env.example y ejecuta "npm run check".`
    );
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function intOption(name, fallback) {
  const parsed = Number.parseInt(optional(name, ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  whatsapp: {
    get token() {
      return required('WHATSAPP_TOKEN');
    },
    get phoneNumberId() {
      return required('WHATSAPP_PHONE_NUMBER_ID');
    },
    get verifyToken() {
      return required('WHATSAPP_VERIFY_TOKEN');
    },
    get appSecret() {
      return required('WHATSAPP_APP_SECRET');
    },
    apiVersion: optional('WHATSAPP_API_VERSION', 'v23.0'),
  },

  anthropic: {
    get apiKey() {
      return required('ANTHROPIC_API_KEY');
    },
    model: optional('ANTHROPIC_MODEL', 'claude-opus-5'),
    effort: optional('ANTHROPIC_EFFORT', 'low'),
  },

  supabase: {
    url: optional('SUPABASE_URL', ''),
    serviceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY', ''),
    get enabled() {
      return Boolean(this.url && this.serviceRoleKey);
    },
  },

  agent: {
    humanTakeoverMinutes: intOption('HUMAN_TAKEOVER_MINUTES', 60),
    historyLimit: intOption('HISTORY_LIMIT', 20),
    timezone: optional('TIMEZONE', 'America/Bogota'),
    // Tope de vueltas del bucle de herramientas. Evita que un fallo de una
    // herramienta convierta una conversación en un bucle infinito de tokens.
    maxToolIterations: 6,
  },
};
