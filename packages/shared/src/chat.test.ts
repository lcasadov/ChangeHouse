import { describe, expect, it } from 'vitest';

import { CHAT_MESSAGE_MAX_LENGTH, validateSendMessageInput } from './chat.js';

const UPLOAD_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';

describe('validateSendMessageInput', () => {
  it('el límite del texto es de 2.000 caracteres (contrato de sendMatchMessage)', () => {
    expect(CHAT_MESSAGE_MAX_LENGTH).toBe(2000);
  });

  it('acepta un texto y lo entrega sin los espacios de los extremos', () => {
    expect(validateSendMessageInput({ text: '  ¿Te viene bien el sábado?  ' })).toEqual({
      success: true,
      data: { kind: 'text', text: '¿Te viene bien el sábado?' },
    });
  });

  it('acepta un texto de exactamente 2.000 caracteres', () => {
    const text = 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH);

    expect(validateSendMessageInput({ text })).toEqual({
      success: true,
      data: { kind: 'text', text },
    });
  });

  it('acepta el identificador de una imagen subida', () => {
    expect(validateSendMessageInput({ imageUploadId: UPLOAD_ID })).toEqual({
      success: true,
      data: { kind: 'image', imageUploadId: UPLOAD_ID },
    });
  });

  it.each([
    [
      'Scenario: Mensaje demasiado largo - 2.001 caracteres',
      { text: 'a'.repeat(2001) },
      'text',
      'too_long',
    ],
    ['un texto vacío', { text: '' }, 'text', 'required'],
    ['un texto solo de espacios', { text: '   \n ' }, 'text', 'required'],
    ['un texto que no es una cadena', { text: 5 }, 'text', 'invalid'],
    ['un identificador que no es UUID', { imageUploadId: 'imagen' }, 'imageUploadId', 'invalid'],
    ['un campo desconocido', { text: 'hola', remitente: 'x' }, 'remitente', 'invalid'],
    ['un cuerpo vacío', {}, 'body', 'required'],
    ['texto e imagen a la vez', { text: 'hola', imageUploadId: UPLOAD_ID }, 'body', 'invalid'],
    ['un cuerpo que no es un objeto', null, 'body', 'invalid'],
  ])('rechaza %s', (_name, input, field, code) => {
    const result = validateSendMessageInput(input);

    expect(result).toEqual({ success: false, errors: [{ field, code }] });
  });
});
