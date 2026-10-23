import { completeHome, draftHome, readyPhotos } from '../../test-support/fake-homes';
import {
  characteristicsDefaults,
  characteristicsResolver,
  dateFieldText,
  decimalFieldText,
  errorKeyOf,
  euroFieldText,
  firstIncompleteStep,
  formatEuros,
  locationDefaults,
  parseDate,
  parseDecimal,
  parseEuros,
  regimeDefaults,
  regimeResolver,
  type RegimeValues,
  sameAsSaved,
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

/** Igual que `run`, con el contexto que el paso pasa a su resolver. */
async function runWith<V, C>(
  resolver: (values: V, context: C, options: never) => unknown,
  values: V,
  context: C,
): Promise<Resolved> {
  return (await resolver(values, context, {} as never)) as Resolved;
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
  it('un borrador sin 3 fotos procesadas continúa en el paso de fotos', () => {
    expect(firstIncompleteStep(draftHome())).toBe(1);
    expect(firstIncompleteStep(completeHome({ photos: readyPhotos(2) }))).toBe(1);
  });

  it('con 3 fotos y solo el tipo y la dirección continúa en las características: «Libre» no pide nada más', () => {
    expect(firstIncompleteStep(draftHome({ photos: readyPhotos(3) }))).toBe(4);
  });

  it('Scenario: VPP sin fecha de calificación - una protegida sin fecha continúa en el paso de régimen', () => {
    expect(firstIncompleteStep(completeHome({ regime: 'VPPL' }))).toBe(3);
    expect(
      firstIncompleteStep(completeHome({ regime: 'VPPL', vppQualificationDate: '2015-03-10' })),
    ).toBe(7);
  });

  it('con las características guardadas continúa en el valor', () => {
    const home = draftHome({
      photos: readyPhotos(3),
      usefulM2: 80,
      builtM2: 95,
      bedrooms: 3,
      bathrooms: 2,
      hasLift: true,
      garage: false,
      storageRoom: false,
    });

    expect(firstIncompleteStep(home)).toBe(5);
  });

  it('con todo guardado salta a la revisión', () => {
    expect(firstIncompleteStep(completeHome())).toBe(7);
  });

  it('un rango a medias sigue en el paso de valor', () => {
    expect(firstIncompleteStep(completeHome({ valueMaxCents: null }))).toBe(5);
  });
});

