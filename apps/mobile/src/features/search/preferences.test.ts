import {
  addMunicipality,
  DEFAULT_RADIUS_KM,
  fromApi,
  hasZone,
  nextMinBedrooms,
  type Preferences,
  removeMunicipality,
  removeZone,
  toggleFlag,
  toggleType,
  withCenter,
  withRadius,
} from './preferences';

const BASE: Preferences = {
  municipalities: ['Getafe'],
  filters: {},
  maxToPayCents: 3_000_000,
  minToReceiveCents: 0,
  valueReferencePct: 50,
};

describe('fromApi', () => {
  it('completa lo que la API omite: filtros vacíos y punto de referencia por defecto', () => {
    const omitted = { municipalities: ['Madrid'], maxToPayCents: 1, minToReceiveCents: 2 };

    // La API aplica el valor por defecto; si una respuesta lo omitiera, la app lo completa igual
    expect(fromApi(omitted as Parameters<typeof fromApi>[0])).toEqual({
      municipalities: ['Madrid'],
      filters: {},
      maxToPayCents: 1,
      minToReceiveCents: 2,
      valueReferencePct: 50,
    });
  });

  it('conserva el centro, el radio y los filtros guardados', () => {
    const saved = {
      center: { lat: 40.4, lng: -3.7 },
      radiusKm: 12,
      filters: { garage: true, minBedrooms: 3 },
      maxToPayCents: 0,
      minToReceiveCents: 5_000_000,
      valueReferencePct: 80,
    };

    expect(fromApi(saved)).toEqual({ ...saved, municipalities: [] });
  });
});

describe('hasZone', () => {
  it.each([
    [{ ...BASE, municipalities: [] }, false],
    [BASE, true],
    [{ ...BASE, municipalities: [], center: { lat: 1, lng: 2 } }, false],
    [{ ...BASE, municipalities: [], center: { lat: 1, lng: 2 }, radiusKm: 5 }, true],
  ])('%j → %s', (preferences, expected) => {
    expect(hasZone(preferences)).toBe(expected);
  });
});

describe('zonas', () => {
  it('añade un municipio sin repetir otro igual aunque cambien tildes o mayúsculas', () => {
    const once = addMunicipality(BASE, 'Alcalá de Henares');

    expect(once.municipalities).toEqual(['Getafe', 'Alcalá de Henares']);
    expect(addMunicipality(once, 'alcala de henares').municipalities).toEqual(once.municipalities);
  });

  it('no admite más de 50 municipios', () => {
    const full = { ...BASE, municipalities: Array.from({ length: 50 }, (_, i) => `M${String(i)}`) };

    expect(addMunicipality(full, 'Otro').municipalities).toHaveLength(50);
  });

  it('quita un municipio', () => {
    expect(removeMunicipality(addMunicipality(BASE, 'Madrid'), 'Getafe').municipalities).toEqual([
      'Madrid',
    ]);
  });

  it('fija un punto con el radio por defecto de 5 km y lo reemplaza al elegir otro', () => {
    const first = withCenter(BASE, { lat: 40.4, lng: -3.7 });
    expect(first).toMatchObject({ center: { lat: 40.4, lng: -3.7 }, radiusKm: DEFAULT_RADIUS_KM });
    expect(DEFAULT_RADIUS_KM).toBe(5);

    const second = withCenter(withRadius(first, 20), { lat: 41, lng: -3 });
    expect(second).toMatchObject({ center: { lat: 41, lng: -3 }, radiusKm: 20 });
  });

  it('quitar el punto elimina también su radio', () => {
    const withPoint = withCenter(BASE, { lat: 40.4, lng: -3.7 });

    const removed = removeZone(withPoint, { kind: 'center' });

    expect(removed).not.toHaveProperty('center');
    expect(removed).not.toHaveProperty('radiusKm');
    expect(removed.municipalities).toEqual(['Getafe']);
  });

  it('removeZone de un municipio lo quita', () => {
    expect(removeZone(BASE, { kind: 'municipality', name: 'Getafe' }).municipalities).toEqual([]);
  });
});

describe('filtros de un toque', () => {
  it('activa y desactiva una característica; desactivada desaparece del documento', () => {
    const on = toggleFlag(BASE, 'garage');
    expect(on.filters).toEqual({ garage: true });

    expect(toggleFlag(on, 'garage').filters).toEqual({});
  });

  it('el mínimo de dormitorios recorre 1, 2, 3, 4 y vuelve a «cualquiera»', () => {
    const steps: (number | undefined)[] = [];
    let current = BASE;
    for (let i = 0; i < 5; i += 1) {
      current = nextMinBedrooms(current);
      steps.push(current.filters?.minBedrooms);
    }

    expect(steps).toEqual([1, 2, 3, 4, undefined]);
  });

  it('conserva los demás filtros al cambiar uno', () => {
    const next = nextMinBedrooms(toggleFlag(BASE, 'lift'));

    expect(next.filters).toEqual({ lift: true, minBedrooms: 1 });
  });

  it('elige y quita tipos de vivienda', () => {
    const piso = toggleType(BASE, 'piso');
    const both = toggleType(piso, 'casa');
    expect(both.filters?.types).toEqual(['piso', 'casa']);

    expect(toggleType(both, 'piso').filters?.types).toEqual(['casa']);
    expect(toggleType(toggleType(both, 'piso'), 'casa').filters).not.toHaveProperty('types');
  });
});
