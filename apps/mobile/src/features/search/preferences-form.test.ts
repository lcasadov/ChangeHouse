import { buildInput, errorsFromApi, formFromPreferences } from './preferences-form';
import { SearchPreferencesApiError } from './search-preferences-api';

const SAVED = {
  municipalities: ['Getafe'],
  filters: { minBedrooms: 3, minUsefulM2: 80.5 },
  maxToPayCents: 3_000_000,
  minToReceiveCents: 0,
  valueReferencePct: 70,
};

describe('formFromPreferences', () => {
  it('sin preferencias previas parte vacío, con el punto de referencia en 50', () => {
    const form = formFromPreferences(null);

    expect(form).toMatchObject({
      draft: { municipalities: [], valueReferencePct: 50 },
      maxToPay: '',
      minToReceive: '',
      minUsefulM2: '',
    });
  });

  it('muestra los importes en euros con formato es-ES y los metros con coma decimal', () => {
    const form = formFromPreferences(SAVED);

    expect(form.maxToPay).toBe('30.000');
    expect(form.minToReceive).toBe('0');
    expect(form.minUsefulM2).toBe('80,5');
  });
});

describe('buildInput', () => {
  it('convierte los euros escritos a céntimos y conserva el resto del documento', () => {
    const form = { ...formFromPreferences(SAVED), maxToPay: '25.000', minToReceive: '1.250,50 €' };

    const result = buildInput(form);

    expect(result).toEqual({
      ok: true,
      input: { ...SAVED, maxToPayCents: 2_500_000, minToReceiveCents: 125_050 },
    });
  });

  it('el 0 es un importe válido: «recibir al menos 0 €»', () => {
    const result = buildInput({ ...formFromPreferences(SAVED), minToReceive: '0' });

    expect(result).toMatchObject({ ok: true, input: { minToReceiveCents: 0 } });
  });

  it('sin metros mínimos no envía el filtro', () => {
    const result = buildInput({ ...formFromPreferences(SAVED), minUsefulM2: '' });

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.input.filters).not.toHaveProperty('minUsefulM2');
  });

  it('sin zona señala la zona y no valida más', () => {
    const form = formFromPreferences(null);

    expect(buildInput({ ...form, maxToPay: '1', minToReceive: '1' })).toEqual({
      ok: false,
      errors: { zone: true },
    });
  });

  it('señala los importes vacíos o no válidos', () => {
    const result = buildInput({
      ...formFromPreferences(SAVED),
      maxToPay: '',
      minToReceive: 'mucho',
    });

    expect(result).toEqual({ ok: false, errors: { maxToPay: true, minToReceive: true } });
  });

  it('señala unos metros mínimos no válidos', () => {
    const result = buildInput({ ...formFromPreferences(SAVED), minUsefulM2: 'ochenta' });

    expect(result).toEqual({ ok: false, errors: { minUsefulM2: true } });
  });

  it('Scenario: Punto de referencia fuera de rango - 120 se señala junto a su campo sin llamar a la API', () => {
    const form = formFromPreferences({ ...SAVED, valueReferencePct: 120 });

    expect(buildInput(form)).toEqual({ ok: false, errors: { valueReferencePct: true } });
  });

  it('un radio fuera de 0–200 km se señala', () => {
    const form = formFromPreferences({
      ...SAVED,
      municipalities: [],
      center: { lat: 40, lng: -3 },
      radiusKm: 201,
    });

    expect(buildInput(form)).toEqual({ ok: false, errors: { radius: true } });
  });
});

describe('errorsFromApi', () => {
  it.each([
    [new SearchPreferencesApiError('incomplete', ['municipalities']), { zone: true }],
    [new SearchPreferencesApiError('invalid', ['valueReferencePct']), { valueReferencePct: true }],
    [new SearchPreferencesApiError('invalid', ['maxToPayCents']), { maxToPay: true }],
    [new SearchPreferencesApiError('invalid', ['minToReceiveCents']), { minToReceive: true }],
    [new SearchPreferencesApiError('invalid', ['filters.minUsefulM2']), { minUsefulM2: true }],
    [new SearchPreferencesApiError('invalid', ['radiusKm']), { radius: true }],
    [new SearchPreferencesApiError('invalid', ['center']), { zone: true }],
    [new SearchPreferencesApiError('invalid', ['body']), { general: true }],
    [new SearchPreferencesApiError('incomplete'), { zone: true }],
    [new SearchPreferencesApiError('server'), { general: true }],
    [new SearchPreferencesApiError('network'), { general: true }],
  ])('%s', (error, expected) => {
    expect(errorsFromApi(error)).toEqual(expected);
  });
});
