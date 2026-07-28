# WhatsApp Agent

Chatbot de WhatsApp con IA para **Javier Alberto Suárez** — desarrollo web, SEO y marketing digital.

El bot atiende a los clientes que escriben al WhatsApp del portafolio, responde dudas sobre los servicios, califica el lead y le pasa la conversación a Javier cuando hay intención de compra. Todo queda **sincronizado con la app de WhatsApp Business**: Javier ve las conversaciones en su móvil en tiempo real y puede intervenir cuando quiera — el bot lo detecta y se calla.

---

## Cómo funciona

```
Cliente escribe a wa.me/573106255406
            │
            ▼
   WhatsApp Cloud API (Meta)
            │  webhook POST
            ▼
   /api/webhook   ← valida firma HMAC, deduplica, responde 200
            │
            ▼
   Claude (claude-opus-5)  ← prompt de sistema + historial + 3 herramientas
            │
            ├── guardar_lead ─────┐
            ├── agendar_reunion ──┼──► Supabase
            └── escalar_a_humano ─┘        │
            │                              │
            ▼                              ▼
   Respuesta por Cloud API        Bot en pausa 60 min
            │
            ▼
   Coexistence ──► el móvil de Javier ve todo en vivo
```

### Decisiones que conviene conocer

| Decisión | Por qué |
|---|---|
| Se responde `200` **antes** de llamar a Claude | Meta reintenta el webhook si tardas más de unos segundos. Una respuesta del modelo puede pasar de 20 s. |
| `wa_message_id` con índice `UNIQUE` | Es lo único que evita responder dos veces al mismo mensaje cuando Meta reintenta. |
| Firma `X-Hub-Signature-256` obligatoria | Sin ella, cualquiera con la URL puede inyectar mensajes falsos y gastar tu saldo de tokens. |
| `bodyParser: false` en la función | La firma se calcula sobre los bytes originales; reparsear el JSON la invalida siempre. |
| `effort: "low"` con thinking activo | En un chat la latencia pesa más que la profundidad. Desactivar el thinking del todo hace que el modelo a veces escriba la llamada a herramienta como texto plano en vez de ejecutarla. |
| `cache_control` en el prompt de sistema | El prompt y las herramientas son idénticos en cada mensaje: se cachean y ese prefijo cuesta ~10%. Por eso el prompt **no** interpola fecha ni nombre. |

---

## Requisitos previos

