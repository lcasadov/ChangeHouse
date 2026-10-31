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
  /** Instante en que un admin la suspendió; `null` si la cuenta está activa. */
  readonly suspendedAt: Date | null;
  /** Motivo interno de la suspensión (evidencia para el equipo); nunca se muestra al usuario. */
  readonly suspensionReason: string | null;
  readonly createdAt: Date;
}
