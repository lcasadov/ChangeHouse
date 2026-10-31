import { and, asc, desc, eq, gt, lt, or, type SQL } from 'drizzle-orm';

import type {
  HomeRepository,
  ModerationListing,
} from '../../../application/home/home-repository.js';
import type { Home, HomeLocation, RelevantChange } from '../../../domain/home/home.js';
import { normalizeMunicipality } from '../../../domain/search-preferences/search-preferences.js';
import type { AddressCipher } from '../../crypto/address-cipher.js';
import type { Executor } from './database.js';
import { homes } from './schema.js';

type HomeRow = typeof homes.$inferSelect;
type HomeValues = typeof homes.$inferInsert;

export class DrizzleHomeRepository implements HomeRepository {
  constructor(
    private readonly db: Executor,
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

  async findByIdForUpdate(id: string): Promise<Home | null> {
    const [row] = await this.db.select().from(homes).where(eq(homes.id, id)).limit(1).for('update');
    return row ? this.toHome(row) : null;
  }

  async markRelevantChange(id: string, change: RelevantChange): Promise<void> {
    await this.db.update(homes).set(change).where(eq(homes.id, id));
  }

  async listByOwner(ownerId: string): Promise<Home[]> {
    const rows = await this.db
      .select()
      .from(homes)
      .where(eq(homes.ownerId, ownerId))
      .orderBy(asc(homes.createdAt), asc(homes.id));
    return rows.map((row) => this.toHome(row));
  }

  /**
   * La cola (`in_review`) va de la enviada antes a la enviada después; cualquier otro listado, de la
   * dada de alta más recientemente a la más antigua. El id desempata y completa el cursor.
   */
  async listForModeration(query: ModerationListing): Promise<Home[]> {
    const queue = query.status === 'in_review';
    const sortColumn = queue ? homes.submittedAt : homes.createdAt;
    const [order, past] = queue ? [asc, gt] : [desc, lt];
    const { after } = query;
    const conditions: (SQL | undefined)[] = [
      query.status === undefined ? undefined : eq(homes.status, query.status),
      after
        ? or(past(sortColumn, after.at), and(eq(sortColumn, after.at), past(homes.id, after.id)))
        : undefined,
    ];
    const rows = await this.db
      .select()
      .from(homes)
      .where(and(...conditions))
      .orderBy(order(sortColumn), order(homes.id))
      .limit(query.limit);
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
      municipality: home.location.municipality ?? null,
      municipalityNormalized:
        home.location.municipality === undefined
          ? null
          : normalizeMunicipality(home.location.municipality),
      moderationNote: home.moderationNote,
      submittedAt: home.submittedAt,
      relevantChangedAt: home.relevantChangedAt,
      publishedAt: home.publishedAt,
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
      location: locationOf(row),
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
      submittedAt: row.submittedAt,
      relevantChangedAt: row.relevantChangedAt,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
    };
  }
}

/** La ubicación de la fila; el municipio solo si lo hay, como lo devolvió el servicio de direcciones. */
function locationOf(row: HomeRow): HomeLocation {
  return {
    exact: row.exactLocation,
    areaName: row.areaName,
    areaCenter: row.approxLocation,
    ...(row.municipality === null ? {} : { municipality: row.municipality }),
  };
}
