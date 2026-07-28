import { config } from '../config.js';
import { getStore } from '../db/store.js';
import { logger } from '../logger.js';

/**
 * Definiciones de herramientas + sus implementaciones.
 *
 * El orden del array importa: forma parte del prefijo cacheado de la petición,
 * así que no lo reordenes dinámicamente ni añadas herramientas condicionales.
 */

export const TOOLS = [
  {
    name: 'guardar_lead',
    description:
      'Guarda o actualiza los datos del cliente potencial. Llámala en cuanto conozcas el nombre y el servicio que le interesa, aunque falten los demás campos; puedes volver a llamarla después para completar lo que descubras.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: {
          type: 'string',
          description: 'Nombre de la persona, y el del negocio si lo mencionó.',
        },
        servicio: {
          type: 'string',
          description:
            'Servicio que le interesa: diseño web, tienda online, SEO, marketing digital, soporte u optimización de velocidad.',
        },
        presupuesto: {
          type: 'string',
          description: 'Presupuesto o rango que haya mencionado. Vacío si no lo dijo.',
        },
        urgencia: {
          type: 'string',
          description: 'Para cuándo lo necesita, con sus propias palabras.',
        },
        notas: {
          type: 'string',
          description:
            'Contexto útil para Javier: si ya tiene web, qué problema tiene, qué le preocupa.',
        },
      },
      required: ['nombre', 'servicio'],
    },
  },
  {
    name: 'agendar_reunion',
    description:
      'Registra la preferencia de horario del cliente para una llamada o reunión. No cierra la cita: Javier confirma la hora exacta.',
    input_schema: {
      type: 'object',
      properties: {
        franja: {
          type: 'string',
          description:
            'Cuándo prefiere, tal como lo dijo. Por ejemplo "mañana en la tarde" o "el jueves a las 10".',
        },
        medio: {
          type: 'string',
          enum: ['llamada', 'videollamada', 'presencial'],
          description: 'Cómo prefiere la reunión.',
        },
      },
      required: ['franja'],
    },
  },
  {
    name: 'escalar_a_humano',
    description:
      'Avisa a Javier de que debe entrar en la conversación. Úsala cuando pidan precio, quieran hablar por llamada, haya una urgencia técnica, la persona esté molesta, pida hablar con alguien, o cuando no puedas responder con certeza.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          description: 'Por qué hace falta Javier, en una frase.',
        },
        resumen: {
          type: 'string',
          description:
            'Resumen de la conversación para que Javier se ponga al día sin leerla entera.',
        },
      },
      required: ['motivo', 'resumen'],
    },
  },
];

/**
 * Ejecuta una herramienta. Nunca lanza: si algo falla, devuelve un texto de
 * error para que Claude lo vea y siga la conversación en vez de cortarse.
 *
 * @returns {Promise<{ content: string, isError: boolean, escalated: boolean }>}
 */
export async function runTool(name, input, context) {
  const store = getStore();
  const { waId } = context;

  try {
    switch (name) {
      case 'guardar_lead': {
        await store.saveLead(waId, {
          nombre: input.nombre ?? null,
          servicio: input.servicio ?? null,
          presupuesto: input.presupuesto || null,
          urgencia: input.urgencia || null,
          notas: input.notas || null,
        });
        logger.info('Lead guardado', { waId, servicio: input.servicio });
        return ok('Lead guardado.');
      }

      case 'agendar_reunion': {
        await store.saveLead(waId, {
          nombre: context.displayName ?? null,
          servicio: 'Reunión solicitada',
          urgencia: input.franja ?? null,
          notas: `Medio preferido: ${input.medio ?? 'sin especificar'}`,
        });
        logger.info('Reunión solicitada', { waId, franja: input.franja });
        return ok('Preferencia de horario registrada. Javier confirmará la hora exacta.');
      }

      case 'escalar_a_humano': {
        // Silenciamos el bot para que no siga contestando por encima de Javier
        // cuando él entre a la conversación desde su móvil.
        const pausedUntil = new Date(
          Date.now() + config.agent.humanTakeoverMinutes * 60_000
        ).toISOString();

        await store.upsertConversation(waId, { pausedUntil });

        logger.info('Escalado a humano', { waId, motivo: input.motivo });

        return {
          content:
            'Javier ha sido notificado y entrará en la conversación. Cierra tu respuesta avisando de ello, sin prometer un plazo concreto.',
          isError: false,
          escalated: true,
        };
      }

      default:
        return fail(`Herramienta desconocida: ${name}`);
    }
  } catch (error) {
    logger.error('Fallo al ejecutar herramienta', { tool: name, waId, reason: error.message });
    return fail(
      'No se pudo completar la acción. Continúa la conversación con normalidad y no menciones este fallo técnico.'
    );
  }
}

function ok(content) {
  return { content, isError: false, escalated: false };
}

function fail(content) {
  return { content, isError: true, escalated: false };
}
