import { createFixtureZoneSuggestions } from './fixture-zone-suggestions';

const zones = createFixtureZoneSuggestions();

describe('sugerencias de zona de prueba', () => {
  it('sugiere municipios aunque se escriba sin tildes ni mayúsculas', async () => {
    expect(await zones.suggest('alcob')).toEqual([
      { kind: 'municipality', id: 'municipality:Alcobendas', label: 'Alcobendas' },
    ]);
    const alcala = await zones.suggest('ALCALA');
    expect(alcala).toContainEqual({
      kind: 'municipality',
      id: 'municipality:Alcalá de Henares',
      label: 'Alcalá de Henares',
    });
  });

  it('sugiere barrios con el centro de la zona, para buscar con un radio', async () => {
    const result = await zones.suggest('malasa');

    expect(result).toEqual([
      {
        kind: 'place',
        id: 'fixture-malasana',
        label: 'Malasaña',
        center: { lat: 40.4265, lng: -3.7038 },
      },
    ]);
  });

  it('pone el municipio antes que el barrio que comparte nombre', async () => {
    const result = await zones.suggest('getafe');

    expect(result.map((zone) => [zone.kind, zone.label])).toEqual([
      ['municipality', 'Getafe'],
      ['place', 'Getafe Centro'],
    ]);
  });

  it('limita el número de sugerencias', async () => {
    expect((await zones.suggest('a')).length).toBeLessThanOrEqual(6);
  });

  it('sin coincidencias devuelve una lista vacía', async () => {
    expect(await zones.suggest('zzzz')).toEqual([]);
  });
});
