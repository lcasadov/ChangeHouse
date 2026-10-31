import { describe, expect, it } from 'vitest';

import { MAX_SUSPENSION_REASON, validateSuspensionInput } from './suspension.js';

describe('validateSuspensionInput', () => {
  it('acepta suspender con motivo y lo recorta', () => {
    expect(validateSuspensionInput({ suspended: true, reason: '  Fraude reiterado  ' })).toEqual({
      success: true,
      data: { suspended: true, reason: 'Fraude reiterado' },
    });
  });

  it('acepta reactivar con motivo', () => {
    expect(validateSuspensionInput({ suspended: false, reason: 'Recurso estimado' })).toEqual({
      success: true,
      data: { suspended: false, reason: 'Recurso estimado' },
    });
  });

  it('acepta un motivo de exactamente 1000 caracteres', () => {
    const reason = 'a'.repeat(MAX_SUSPENSION_REASON);

    expect(validateSuspensionInput({ suspended: true, reason }).success).toBe(true);
  });

  it.each([
    [{ suspended: true }, 'reason', 'invalid'],
    [{ suspended: true, reason: '' }, 'reason', 'required'],
    [{ suspended: true, reason: '   ' }, 'reason', 'required'],
    [{ suspended: true, reason: 'a'.repeat(MAX_SUSPENSION_REASON + 1) }, 'reason', 'too_long'],
    [{ reason: 'Fraude' }, 'suspended', 'invalid'],
    [{ suspended: 'yes', reason: 'Fraude' }, 'suspended', 'invalid'],
    [{ suspended: true, reason: 'Fraude', until: '2027-01-01' }, 'until', 'invalid'],
    [null, 'body', 'invalid'],
  ])('rechaza %j señalando %s', (input, field, code) => {
    expect(validateSuspensionInput(input)).toEqual({ success: false, errors: [{ field, code }] });
  });
});
