import { inArray } from 'drizzle-orm';

import type {
  Device,
  DeviceRepository,
} from '../../../application/notifications/device-repository.js';
import type { Executor } from './database.js';
import { userDevices } from './schema.js';

/** Dispositivos con push en PostgreSQL: el token es la clave, así que registrar dos veces es refrescar. */
export class DrizzleDeviceRepository implements DeviceRepository {
  constructor(private readonly db: Executor) {}

  async upsert(device: Device): Promise<void> {
    await this.db
      .insert(userDevices)
      .values({
        fcmToken: device.fcmToken,
        userId: device.userId,
        platform: device.platform,
        updatedAt: device.at,
      })
      .onConflictDoUpdate({
        target: userDevices.fcmToken,
        set: { userId: device.userId, platform: device.platform, updatedAt: device.at },
      });
  }

  async tokensOf(userIds: readonly string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db
      .select({ fcmToken: userDevices.fcmToken })
      .from(userDevices)
      .where(inArray(userDevices.userId, [...userIds]));
    return rows.map((row) => row.fcmToken);
  }

  async deleteTokens(tokens: readonly string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.db.delete(userDevices).where(inArray(userDevices.fcmToken, [...tokens]));
  }
}
