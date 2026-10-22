import { asc, eq } from 'drizzle-orm';

import type { HomeRepository } from '../../../application/home/home-repository.js';
import type { Home } from '../../../domain/home/home.js';
import type { AddressCipher } from '../../crypto/address-cipher.js';
import type { Database } from './database.js';
import { homes } from './schema.js';

type HomeRow = typeof homes.$inferSelect;
type HomeValues = typeof homes.$inferInsert;

export class DrizzleHomeRepository implements HomeRepository {
  constructor(
    private readonly db: Database,
    private readonly cipher: AddressCipher,
  ) {}

  async insert(home: Home): Promise<void> {
    await this.db.insert(homes).values({
      id: home.id,
      ownerId: home.ownerId,
      createdAt: home.createdAt,
      ...this.valuesOf(home),
    });
  }

  async save(home: Home): Promise<void> {
    const updated = await this.db
      .update(homes)
      .set(this.valuesOf(home))
      .where(eq(homes.id, home.id))
      .returning({ id: homes.id });
    if (updated.length === 0) throw new Error(`Vivienda inexistente: ${home.id}`);
  }

  async findById(id: string): Promise<Home | null> {
    const [row] = await this.db.select().from(homes).where(eq(homes.id, id)).limit(1);
    return row ? this.toHome(row) : null;
  }

  async listByOwner(ownerId: string): Promise<Home[]> {
    const rows = await this.db
      .select()
      .from(homes)
      .where(eq(homes.ownerId, ownerId))
      .orderBy(asc(homes.createdAt), asc(homes.id));
    return rows.map((row) => this.toHome(row));
  }

  /** Datos modificables de la vivienda; el id, el propietario y la fecha de alta no cambian. */
  private valuesOf(home: Home): Omit<HomeValues, 'id' | 'ownerId' | 'createdAt'> {
    return {
      type: home.type,
      status: home.status,
      regime: home.regime,
      vppQualificationDate: home.vppQualificationDate,
      vppProtectionEnd: home.vppProtectionEnd,
      vppMaxLegalPriceCents: home.vppMaxLegalPriceCents,
      usefulM2: home.usefulM2,
      builtM2: home.builtM2,
      bedrooms: home.bedrooms,
      bathrooms: home.bathrooms,
      floor: home.floor,
      hasLift: home.hasLift,
      garage: home.garage,
      storageRoom: home.storageRoom,
      features: home.features,
      energyRating: home.energyRating,
      yearBuilt: home.yearBuilt,
      valueMinCents: home.valueMinCents,
      valueMaxCents: home.valueMaxCents,
      isPrimaryResidence: home.isPrimaryResidence,
      mortgageOutstandingCents: home.mortgageOutstandingCents,
      exactAddress: this.cipher.encrypt(home.address),
      locationVisibility: home.locationVisibility,
      exactLocation: home.location.exact,
      approxLocation: home.location.areaCenter,
      areaName: home.location.areaName,
      moderationNote: home.moderationNote,
      relevantChangedAt: home.relevantChangedAt,
    };
  }

  private toHome(row: HomeRow): Home {
    return {
      id: row.id,
      ownerId: row.ownerId,
      status: row.status,
      type: row.type,
      regime: row.regime,
      address: this.cipher.decrypt(row.exactAddress),
      location: {
        exact: row.exactLocation,
        areaName: row.areaName,
        areaCenter: row.approxLocation,
      },
      locationVisibility: row.locationVisibility,
      usefulM2: row.usefulM2,
      builtM2: row.builtM2,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      floor: row.floor,
      hasLift: row.hasLift,
      garage: row.garage,
      storageRoom: row.storageRoom,
      features: row.features,
      energyRating: row.energyRating,
      yearBuilt: row.yearBuilt,
      valueMinCents: row.valueMinCents,
      valueMaxCents: row.valueMaxCents,
      isPrimaryResidence: row.isPrimaryResidence,
      mortgageOutstandingCents: row.mortgageOutstandingCents,
      vppQualificationDate: row.vppQualificationDate,
      vppProtectionEnd: row.vppProtectionEnd,
      vppMaxLegalPriceCents: row.vppMaxLegalPriceCents,
      moderationNote: row.moderationNote,
      relevantChangedAt: row.relevantChangedAt,
      createdAt: row.createdAt,
    };
  }
}
