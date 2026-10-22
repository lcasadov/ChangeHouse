import { describe, expect, it } from 'vitest';

import { MAX_MODERATION_REASON, validateModerationInput } from './moderation.js';

describe('validateModerationInput', () => {
  it('acepta aprobar sin motivo', () => {
    expect(validateModerationInput({ decision: 'approve' })).toEqual({
      success: true,
      data: { decision: 'approve' },
    });
  });

  it('acepta rechazar con motivo y lo recorta', () => {
    expect(validateModerationInput({ decision: 'reject', reason: '  Fotos falsas  ' })).toEqual({
      success: true,
      data: { decision: 'reject', reason: 'Fotos falsas' },
    });
  });

  it('acepta un motivo de exactamente 1000 caracteres', () => {
    const reason = 'a'.repeat(MAX_MODERATION_REASON);

    expect(validateModerationInput({ decision: 'reject', reason }).success).toBe(true);
  });

  it.each([
    [{ decision: 'reject' }, 'reason'],
    [{ decision: 'reject', reason: '' }, 'reason'],
    [{ decision: 'reject', reason: '   ' }, 'reason'],
    [{ decision: 'reject', reason: 'a'.repeat(MAX_MODERATION_REASON + 1) }, 'reason'],
    [{ decision: 'approve', reason: 'a'.repeat(MAX_MODERATION_REASON + 1) }, 'reason'],
    [{ decision: 'publish' }, 'decision'],
    [{}, 'decision'],
    [{ decision: 'approve', status: 'published' }, 'status'],
    [null, 'body'],
  ])('rechaza %j señalando %s', (input, field) => {
    const result = validateModerationInput(input);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.errors.map((error) => error.field)).toEqual([field]);
  });

  it('aprobar con un motivo lo ignora', () => {
    expect(validateModerationInput({ decision: 'approve', reason: 'ok' })).toEqual({
      success: true,
      data: { decision: 'approve' },
    });
  });
});
