import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Actores de la matriz: el rol (derivado o asignado) más el estado de la sesión. `suspended` es un
 * `owner` suspendido por un admin: solo consulta su cuenta (y las operaciones públicas).
 */
export const ACTORS = [
  'anon',
  'unregistered',
  'seeker',
  'owner',
  'agency',
  'admin',
  'suspended',
] as const;

export type MatrixActor = (typeof ACTORS)[number];

export interface MatrixRow {
  operationId: string;
  actor: MatrixActor;
  expected: number;
}

/** La matriz como datos (`docs/rbac-matrix.md`, «Matriz como datos»). */
export function loadMatrix(): MatrixRow[] {
  const path = resolve(import.meta.dirname, 'rbac-matrix.json');
  return JSON.parse(readFileSync(path, 'utf8')) as MatrixRow[];
}

/**
 * Incoherencias entre las operaciones implementadas y la matriz: filas que faltan para algún
 * actor y filas de operaciones que no existen. Vacío si la matriz las cubre exactamente.
 */
export function matrixGaps(implemented: Iterable<string>, rows: readonly MatrixRow[]): string[] {
  const operations = new Set(implemented);
  const gaps: string[] = [];
  for (const operationId of [...operations].sort()) {
    for (const actor of ACTORS) {
      const count = rows.filter(
        (row) => row.operationId === operationId && row.actor === actor,
      ).length;
      if (count === 0) gaps.push(`${operationId}: falta la fila del actor ${actor}`);
      if (count > 1) gaps.push(`${operationId}: el actor ${actor} tiene ${String(count)} filas`);
    }
  }
  const unknown = new Set(rows.map((row) => row.operationId).filter((id) => !operations.has(id)));
  for (const operationId of [...unknown].sort()) {
    gaps.push(`${operationId}: hay filas pero la operación no está implementada`);
  }
  return gaps;
}
