import { REPORT_REASON_MAX_LENGTH, validateReportReason } from './report-reason';

describe('validateReportReason', () => {
  it('acepta un motivo y lo devuelve sin espacios en los extremos', () => {
    expect(validateReportReason('  Anuncio falso  ')).toEqual({
      ok: true,
      reason: 'Anuncio falso',
    });
  });

  it.each(['', '   '])('rechaza un motivo vacío («%s»)', (text) => {
    expect(validateReportReason(text)).toEqual({ ok: false, error: 'required' });
  });

  it('acepta exactamente 1000 caracteres y rechaza uno más', () => {
    expect(validateReportReason('a'.repeat(REPORT_REASON_MAX_LENGTH)).ok).toBe(true);
    expect(validateReportReason('a'.repeat(REPORT_REASON_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: 'tooLong',
    });
  });
});
