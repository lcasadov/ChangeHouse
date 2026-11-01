import { inArray } from 'drizzle-orm';

import type { PublicHome } from '../../../application/home/home-views.js';
import type { MatchHomeReader } from '../../../application/matching/matching-repository.js';
import type { AddressCipher } from '../../crypto/address-cipher.js';
import type { Executor } from './database.js';
import { homes } from './schema.js';

/**
 * Las viviendas de un match en PostgreSQL. La forma pública se lee sin la columna de la dirección,
 * de modo que no hay nada que descifrar; la dirección exacta solo se obtiene (y se descifra) con
 * `exactAddresses`, que el caso de uso pide únicamente para los participantes (RN-08).
 */
export class DrizzleMatchHomes implements MatchHomeReader {
  constructor(
    private readonly db: Executor,
    private readonly cipher: AddressCipher,
  ) {}

  async findPublicHomes(homeIds: readonly string[]): Promise<PublicHome[]> {
    const rows = await this.db
      .select({
        id: homes.id,
        type: homes.type,
        regime: homes.regime,
        usefulM2: homes.usefulM2,
        builtM2: homes.builtM2,
        bedrooms: homes.bedrooms,
        bathrooms: homes.bathrooms,
        floor: homes.floor,
        hasLift: homes.hasLift,
        garage: homes.garage,
        storageRoom: homes.storageRoom,
        features: homes.features,
        energyRating: homes.energyRating,
        yearBuilt: homes.yearBuilt,
        valueMinCents: homes.valueMinCents,
        valueMaxCents: homes.valueMaxCents,
        vppMaxLegalPriceCents: homes.vppMaxLegalPriceCents,
        locationVisibility: homes.locationVisibility,
        exactLocation: homes.exactLocation,
        approxLocation: homes.approxLocation,
        areaName: homes.areaName,
        municipality: homes.municipality,
      })
      .from(homes)
      .where(inArray(homes.id, [...homeIds]));
    return rows.map(({ exactLocation, approxLocation, areaName, municipality, ...home }) => ({
      ...home,
      location: {
        exact: exactLocation ?? approxLocation,
        areaName,
        areaCenter: approxLocation,
        ...(municipality === null ? {} : { municipality }),
      },
    }));
  }

  async exactAddresses(homeIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ id: homes.id, exactAddress: homes.exactAddress })
      .from(homes)
      .where(inArray(homes.id, [...homeIds]));
    return new Map(
      rows.flatMap((row) =>
        row.exactAddress === null ? [] : [[row.id, this.cipher.decrypt(row.exactAddress)] as const],
      ),
    );
  }
}
