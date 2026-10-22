import { describe, expect, it } from 'vitest';

import {
  InMemoryHomeRepository,
  InMemorySearchPreferencesRepository,
} from '../../../test/fakes.js';
import { newDraft } from '../../domain/home/home.js';
import { SearchPreferencesIncompleteError } from '../../domain/search-preferences/errors.js';
import { HomeNotFoundError } from '../home/errors.js';
import { SearchPreferencesNotFoundError } from './errors.js';
import { searchPreferencesOperations } from './search-preferences-operations.js';

const NOW = new Date('2026-10-19T10:00:00.000Z');
const OWNER = 'user-1';
const HOME = 'home-1';
const SECOND_HOME = 'home-2';
const FOREIGN_HOME = 'home-3';
const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};
const AMOUNTS = { maxToPayCents: 30_000_00, minToReceiveCents: 0, valueReferencePct: 50 };
const MADRID = { ...AMOUNTS, municipalities: ['Madrid'] };
const VALENCIA = { ...AMOUNTS, municipalities: ['Valencia'], filters: { garage: true } };

function setup() {
  const homes = new InMemoryHomeRepository();
  for (const [id, ownerId] of [
    [HOME, OWNER],
    [SECOND_HOME, OWNER],
    [FOREIGN_HOME, 'user-2'],
  ] as const) {
    homes.homes.set(
      id,
      newDraft({ id, ownerId, now: NOW, type: 'piso', address: 'C/ Pez', location: LOCATION }),
    );
  }
  const preferences = new InMemorySearchPreferencesRepository();
  let sequence = 0;
  const operations = searchPreferencesOperations({
    homes,
    preferences,
    ids: { next: () => `pref-${String(++sequence)}` },
  });
  return { homes, preferences, ...operations };
}

describe('preferencias por defecto del usuario', () => {
  it('Scenario: Guardar preferencias - se consultan tal cual con el punto de referencia 50', async () => {
    const { putMySearchPreferences, getMySearchPreferences } = setup();

    await putMySearchPreferences(OWNER, {
      municipalities: ['Getafe'],
      filters: { minBedrooms: 3 },
      maxToPayCents: 30_000_00,
      minToReceiveCents: 0,
      valueReferencePct: 50,
    });

    expect(await getMySearchPreferences(OWNER)).toEqual({
      municipalities: ['Getafe'],
      filters: { minBedrooms: 3 },
      maxToPayCents: 30_000_00,
      minToReceiveCents: 0,
      valueReferencePct: 50,
    });
  });

  it('la respuesta de un punto con radio incluye centro y radio', async () => {
    const { putMySearchPreferences } = setup();

    const saved = await putMySearchPreferences(OWNER, {
      ...AMOUNTS,
      center: { lat: 40.4, lng: -3.7 },
      radiusKm: 12.5,
    });

    expect(saved).toEqual({
      center: { lat: 40.4, lng: -3.7 },
      radiusKm: 12.5,
      municipalities: [],
      filters: {},
      ...AMOUNTS,
    });
  });

  it('Scenario: Sin zona - no guarda nada y falla con la regla de negocio', async () => {
    const { putMySearchPreferences, preferences } = setup();

    await expect(putMySearchPreferences(OWNER, AMOUNTS)).rejects.toThrow(
      SearchPreferencesIncompleteError,
    );
    expect(preferences.rows).toHaveLength(0);
  });

  it('sin preferencias guardadas la consulta es un 404', async () => {
    const { getMySearchPreferences } = setup();

    await expect(getMySearchPreferences(OWNER)).rejects.toThrow(SearchPreferencesNotFoundError);
  });

  it('guardar de nuevo reemplaza el documento entero, sin fusionar campos', async () => {
    const { putMySearchPreferences, getMySearchPreferences, preferences } = setup();
    await putMySearchPreferences(OWNER, { ...VALENCIA, valueReferencePct: 20 });

    await putMySearchPreferences(OWNER, MADRID);

    expect(await getMySearchPreferences(OWNER)).toEqual({
      municipalities: ['Madrid'],
      filters: {},
      ...AMOUNTS,
    });
    expect(preferences.rows).toHaveLength(1);
  });

  it('cada usuario ve solo las suyas', async () => {
    const { putMySearchPreferences, getMySearchPreferences } = setup();
    await putMySearchPreferences(OWNER, MADRID);

    await expect(getMySearchPreferences('user-2')).rejects.toThrow(SearchPreferencesNotFoundError);
  });
});

