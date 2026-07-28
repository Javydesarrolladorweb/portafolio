import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { TOOLS, runTool } from './tools.js';

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

/**
 * Genera la respuesta del agente para un mensaje entrante.
 *
 * Usa un bucle manual de herramientas en lugar del tool runner del SDK: son
 * treinta líneas, no depende de una API en beta y deja a la vista dónde se
 * corta el bucle. Para tres herramientas no compensa la abstracción.
 *
 * @param {object} params
 * @param {Array<{role: string, content: string}>} params.history Turnos previos, del más antiguo al más reciente.
 * @param {string} params.userMessage Texto del mensaje que acaba de llegar.
 * @param {object} params.context Datos de la conversación ({ waId, displayName }).
 * @returns {Promise<{ text: string, escalated: boolean }>}
 */
export async function generateReply({ history, userMessage, context }) {
  const anthropic = getClient();

  const messages = [
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: userMessage },
  ];

  let escalated = false;

  for (let iteration = 0; iteration < config.agent.maxToolIterations; iteration += 1) {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 8000,
      // El prompt de sistema y las herramientas son idénticos en cada petición,
      // así que se cachean y solo se paga el ~10% por ese prefijo.
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      // "low" mantiene la latencia baja, que en un chat importa más que la
      // profundidad de razonamiento. El thinking sigue activo (es el valor por
      // defecto en Opus 5): desactivarlo provoca que a veces escriba la llamada
      // a herramienta como texto plano en vez de ejecutarla.
      output_config: { effort: config.anthropic.effort },
      tools: TOOLS,
      messages,
    });

    // Las clasificaciones de seguridad pueden rechazar una petición devolviendo
    // un 200 con stop_reason "refusal" y content vacío. Hay que comprobarlo
    // antes de leer content, o el acceso revienta.
    if (response.stop_reason === 'refusal') {
      logger.warn('Petición rechazada por el clasificador', {
        waId: context.waId,
        category: response.stop_details?.category ?? null,
      });
      return {
        text: 'Perdona, no puedo ayudarte con eso por este canal. Le paso tu mensaje a Javier para que lo revise él.',
        escalated: true,
      };
    }

    const toolUses = response.content.filter((block) => block.type === 'tool_use');

    if (toolUses.length === 0) {
      return { text: extractText(response), escalated };
    }

    // El turno del asistente debe conservar los bloques tool_use tal cual, o la
    // API rechaza el siguiente mensaje por falta de correspondencia de IDs.
    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const toolUse of toolUses) {
      const result = await runTool(toolUse.name, toolUse.input, context);
      if (result.escalated) escalated = true;

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.content,
        ...(result.isError ? { is_error: true } : {}),
      });
    }

    // Todos los resultados van en UN solo mensaje de usuario. Repartirlos en
    // varios hace que Claude deje de pedir herramientas en paralelo.
    messages.push({ role: 'user', content: toolResults });
  }

  logger.warn('Se agotaron las iteraciones de herramientas', { waId: context.waId });
  return {
    text: 'Déjame consultarlo con Javier y te confirmo. ¿Hay algo más en lo que te pueda ayudar mientras tanto?',
    escalated: true,
  };
}

function extractText(response) {
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (text) return text;

  // Puede pasar si se agota max_tokens antes de emitir texto.
  logger.warn('Respuesta sin texto', { stopReason: response.stop_reason });
  return 'Perdona, se me cruzaron los cables. ¿Me lo repites?';
}
