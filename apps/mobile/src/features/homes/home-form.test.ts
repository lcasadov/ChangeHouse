import { completeHome, draftHome } from '../../test-support/fake-homes';
import {
  characteristicsDefaults,
  characteristicsResolver,
  decimalFieldText,
  errorKeyOf,
  euroFieldText,
  firstIncompleteStep,
  formatEuros,
  locationDefaults,
  parseDecimal,
  parseEuros,
  stepOfFields,
  typeStepDefaults,
  typeStepResolver,
  valueDefaults,
  valueResolver,
} from './home-form';

interface Resolved {
  values: Record<string, unknown>;
  errors: Record<string, { type: string }>;
}

const noBreakSpaces = (text: string) => text.replaceAll(' ', ' ');

/** Ejecuta un resolver de React Hook Form sin formulario: solo importan los valores y los errores. */
async function run<V>(
  resolver: (values: V, context: undefined, options: never) => unknown,
  values: V,
): Promise<Resolved> {
  return (await resolver(values, undefined, {} as never)) as Resolved;
}

describe('parseDecimal', () => {
  it.each([
    ['', undefined],
    ['   ', undefined],
    ['85', 85],
    [' 85,5 ', 85.5],
    ['85.5', 85.5],
  ] as const)('«%s» es %s', (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  it.each(['abc', '8 5', '-3', '1,2,3'])('«%s» no es un número', (text) => {
    expect(parseDecimal(text)).toBeNaN();
  });
});

describe('parseEuros', () => {
  it.each([
    ['', undefined],
    ['250000', 25_000_000],
    ['250.000', 25_000_000],
    ['250.000 €', 25_000_000],
    ['1.250.000,5', 125_000_050],
    ['99,99', 9999],
  ] as const)('«%s» son %s céntimos', (text, expected) => {
    expect(parseEuros(text)).toBe(expected);
  });

  it.each(['-5', '12,345', 'mucho', '1,2,3'])('«%s» no es un importe', (text) => {
    expect(parseEuros(text)).toBeNaN();
  });
});

describe('formato es-ES', () => {
  it('formatEuros muestra euros con separador de miles y sin decimales innecesarios', () => {
    expect(noBreakSpaces(formatEuros(25_000_000))).toBe('250.000 €');
    expect(noBreakSpaces(formatEuros(9999))).toBe('99,99 €');
  });

  it('el texto de un campo de importe es el número sin moneda, y vacío si no hay valor', () => {
    expect(euroFieldText(25_000_000)).toBe('250.000');
    expect(euroFieldText(null)).toBe('');
    expect(euroFieldText(undefined)).toBe('');
  });

  it('el texto de un campo decimal usa la coma', () => {
    expect(decimalFieldText(85.5)).toBe('85,5');
    expect(decimalFieldText(null)).toBe('');
  });
});

describe('firstIncompleteStep', () => {
  it('un borrador con solo el primer paso continúa en el segundo', () => {
    expect(firstIncompleteStep(draftHome())).toBe(2);
  });

  it('con las características guardadas continúa en el valor', () => {
    const home = draftHome({
      usefulM2: 80,
      builtM2: 95,
      bedrooms: 3,
      bathrooms: 2,
      hasLift: true,
      garage: false,
      storageRoom: false,
    });

    expect(firstIncompleteStep(home)).toBe(3);
  });

  it('con todo guardado salta a la revisión', () => {
    expect(firstIncompleteStep(completeHome())).toBe(5);
  });

  it('un rango a medias sigue en el paso de valor', () => {
    expect(firstIncompleteStep(completeHome({ valueMaxCents: null }))).toBe(3);
  });
});

describe('stepOfFields', () => {
  it('devuelve el paso más temprano que contiene alguno de los campos', () => {
    expect(stepOfFields(['valueMinCents', 'bedrooms'])).toBe(2);
    expect(stepOfFields(['isPrimaryResidence', 'valueMaxCents'])).toBe(3);
  });

  it('un campo desconocido lleva a la revisión', () => {
    expect(stepOfFields(['otraCosa'])).toBe(5);
  });
});

describe('paso 1: tipo y dirección', () => {
  const address = { placeId: 'fixture-malasana', formatted: 'Calle del Pez, 12' };

  it('parte vacío en un alta y con el tipo guardado en un borrador', () => {
    expect(typeStepDefaults()).toEqual({ type: '', address: null });
    expect(typeStepDefaults(draftHome({ type: 'atico' }))).toMatchObject({
      type: 'atico',
      address: null,
    });
  });

  it('exige elegir tipo y dirección', async () => {
    const result = await run(typeStepResolver, { type: '', address: null });

    expect(result.errors).toMatchObject({
      type: { type: 'required' },
      address: { type: 'required' },
    });
  });

  it('devuelve el tipo y la dirección elegida', async () => {
    const result = await run(typeStepResolver, { type: 'piso', address });

    expect(result).toEqual({ values: { type: 'piso', address }, errors: {} });
  });
});

describe('paso 2: características', () => {
  const blank = characteristicsDefaults();

  it('parte con todo sin marcar y los textos vacíos', () => {
    expect(blank).toMatchObject({ usefulM2: '', bedrooms: '', hasLift: false, heating: '' });
    expect(blank.features.terrace).toBe(false);
  });

  it('recupera lo guardado como texto es-ES', () => {
    const values = characteristicsDefaults(
      completeHome({
        usefulM2: 80.5,
        floor: '3',
        features: { terrace: true, heating: 'central' },
        energyRating: 'C',
        yearBuilt: 1990,
      }),
    );

    expect(values).toMatchObject({
      usefulM2: '80,5',
      builtM2: '95',
      bedrooms: '3',
      floor: '3',
      hasLift: true,
      heating: 'central',
      energyRating: 'C',
      yearBuilt: '1990',
    });
    expect(values.features.terrace).toBe(true);
    expect(values.features.garden).toBe(false);
  });

  it('un paso en blanco solo envía lo marcado: guardar sin rellenar es válido en un borrador', async () => {
    const result = await run(characteristicsResolver, blank);

    expect(result.errors).toEqual({});
    expect(result.values).toEqual({
      hasLift: false,
      garage: false,
      storageRoom: false,
      features: {},
    });
  });

  it('convierte los textos y envía solo las características marcadas', async () => {
    const result = await run(characteristicsResolver, {
      ...blank,
      usefulM2: '80,5',
      builtM2: '95',
      bedrooms: '3',
      bathrooms: '2',
      floor: ' 3 ',
      hasLift: true,
      energyRating: 'C',
      yearBuilt: '1990',
      heating: 'central',
      condition: 'good',
      features: { ...blank.features, terrace: true },
    });

    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({
      usefulM2: 80.5,
      builtM2: 95,
      bedrooms: 3,
      bathrooms: 2,
      floor: '3',
      hasLift: true,
      energyRating: 'C',
      yearBuilt: 1990,
      features: { terrace: true, heating: 'central', condition: 'good' },
    });
  });

  it.each([
    ['usefulM2', 'abc'],
    ['usefulM2', '0'],
    ['builtM2', '20000'],
    ['bedrooms', '2,5'],
    ['bathrooms', '99'],
    ['yearBuilt', '1500'],
    ['floor', 'x'.repeat(21)],
  ] as const)('el campo %s con «%s» da un error en ese campo', async (field, text) => {
    const result = await run(characteristicsResolver, { ...blank, [field]: text });

    expect(Object.keys(result.errors)).toEqual([field]);
  });
});

describe('paso 3: valor y cargas', () => {
  const blank = valueDefaults();

  it('parte vacío y recupera los importes guardados', () => {
    expect(blank).toEqual({ valueMin: '', valueMax: '', mortgage: '', isPrimaryResidence: false });
    expect(valueDefaults(completeHome({ mortgageOutstandingCents: 5_000_000 }))).toEqual({
      valueMin: '250.000',
      valueMax: '300.000',
      mortgage: '50.000',
      isPrimaryResidence: true,
    });
  });

  it('convierte los euros a céntimos', async () => {
    const result = await run(valueResolver, {
      valueMin: '250.000',
      valueMax: '300.000',
      mortgage: '50.000,50',
      isPrimaryResidence: true,
    });

    expect(result).toEqual({
      values: {
        valueMinCents: 25_000_000,
        valueMaxCents: 30_000_000,
        mortgageOutstandingCents: 5_000_050,
        isPrimaryResidence: true,
      },
      errors: {},
    });
  });

  it('admite un rango a medias en un borrador', async () => {
    const result = await run(valueResolver, { ...blank, valueMin: '100000' });

    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ valueMinCents: 10_000_000, isPrimaryResidence: false });
  });

  it('un mínimo mayor que el máximo es un error de rango junto al máximo', async () => {
    const result = await run(valueResolver, { ...blank, valueMin: '300000', valueMax: '250000' });

    expect(result.errors).toEqual({ valueMax: { type: 'range' } });
    expect(result.values).toEqual({});
  });

  it.each([
    ['valueMin', '0'],
    ['valueMin', 'mucho'],
    ['valueMax', '0'],
    ['mortgage', '-1'],
  ] as const)('%s con «%s» es un importe no válido', async (field, text) => {
    const result = await run(valueResolver, { ...blank, [field]: text });

    expect(result.errors).toEqual({ [field]: { type: 'invalid' } });
  });
});

describe('paso 4: ubicación visible', () => {
  it('por defecto muestra solo el barrio o zona', () => {
    expect(locationDefaults(undefined)).toEqual({ locationVisibility: 'area' });
    expect(locationDefaults(draftHome())).toEqual({ locationVisibility: 'area' });
  });

  it('recupera la elección guardada', () => {
    const home = draftHome();
    home.location.visibility = 'exact';

    expect(locationDefaults(home)).toEqual({ locationVisibility: 'exact' });
  });
});

describe('errorKeyOf', () => {
  it('el error de rango tiene su propio texto', () => {
    expect(errorKeyOf('valueMax', 'range')).toBe('valueRange');
  });

  it('una dirección que el servidor no resuelve tiene su propio texto', () => {
    expect(errorKeyOf('address', 'unresolved')).toBe('addressNotResolved');
  });

  it('el resto de errores usan el texto del campo', () => {
    expect(errorKeyOf('usefulM2', 'invalid')).toBe('usefulM2');
    expect(errorKeyOf('valueMin', 'invalid')).toBe('valueMin');
    expect(errorKeyOf('address', 'required')).toBe('address');
  });
});
