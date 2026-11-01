import {
  likeHome,
  type Person,
  PLACES,
  publishedHome,
  registerAdmin,
  registerPerson,
  savedSearch,
  type SeededHome,
} from './api';

export interface Neighbour {
  person: Person;
  home: SeededHome;
}

/**
 * Dos personas con viviendas publicadas que se buscan entre sí (valor igual, sin compensación).
 *
 * Aislamiento entre pruebas: cada pareja usa un tipo de vivienda y un municipio que no usa ninguna
 * otra, y cada persona filtra su búsqueda por el tipo de la otra, así que su Explorar solo contiene
 * la vivienda de su pareja aunque otras pruebas hayan publicado las suyas.
 */
export async function compatiblePair(config: {
  first: { name: string; type: 'duplex' | 'atico' | 'chalet' | 'adosado' | 'casa' | 'estudio' };
  second: { name: string; type: 'duplex' | 'atico' | 'chalet' | 'adosado' | 'casa' | 'estudio' };
}) {
  const admin = await registerAdmin('Admin de la pareja');
  const first = await registerPerson(config.first.name, 'pareja-a');
  const second = await registerPerson(config.second.name, 'pareja-b');
  const firstHome = await publishedHome(first, admin, {
    type: config.first.type,
    place: PLACES.getafe,
  });
  const secondHome = await publishedHome(second, admin, {
    type: config.second.type,
    place: PLACES.alcala,
  });
  await savedSearch(first, { municipalities: ['Alcalá de Henares'], types: [config.second.type] });
  await savedSearch(second, { municipalities: ['Getafe'], types: [config.first.type] });
  return {
    admin,
    first: { person: first, home: firstHome } satisfies Neighbour,
    second: { person: second, home: secondHome } satisfies Neighbour,
  };
}

/** Pareja con el match ya formado por la API (el segundo me gusta cierra el match). */
export async function matchedPair(
  config: Parameters<typeof compatiblePair>[0],
): Promise<Awaited<ReturnType<typeof compatiblePair>> & { matchId: string }> {
  const pair = await compatiblePair(config);
  await likeHome(pair.second.person, pair.second.home.id, pair.first.home.id);
  const result = await likeHome(pair.first.person, pair.first.home.id, pair.second.home.id);
  if (!result.match) throw new Error('Los dos me gusta no formaron match');
  return { ...pair, matchId: result.match.id };
}
