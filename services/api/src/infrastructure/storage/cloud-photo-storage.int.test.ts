import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { testStorageConfig } from '../../../test/fixtures.js';
import { CloudPhotoStorage } from './cloud-photo-storage.js';

const config = testStorageConfig();
const storage = new CloudPhotoStorage(config);
const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Sube con la URL firmada como lo haría el cliente: PUT directo con el tipo de contenido fijado. */
async function upload(url: string, body: Buffer, contentType = 'image/jpeg'): Promise<Response> {
  return fetch(url, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: new Uint8Array(body),
  });
}

const uniquePath = (prefix: string) => `${prefix}/${randomUUID()}`;

describe('CloudPhotoStorage contra fake-gcs-server', () => {
  it('Scenario: Subir una foto - la URL firmada V4 vale 15 minutos, fija el tipo de contenido y permite subir el original al bucket privado', async () => {
    const path = uniquePath('originals/home-1');
    const expiresAt = new Date(Date.now() + FIFTEEN_MINUTES);

    const url = await storage.createUploadUrl(path, 'image/jpeg', expiresAt);

    const query = new URL(url).searchParams;
    expect(query.get('X-Goog-Algorithm')).toBe('GOOG4-RSA-SHA256');
    expect(Number(query.get('X-Goog-Expires'))).toBeGreaterThan(14 * 60);
    expect(Number(query.get('X-Goog-Expires'))).toBeLessThanOrEqual(15 * 60);
    expect(query.get('X-Goog-SignedHeaders')).toContain('content-type');
    expect(new URL(url).pathname).toBe(`/${config.privateBucket}/${path}`);

    const response = await upload(url, Buffer.from('contenido original'));
    expect(response.ok).toBe(true);
    await expect(storage.readOriginal(path, 1024)).resolves.toEqual({
      status: 'found',
      data: Buffer.from('contenido original'),
    });
  });

  it('un original que no se ha subido figura como inexistente', async () => {
    await expect(storage.readOriginal(uniquePath('originals/x'), 1024)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('un original por encima del máximo no se descarga: figura como demasiado grande', async () => {
    const path = uniquePath('originals/home-1');
    await upload(
      await storage.createUploadUrl(path, 'image/png', new Date(Date.now() + FIFTEEN_MINUTES)),
      Buffer.alloc(2048, 1),
      'image/png',
    );

    await expect(storage.readOriginal(path, 2047)).resolves.toEqual({ status: 'too_large' });
    await expect(storage.readOriginal(path, 2048)).resolves.toMatchObject({ status: 'found' });
  });

  it('Scenario: Foto con coordenadas GPS - lo publicado se sirve desde el bucket público en su URL pública, y el privado no se sirve ahí', async () => {
    const path = `homes/home-1/${randomUUID()}.webp`;

    await storage.publish(path, Buffer.from('foto procesada'), 'image/webp');

    const response = await fetch(storage.publicUrl(path));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from('foto procesada'));
    await expect(storage.readOriginal(path, 1024)).resolves.toEqual({ status: 'missing' });
  });

  it('borrar el original y la foto publicada los elimina, y borrar lo que ya no existe no falla', async () => {
    const original = uniquePath('originals/home-1');
    const published = `homes/home-1/${randomUUID()}.webp`;
    await upload(
      await storage.createUploadUrl(original, 'image/jpeg', new Date(Date.now() + FIFTEEN_MINUTES)),
      Buffer.from('x'),
    );
    await storage.publish(published, Buffer.from('y'), 'image/webp');

    await storage.deleteOriginal(original);
    await storage.deletePublished(published);

    await expect(storage.readOriginal(original, 1024)).resolves.toEqual({ status: 'missing' });
    expect((await fetch(storage.publicUrl(published))).status).toBe(404);
    await expect(storage.deleteOriginal(original)).resolves.toBeUndefined();
    await expect(storage.deletePublished(published)).resolves.toBeUndefined();
  });

  it('la URL pública cuelga de la base configurada', () => {
    expect(storage.publicUrl('homes/a/b.webp')).toBe(`${config.publicBaseUrl}/homes/a/b.webp`);
  });
});
