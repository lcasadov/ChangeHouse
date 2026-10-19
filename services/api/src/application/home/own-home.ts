import type { Home } from '../../domain/home/home.js';
import { HomeNotFoundError } from './errors.js';
import type { HomeRepository } from './home-repository.js';

/** Una vivienda propia; la ajena y la inexistente son indistinguibles (404). */
export async function ownHome(
  homes: HomeRepository,
  ownerId: string,
  homeId: string,
): Promise<Home> {
  const home = await homes.findById(homeId);
  if (home?.ownerId !== ownerId) throw new HomeNotFoundError();
  return home;
}
