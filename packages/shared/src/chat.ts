import { z } from 'zod';

import { validateWith } from './validation.js';

/** Longitud máxima de un mensaje de texto del chat (`sendMatchMessage` en `docs/api/openapi.yaml`). */
export const CHAT_MESSAGE_MAX_LENGTH = 2000;

const textSchema = z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH);

/**
 * Cuerpo de `sendMatchMessage`: exactamente uno de `text` o `imageUploadId`. Un texto vacío o de más
 * de 2.000 caracteres se señala en `text`; tener los dos o ninguno, en el cuerpo.
 */
export const sendMessageInputSchema = z
  .strictObject({
    text: textSchema.optional(),
    imageUploadId: z.uuid().optional(),
  })
  .check((context) => {
    const { text, imageUploadId } = context.value;
    const given = [text, imageUploadId].filter((value) => value !== undefined).length;
    if (given === 0) {
      context.issues.push({
        code: 'too_small',
        origin: 'object',
        minimum: 1,
        input: context.value,
        path: [],
      });
    } else if (given > 1) {
      context.issues.push({ code: 'custom', input: context.value, path: [] });
    }
  })
  .transform((input) =>
    input.text === undefined
      ? ({ kind: 'image', imageUploadId: input.imageUploadId ?? '' } as const)
      : ({ kind: 'text', text: input.text } as const),
  );
export type SendMessageInput = z.output<typeof sendMessageInputSchema>;

export const validateSendMessageInput = (input: unknown) =>
  validateWith(sendMessageInputSchema, input);