describe('stepOfFields', () => {
  it('devuelve el paso más temprano que contiene alguno de los campos', () => {
    expect(stepOfFields(['valueMinCents', 'bedrooms'])).toBe(4);
    expect(stepOfFields(['isPrimaryResidence', 'valueMaxCents'])).toBe(5);
    expect(stepOfFields(['valueMaxCents', 'photos'])).toBe(1);
  });

  it('Scenario: VPP sin fecha de calificación - la fecha de calificación se rellena en el paso de régimen', () => {
    expect(stepOfFields(['vppQualificationDate'])).toBe(3);
  });

  it('un campo desconocido lleva a la revisión', () => {
    expect(stepOfFields(['otraCosa'])).toBe(7);
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

describe('valor y tope legal de una vivienda protegida', () => {
  const blank = valueDefaults();

  it('Scenario: Valor por encima del máximo legal - un máximo por encima del precio máximo legal es un error junto al máximo y no se guarda', async () => {
    const result = await runWith(
      valueResolver,
      { ...blank, valueMin: '150000', valueMax: '200000' },
      { maxLegalPriceCents: 18_000_000 },
    );

    expect(result.errors).toEqual({ valueMax: { type: 'aboveLegalPrice' } });
    expect(result.values).toEqual({});
  });

  it('Scenario: Valor por encima del máximo legal - un máximo igual al precio máximo legal se acepta', async () => {
    const result = await runWith(
      valueResolver,
      { ...blank, valueMin: '150000', valueMax: '180000' },
      { maxLegalPriceCents: 18_000_000 },
    );

    expect(result.errors).toEqual({});
  });

  it('sin precio máximo legal no hay tope', async () => {
    const result = await runWith(
      valueResolver,
      { ...blank, valueMin: '150000', valueMax: '900000' },
      { maxLegalPriceCents: null },
    );

    expect(result.errors).toEqual({});
  });
});

describe('fechas escritas a mano (dd/mm/aaaa)', () => {
  it.each([
    ['', undefined],
    ['  ', undefined],
    ['10/03/2015', '2015-03-10'],
    [' 1/3/2015 ', '2015-03-01'],
  ] as const)('«%s» es %s', (text, expected) => {
    expect(parseDate(text)).toBe(expected);
  });

  it.each(['2015-03-10', '31/02/2015', '10/13/2015', 'ayer', '10/03/15'])(
    '«%s» no es una fecha válida',
    (text) => {
      expect(parseDate(text)).toBeNull();
    },
  );

  it('una fecha guardada se muestra como dd/mm/aaaa, y vacía si no hay', () => {
    expect(dateFieldText('2015-03-10')).toBe('10/03/2015');
    expect(dateFieldText(null)).toBe('');
    expect(dateFieldText(undefined)).toBe('');
  });
});

describe('paso 3: régimen', () => {
  const libre: RegimeValues = {
    regime: 'libre',
    qualificationDate: '',
    protectionEnd: '',
    maxLegalPrice: '',
  };
  const noValue = { valueMaxCents: null };

  it('parte de «Libre» y recupera los datos de protección guardados', () => {
    expect(regimeDefaults()).toEqual(libre);
    expect(
      regimeDefaults(
        draftHome({
          regime: 'VPO',
          vppQualificationDate: '2010-01-01',
          vppProtectionEnd: '2040-01-01',
          vppMaxLegalPriceCents: 18_000_000,
        }),
      ),
    ).toEqual({
      regime: 'VPO',
      qualificationDate: '01/01/2010',
      protectionEnd: '01/01/2040',
      maxLegalPrice: '180.000',
    });
  });

  it('Scenario: Vivienda libre - solo guarda el régimen, sin datos de protección aunque se hubieran escrito', async () => {
    const result = await runWith(
      regimeResolver,
      { ...libre, qualificationDate: 'lo que sea', maxLegalPrice: 'mucho' },
      noValue,
    );

    expect(result).toEqual({ values: { regime: 'libre' }, errors: {} });
  });

  it('Scenario: VPP sin fecha de calificación - una VPPL sin fecha es un error junto al campo y no se guarda', async () => {
    const result = await runWith(regimeResolver, { ...libre, regime: 'VPPL' }, noValue);

    expect(result.errors).toEqual({ qualificationDate: { type: 'required' } });
    expect(result.values).toEqual({});
  });

  it('Scenario: VPP sin fecha de calificación - con la fecha guarda el régimen y los datos de protección indicados', async () => {
    const result = await runWith(
      regimeResolver,
      {
        regime: 'VPPL',
        qualificationDate: '10/03/2015',
        protectionEnd: '10/03/2045',
        maxLegalPrice: '300.000',
      },
      noValue,
    );

    expect(result).toEqual({
      values: {
        regime: 'VPPL',
        vppQualificationDate: '2015-03-10',
        vppProtectionEnd: '2045-03-10',
        vppMaxLegalPriceCents: 30_000_000,
      },
      errors: {},
    });
  });

  it('el fin de la protección y el precio máximo legal son opcionales', async () => {
    const result = await runWith(
      regimeResolver,
      { ...libre, regime: 'VPPB', qualificationDate: '10/03/2015' },
      noValue,
    );

    expect(result.values).toEqual({ regime: 'VPPB', vppQualificationDate: '2015-03-10' });
  });

  it('una fecha o un importe no válidos se señalan junto a su campo', async () => {
    const result = await runWith(
      regimeResolver,
      {
        regime: 'VPO',
        qualificationDate: '31/02/2015',
        protectionEnd: 'nunca',
        maxLegalPrice: '0',
      },
      noValue,
    );

    expect(result.errors).toEqual({
      qualificationDate: { type: 'invalid' },
      protectionEnd: { type: 'invalid' },
      maxLegalPrice: { type: 'invalid' },
    });
  });

  it('Scenario: Valor por encima del máximo legal - un precio máximo legal por debajo del valor máximo ya indicado se señala junto al campo', async () => {
    const result = await runWith(
      regimeResolver,
      { ...libre, regime: 'VPO', qualificationDate: '01/01/2010', maxLegalPrice: '180.000' },
      { valueMaxCents: 20_000_000 },
    );

    expect(result.errors).toEqual({ maxLegalPrice: { type: 'belowValue' } });
  });

  it('un paso sin cambios respecto a lo guardado no necesita guardarse', () => {
    const saved = draftHome({ regime: 'VPPL', vppQualificationDate: '2015-03-10' });

    expect(sameAsSaved(draftHome(), { regime: 'libre' })).toBe(true);
    expect(sameAsSaved(saved, { regime: 'VPPL', vppQualificationDate: '2015-03-10' })).toBe(true);
    expect(sameAsSaved(saved, { regime: 'VPPL', vppQualificationDate: '2016-03-10' })).toBe(false);
    expect(sameAsSaved(draftHome(), { regime: 'VPO', vppQualificationDate: '2010-01-01' })).toBe(
      false,
    );
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

  it('los errores del régimen y del tope legal tienen su propio texto', () => {
    expect(errorKeyOf('qualificationDate', 'required')).toBe('qualificationDateRequired');
    expect(errorKeyOf('qualificationDate', 'invalid')).toBe('date');
    expect(errorKeyOf('protectionEnd', 'invalid')).toBe('date');
    expect(errorKeyOf('maxLegalPrice', 'invalid')).toBe('maxLegalPrice');
    expect(errorKeyOf('maxLegalPrice', 'belowValue')).toBe('maxLegalPriceBelowValue');
    expect(errorKeyOf('valueMax', 'aboveLegalPrice')).toBe('valueAboveLegalPrice');
  });

  it('el resto de errores usan el texto del campo', () => {
    expect(errorKeyOf('usefulM2', 'invalid')).toBe('usefulM2');
    expect(errorKeyOf('valueMin', 'invalid')).toBe('valueMin');
    expect(errorKeyOf('address', 'required')).toBe('address');
  });
});
