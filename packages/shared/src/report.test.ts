import { describe, expect, it } from 'vitest';

import {
  MAX_REPORT_REASON,
  MAX_REPORT_RESOLUTION,
  validateBlockUserInput,
  validateReportInput,
  validateReportResolutionInput,
} from './report.js';

const UUID = '0199c1a2-0000-7000-8000-000000000001';

describe('validateReportInput', () => {
  it('acepta denunciar una vivienda y recorta el motivo', () => {
    expect(
      validateReportInput({ targetType: 'home', targetId: UUID, reason: '  Anuncio falso  ' }),
    ).toEqual({
      success: true,
      data: { targetType: 'home', targetId: UUID, reason: 'Anuncio falso' },
    });
  });

  it('acepta denunciar a un usuario', () => {
    expect(
      validateReportInput({ targetType: 'user', targetId: UUID, reason: 'Acoso' }).success,
    ).toBe(true);
  });

  it('acepta el id de un mensaje de Firestore, que no es un UUID', () => {
    const result = validateReportInput({
      targetType: 'message',
      targetId: 'AbCdEf0123456789xyz',
      reason: 'Insultos',
    });

    expect(result.success).toBe(true);
  });

  it('acepta un motivo de exactamente 1000 caracteres', () => {
    const reason = 'a'.repeat(MAX_REPORT_REASON);

    expect(validateReportInput({ targetType: 'home', targetId: UUID, reason }).success).toBe(true);
  });

  it.each([
    [{ targetType: 'home', targetId: UUID, reason: '' }, 'reason', 'required'],
    [{ targetType: 'home', targetId: UUID, reason: '   ' }, 'reason', 'required'],
    [
      { targetType: 'home', targetId: UUID, reason: 'a'.repeat(MAX_REPORT_REASON + 1) },
      'reason',
      'too_long',
    ],
    [{ targetType: 'home', targetId: 'no-es-uuid', reason: 'x' }, 'targetId', 'invalid'],
    [{ targetType: 'user', targetId: 'no-es-uuid', reason: 'x' }, 'targetId', 'invalid'],
    [{ targetType: 'message', targetId: '', reason: 'x' }, 'targetId', 'required'],
    [{ targetType: 'message', targetId: 'a'.repeat(129), reason: 'x' }, 'targetId', 'too_long'],
    [{ targetType: 'chat', targetId: UUID, reason: 'x' }, 'targetType', 'invalid'],
    [{ targetType: 'home', targetId: UUID, reason: 'x', extra: 1 }, 'extra', 'invalid'],
    [null, 'body', 'invalid'],
  ])('rechaza %j señalando %s', (input, field, code) => {
    const result = validateReportInput(input);

    expect(result).toEqual({ success: false, errors: [{ field, code }] });
  });
});

describe('validateBlockUserInput', () => {
  it('acepta un userId UUID', () => {
    expect(validateBlockUserInput({ userId: UUID })).toEqual({
      success: true,
      data: { userId: UUID },
    });
  });

  it.each([{}, { userId: 'x' }, { userId: UUID, extra: true }, null])('rechaza %j', (input) => {
    expect(validateBlockUserInput(input).success).toBe(false);
  });
});

describe('validateReportResolutionInput', () => {
  it.each(['resolved', 'dismissed'])('acepta %s con una nota recortada', (status) => {
    expect(validateReportResolutionInput({ status, resolution: '  Revisada  ' })).toEqual({
      success: true,
      data: { status, resolution: 'Revisada' },
    });
  });

  it('acepta una nota de exactamente 2000 caracteres', () => {
    const resolution = 'a'.repeat(MAX_REPORT_RESOLUTION);

    expect(validateReportResolutionInput({ status: 'resolved', resolution }).success).toBe(true);
  });

  it.each([
    [{ status: 'resolved' }, 'resolution', 'invalid'],
    [{ status: 'resolved', resolution: '   ' }, 'resolution', 'required'],
    [
      { status: 'dismissed', resolution: 'a'.repeat(MAX_REPORT_RESOLUTION + 1) },
      'resolution',
      'too_long',
    ],
    [{ status: 'open', resolution: 'x' }, 'status', 'invalid'],
    [{ resolution: 'x' }, 'status', 'invalid'],
  ])('rechaza %j señalando %s', (input, field, code) => {
    expect(validateReportResolutionInput(input)).toEqual({
      success: false,
      errors: [{ field, code }],
    });
  });
});