describe('preferencias de una vivienda', () => {
  it('Scenario: Preferencias distintas para una segunda vivienda - cada vivienda resuelve las suyas', async () => {
    const { putMySearchPreferences, putHomeSearchPreferences, resolveEffectivePreferences } =
      setup();
    await putMySearchPreferences(OWNER, MADRID);

    await putHomeSearchPreferences(OWNER, SECOND_HOME, VALENCIA);

    const second = await resolveEffectivePreferences(SECOND_HOME);
    const first = await resolveEffectivePreferences(HOME);
    expect(second?.scope).toBe('home');
    expect(second?.preferences.municipalities).toEqual(['Valencia']);
    expect(first?.scope).toBe('user');
    expect(first?.preferences.municipalities).toEqual(['Madrid']);
  });

  it('las propias sustituyen por completo a las del usuario: no heredan sus campos', async () => {
    const { putMySearchPreferences, putHomeSearchPreferences, getHomeSearchPreferences } = setup();
    await putMySearchPreferences(OWNER, {
      ...MADRID,
      filters: { lift: true },
      valueReferencePct: 80,
    });

    await putHomeSearchPreferences(OWNER, HOME, VALENCIA);

    expect(await getHomeSearchPreferences(OWNER, HOME)).toEqual({
      municipalities: ['Valencia'],
      filters: { garage: true },
      ...AMOUNTS,
    });
  });

  it('Scenario: Sin zona - las de una vivienda también exigen zona', async () => {
    const { putHomeSearchPreferences } = setup();

    await expect(putHomeSearchPreferences(OWNER, HOME, AMOUNTS)).rejects.toThrow(
      SearchPreferencesIncompleteError,
    );
  });

  it('sin preferencias propias la consulta es un 404', async () => {
    const { getHomeSearchPreferences } = setup();

    await expect(getHomeSearchPreferences(OWNER, HOME)).rejects.toThrow(
      SearchPreferencesNotFoundError,
    );
  });

  it('Scenario: Volver a las del usuario - tras eliminarlas la consulta es 404 y se resuelven las del usuario', async () => {
    const {
      putMySearchPreferences,
      putHomeSearchPreferences,
      deleteHomeSearchPreferences,
      getHomeSearchPreferences,
      resolveEffectivePreferences,
    } = setup();
    await putMySearchPreferences(OWNER, MADRID);
    await putHomeSearchPreferences(OWNER, HOME, VALENCIA);

    await deleteHomeSearchPreferences(OWNER, HOME);

    await expect(getHomeSearchPreferences(OWNER, HOME)).rejects.toThrow(
      SearchPreferencesNotFoundError,
    );
    expect((await resolveEffectivePreferences(HOME))?.scope).toBe('user');
  });

  it('eliminar unas preferencias que no existen es un 404', async () => {
    const { deleteHomeSearchPreferences } = setup();

    await expect(deleteHomeSearchPreferences(OWNER, HOME)).rejects.toThrow(
      SearchPreferencesNotFoundError,
    );
  });

  it('Scenario: Vivienda ajena - leer, cambiar o eliminar es un 404 y no toca nada', async () => {
    const {
      putHomeSearchPreferences,
      getHomeSearchPreferences,
      deleteHomeSearchPreferences,
      preferences,
    } = setup();

    await expect(getHomeSearchPreferences(OWNER, FOREIGN_HOME)).rejects.toThrow(HomeNotFoundError);
    await expect(putHomeSearchPreferences(OWNER, FOREIGN_HOME, MADRID)).rejects.toThrow(
      HomeNotFoundError,
    );
    await expect(deleteHomeSearchPreferences(OWNER, FOREIGN_HOME)).rejects.toThrow(
      HomeNotFoundError,
    );
    expect(preferences.rows).toHaveLength(0);
  });

  it('una vivienda inexistente se trata igual que una ajena', async () => {
    const { getHomeSearchPreferences } = setup();

    await expect(getHomeSearchPreferences(OWNER, 'missing')).rejects.toThrow(HomeNotFoundError);
  });

  it('la propiedad de la vivienda se comprueba antes que la zona: una ajena sin zona sigue siendo 404', async () => {
    const { putHomeSearchPreferences } = setup();

    await expect(putHomeSearchPreferences(OWNER, FOREIGN_HOME, AMOUNTS)).rejects.toThrow(
      HomeNotFoundError,
    );
  });
});

describe('resolveEffectivePreferences', () => {
  it('sin preferencias propias ni del usuario no hay ninguna', async () => {
    const { resolveEffectivePreferences } = setup();

    expect(await resolveEffectivePreferences(HOME)).toBeNull();
  });

  it('una vivienda sin preferencias propias usa las del usuario propietario', async () => {
    const { putMySearchPreferences, resolveEffectivePreferences } = setup();
    await putMySearchPreferences(OWNER, MADRID);

    const effective = await resolveEffectivePreferences(HOME);

    expect(effective?.scope).toBe('user');
    expect(effective?.preferences).toMatchObject({ municipalities: ['Madrid'], ...AMOUNTS });
  });

  it('las preferencias de otro usuario nunca se aplican', async () => {
    const { putMySearchPreferences, resolveEffectivePreferences } = setup();
    await putMySearchPreferences('user-2', MADRID);

    expect(await resolveEffectivePreferences(HOME)).toBeNull();
  });

  it('una vivienda que no existe no tiene preferencias que resolver', async () => {
    const { resolveEffectivePreferences } = setup();

    await expect(resolveEffectivePreferences('missing')).rejects.toThrow(HomeNotFoundError);
  });
});
