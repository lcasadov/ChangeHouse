import { REASON_MAX_LENGTH, validateReason } from './reject-reason';

describe('validateReason', () => {
  it('acepta un motivo y lo devuelve sin espacios en los extremos', () => {
    expect(validateReason('  Contenido inadecuado \n')).toEqual({
      ok: true,
      reason: 'Contenido inadecuado',
    });
  });

  it.each(['', '   ', '\n\t '])('un motivo vacío o en blanco (%j) es required', (text) => {
    expect(validateReason(text)).toEqual({ ok: false, error: 'required' });
  });

  it('acepta justo 1000 caracteres y rechaza 1001 (tooLong)', () => {
    expect(validateReason('a'.repeat(REASON_MAX_LENGTH))).toMatchObject({ ok: true });
    expect(validateReason('a'.repeat(REASON_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: 'tooLong',
    });
  });

  it('el límite se cuenta tras recortar los espacios', () => {
    expect(validateReason(`  ${'a'.repeat(REASON_MAX_LENGTH)}  `)).toMatchObject({ ok: true });
  });

  it('un solo carácter es válido', () => {
    expect(validateReason('x')).toEqual({ ok: true, reason: 'x' });
  });
});
