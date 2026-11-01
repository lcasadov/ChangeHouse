import postgres from 'postgres';

import { DATABASE_URL } from '../scripts/environment.cjs';

/** Conexión directa a la base de datos E2E, solo para preparar estado que la API local no permite crear. */
export function openSql() {
  return postgres(DATABASE_URL, { max: 1, onnotice: () => undefined });
}

/**
 * Da el rol `admin` (`users.assigned_role`) a una cuenta ya dada de alta. Es la misma operación que
 * hace `pnpm --filter @changehouse/api admin:grant`, sin arrancar otro proceso.
 */
export async function grantAdminRole(email: string): Promise<void> {
  const sql = openSql();
  try {
    const rows =
      await sql`UPDATE users SET assigned_role = 'admin' WHERE email = ${email} RETURNING id`;
    if (rows.length !== 1) throw new Error(`No existe la cuenta ${email}`);
  } finally {
    await sql.end();
  }
}

/**
 * Siembra `count` fotos ya procesadas (`ready`) de una vivienda por SQL.
 *
 * Las fotos se siembran por SQL para no depender de la subida real a fake-gcs, que falló en local
 * hasta corregir #379 (`FAKE_GCS_HOST`). La API solo guarda la ruta; las pruebas no descargan las imágenes.
 */
export async function seedReadyPhotos(homeId: string, count = 3): Promise<void> {
  const sql = openSql();
  try {
    for (let position = 1; position <= count; position += 1) {
      await sql`
        INSERT INTO home_photos (id, home_id, status, storage_path, position)
        VALUES (gen_random_uuid(), ${homeId}, 'ready', ${`photos/${homeId}/${String(position)}.webp`}, ${position})`;
    }
  } finally {
    await sql.end();
  }
}
