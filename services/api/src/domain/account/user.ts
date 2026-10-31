import type { AssignedRole } from './role.js';

/** Persona dada de alta en ChangeHouse (`users` en `docs/datamodel.md`). */
export interface User {
  readonly id: string;
  /** UID de Firebase Auth: vincula el token verificado con el usuario. */
  readonly firebaseUid: string;
  readonly email: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly municipality: string | null;
  readonly meetsVppRequirements: boolean;
  readonly isOver65: boolean;
  readonly assignedRole: AssignedRole | null;
  readonly createdAt: Date;
  /** Borrado lógico: desde cuándo la cuenta está eliminada y anonimizada; `null` si sigue activa. */
  readonly deletedAt: Date | null;
}