1. **Cuenta de Meta Business** verificada.
2. **App de WhatsApp Business** en [Meta for Developers](https://developers.facebook.com).
3. **Clave de API de Anthropic** — [console.anthropic.com](https://console.anthropic.com).
4. **Proyecto de Supabase** (gratis) — [supabase.com](https://supabase.com).
5. **Cuenta de Vercel** (gratis) o cualquier host que ejecute Node 20+.

---

## Puesta en marcha

### 1. Meta: app y número

1. En [Meta for Developers](https://developers.facebook.com) → **Crear app** → tipo **Negocio**.
2. Añade el producto **WhatsApp**.
3. En **WhatsApp → Configuración de la API**, apunta el **Identificador del número de teléfono** (`WHATSAPP_PHONE_NUMBER_ID`).
4. En **Configuración de la app → Básica**, copia la **Clave secreta de la aplicación** (`WHATSAPP_APP_SECRET`).

### 2. Token permanente

El token que Meta muestra en pantalla caduca en 24 horas. Para producción necesitas uno de usuario del sistema:

1. [Meta Business Suite](https://business.facebook.com) → **Configuración del negocio → Usuarios → Usuarios del sistema**.
2. Crea uno con rol **Administrador**.
3. **Agregar activos** → tu app de WhatsApp → permiso de control total.
4. **Generar token** → selecciona la app → marca `whatsapp_business_messaging` y `whatsapp_business_management` → caducidad **Nunca**.
5. Ese token es `WHATSAPP_TOKEN`.

### 3. Coexistence (la sincronización)

Esto es lo que permite que el número siga funcionando en la app de WhatsApp Business **y** en la API a la vez, con sincronización bidireccional.

1. Instala **WhatsApp Business** (la app, no WhatsApp normal) en el móvil con el número +57 310 625 5406.
2. En Meta for Developers → **WhatsApp → Configuración de la API** → **Agregar número de teléfono** → elige **Conectar un número existente de la app de WhatsApp Business**.
3. Se abre el flujo de *Embedded Signup*. Escanea el código QR desde la app: **Configuración → Herramientas para empresas → Coexistencia con la API**.
4. Confirma la sincronización del historial.

A partir de ahí:

- Los mensajes que llegan disparan el webhook → responde el bot.
- Los mensajes que **tú** escribes desde la app llegan al webhook como `message_echoes` → el bot se calla durante `HUMAN_TAKEOVER_MINUTES`.
- Todo aparece en el móvil como una conversación normal.

> Si el flujo no ofrece la opción de conectar un número existente, revisa que la app de WhatsApp Business esté actualizada y que el número no esté ya registrado en otra cuenta de WhatsApp Business API.

### 4. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → pega el contenido de [`src/db/schema.sql`](src/db/schema.sql) → **Run**.
3. **Project Settings → API**: copia la **Project URL** (`SUPABASE_URL`) y la clave **`service_role`** (`SUPABASE_SERVICE_ROLE_KEY`).

> La `service_role` salta RLS. Es una clave de servidor: nunca la pongas en el frontend ni la subas al repositorio.

### 5. Variables de entorno

```bash
cp .env.example .env
# rellena .env con lo que has ido apuntando
npm install
npm run check   # verifica que las credenciales funcionan de verdad
```

`npm run check` no se limita a mirar si las variables existen: llama a la Graph API, a Claude y a Supabase, y te dice qué está roto.

### 6. Desplegar

```bash
npm i -g vercel
vercel

# Sube cada variable (repite por cada una del .env):
vercel env add WHATSAPP_TOKEN production
vercel env add WHATSAPP_PHONE_NUMBER_ID production
vercel env add WHATSAPP_VERIFY_TOKEN production
vercel env add WHATSAPP_APP_SECRET production
vercel env add ANTHROPIC_API_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

vercel --prod
```

### 7. Conectar el webhook

En Meta for Developers → **WhatsApp → Configuración** → **Webhooks → Editar**:

- **URL de devolución de llamada**: `https://TU-PROYECTO.vercel.app/api/webhook`
- **Token de verificación**: el mismo valor que pusiste en `WHATSAPP_VERIFY_TOKEN`

Pulsa **Verificar y guardar**. Después, en **Campos del webhook**, suscríbete a:

- `messages` — mensajes entrantes *(imprescindible)*
- `message_echoes` — tus mensajes desde la app *(imprescindible para el handoff)*

Escríbele al número desde otro teléfono. Debería contestarte en unos segundos.

---

## Desarrollo local

```bash
node --env-file=.env scripts/dev-server.js
ngrok http 3000
```

Pon la URL de ngrok + `/api/webhook` en el panel de webhooks de Meta. El servidor local monta exactamente el mismo handler que Vercel.

```bash
npm test    # 22 pruebas
```

Las pruebas de integración interceptan `fetch`, que es por donde salen tanto el
cliente de WhatsApp como el SDK de Anthropic. Un solo stub cubre las dos
integraciones y recorre el camino real: payload → deduplicación → agente →
bucle de herramientas → envío. No hacen ninguna llamada de red.

---

## Personalización

| Qué quieres cambiar | Dónde |
|---|---|
| Servicios, precios, tono, límites | [`src/agent/prompt.js`](src/agent/prompt.js) |
| Herramientas del agente | [`src/agent/tools.js`](src/agent/tools.js) |
| Duración de la pausa tras intervenir | `HUMAN_TAKEOVER_MINUTES` |
| Cuánto historial ve el modelo | `HISTORY_LIMIT` |
| Modelo o nivel de esfuerzo | `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT` |

Al editar `prompt.js`, ten en cuenta que el prompt se cachea: los cambios invalidan la caché una vez y a partir de ahí vuelve a funcionar sola.

---

## Costes

**WhatsApp** — desde noviembre de 2024 las *conversaciones de servicio* (las que inicia el cliente) son gratuitas e ilimitadas, y toda respuesta dentro de las 24 h siguientes también. Como aquí el cliente siempre escribe primero, el caso normal es **0 €**.

Solo se paga si eres tú quien inicia el contacto fuera de la ventana de 24 h, y hay que hacerlo con una plantilla aprobada (`sendTemplate`). Las tarifas son por mensaje y varían por país y categoría (marketing, utilidad, autenticación).

**Claude** — se paga por token. Con `effort: "low"` y el prompt de sistema cacheado, una conversación típica cuesta céntimos.

**Vercel y Supabase** — el plan gratuito de ambos cubre de sobra este volumen.

---

## Seguridad

- Toda petición se valida contra `X-Hub-Signature-256` antes de tocar nada.
- El logger redacta cualquier campo que contenga `token`, `secret`, `key` o `authorization`.
- Nunca se registra el contenido de los mensajes del cliente.
- El prompt instruye al agente a rechazar contraseñas y datos de tarjeta si el cliente los envía.
- RLS activo en las tres tablas, sin políticas: solo la `service_role` del backend puede leerlas.

---

## Límites conocidos

- **Solo texto.** Audios, imágenes y documentos se reconocen y se derivan con un mensaje, pero no se procesan.
- **Sin memoria entre números.** Cada `wa_id` es una conversación aislada.
- **`agendar_reunion` no escribe en Google Calendar.** Registra la franja preferida; la cita la confirma Javier. Conectarlo a Calendar es un añadido natural.
- **Sin panel de administración.** Los leads se consultan desde el Table Editor de Supabase.
- **El almacenamiento en memoria no vale para producción.** Sin Supabase configurado, cada invocación serverless arranca en frío: se pierde el historial y la deduplicación deja de funcionar (el cliente recibiría respuestas repetidas).

---

## Estructura

```
whatsapp-agent/
├── api/
│   └── webhook.js          Función serverless: verificación GET + eventos POST
├── src/
│   ├── config.js           Configuración con validación temprana
│   ├── logger.js           Logs JSON con redacción de secretos
│   ├── handler.js          Enrutado del payload: mensajes, echoes, estados
│   ├── agent/
│   │   ├── index.js        Bucle de herramientas contra Claude
│   │   ├── prompt.js       Prompt de sistema (conocimiento de negocio)
│   │   └── tools.js        Definiciones + implementación de herramientas
│   ├── whatsapp/
│   │   ├── client.js       Envío de mensajes, plantillas, marcar leído
│   │   └── verify.js       Validación HMAC + lectura del cuerpo crudo
│   └── db/
│       ├── store.js        Supabase, con respaldo en memoria
│       └── schema.sql      Esquema de PostgreSQL
├── scripts/
│   ├── check-setup.js      Comprueba credenciales contra las APIs reales
│   └── dev-server.js       Servidor local con el mismo handler
└── test/
    ├── unit.test.js        Lógica pura: firma, troceado, deduplicación, pausa
    └── integration.test.js Flujo completo del webhook con `fetch` interceptado
```
