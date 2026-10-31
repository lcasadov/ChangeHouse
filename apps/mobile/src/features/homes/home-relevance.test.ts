import { completeHome } from '../../test-support/fake-homes';
import { changesRelevantData, returnsToReview } from './home-relevance';

describe('returnsToReview', () => {
  it('solo una vivienda publicada o pausada vuelve a revisión al cambiar datos relevantes', () => {
    expect(returnsToReview(completeHome({ status: 'published' }))).toBe(true);
    expect(returnsToReview(completeHome({ status: 'paused' }))).toBe(true);
    for (const status of ['draft', 'in_review', 'in_operation', 'closed'] as const) {
      expect(returnsToReview(completeHome({ status }))).toBe(false);
    }
  });
});

describe('changesRelevantData', () => {
  const home = completeHome({ status: 'published', floor: '2ª', features: { terrace: true } });

  it('Scenario: Cambiar el valor de una vivienda publicada - un rango de valor distinto es relevante', () => {
    expect(changesRelevantData(home, { valueMaxCents: 31_000_000 })).toBe(true);
    expect(changesRelevantData(home, { valueMinCents: 24_000_000 })).toBe(true);
  });

  it('Scenario: Cambiar solo la visibilidad de la ubicación - no es relevante', () => {
    expect(changesRelevantData(home, { locationVisibility: 'exact' })).toBe(false);
  });

  it('guardar un paso con los mismos datos no es relevante', () => {
    expect(
      changesRelevantData(home, {
        usefulM2: home.usefulM2 ?? undefined,
        bedrooms: home.bedrooms ?? undefined,
        floor: '2ª',
        features: { terrace: true },
        valueMinCents: home.valueMinCents ?? undefined,
        valueMaxCents: home.valueMaxCents ?? undefined,
        isPrimaryResidence: false,
        mortgageOutstandingCents: 10_000_000,
        energyRating: 'A',
        yearBuilt: 1990,
      }),
    ).toBe(false);
  });

  it('las características se comparan clave a clave, sin contar las que no tienen valor', () => {
    expect(changesRelevantData(home, { features: { terrace: true, garden: undefined } })).toBe(
      false,
    );
    expect(changesRelevantData(home, { features: { terrace: false } })).toBe(true);
    expect(changesRelevantData(home, { features: { terrace: true, garden: true } })).toBe(true);
  });

  it('el tipo, las estancias, la planta y los extras son relevantes', () => {
    expect(changesRelevantData(home, { type: 'atico' })).toBe(true);
    expect(changesRelevantData(home, { bathrooms: 3 })).toBe(true);
    expect(changesRelevantData(home, { floor: '3ª' })).toBe(true);
    expect(changesRelevantData(home, { hasLift: false })).toBe(true);
    expect(changesRelevantData(home, { regime: 'VPPB' })).toBe(true);
  });

  it('otra dirección es relevante; elegir la misma no lo es', () => {
    expect(
      changesRelevantData(home, { address: { placeId: 'otro', formatted: 'Calle de Ibiza, 30' } }),
    ).toBe(true);
    expect(changesRelevantData(home, { address: { placeId: 'x', formatted: home.address } })).toBe(
      false,
    );
  });
});
