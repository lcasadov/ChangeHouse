import type { Consent } from '../../domain/account/consent.js';
import type { User } from '../../domain/account/user.js';

/** Datos del perfil que el propio usuario puede cambiar. */
export interface ProfileChanges {
  displayName?: string;
  /** `null` borra el municipio. */
  municipality?: string | null;
  phone?: string;
  meetsVppRequirements?: boolean;
  isOver65?: boolean;
}

/** Puerto de salida de los usuarios. */
export interface UserRepository {
  findByFirebaseUid(uid: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /**
   * Inserta el usuario y sus consentimientos iniciales en una sola transacción. Devuelve `false`
   * sin cambiar nada si ya existía un usuario con ese UID o ese email (sin distinguir mayúsculas).
   */
  insertWithConsents(user: User, consents: readonly Consent[]): Promise<boolean>;
  /** Actualiza solo los campos presentes y devuelve el usuario resultante. */
  update(id: string, changes: ProfileChanges): Promise<User>;
}
