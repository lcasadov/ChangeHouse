import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { testStorageConfig } from '../../../test/fixtures.js';
import { CloudChatImageStorage } from './cloud-chat-image-storage.js';

const config = testStorageConfig();
const storage = new CloudChatImageStorage(config);
const MINUTES = 60_000;
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * MINUTES);
const uniquePath = (prefix: string) => `${prefix}/${randomUUID()}`;

describe('CloudChatImageStorage contra fake-gcs-server', () => {
  it('la URL de subida firmada deja subir el original al bucket privado y se puede leer', async () => {
    const path = uniquePath('chat-uploads/match-1/user-1');

    const url = await storage.createUploadUrl(path, 'image/jpeg', inMinutes(15));

    expect(new URL(url).pathname).toBe(`/${config.privateBucket}/${path}`);
    const put = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: new Uint8Array(Buffer.from('original')),
    });
    expect(put.ok).toBe(true);
    await expect(storage.readOriginal(path, 1024)).resolves.toEqual({
      status: 'found',
      data: Buffer.from('original'),
    });
    await expect(storage.readOriginal(path, 4)).resolves.toEqual({ status: 'too_large' });
  });

  it('un original que no existe figura como inexistente', async () => {
    await expect(storage.readOriginal(uniquePath('chat-uploads/x'), 1024)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('guarda la imagen procesada en el bucket privado: no se lee por la URL pública y sí con la firmada', async () => {
    const path = uniquePath('chat/match-1');

    await storage.store(path, Buffer.from('webp'), 'image/webp');

    const signed = await storage.signedReadUrl(path, inMinutes(15));
    expect(new URL(signed).pathname).toBe(`/${config.privateBucket}/${path}`);
    const query = new URL(signed).searchParams;
    expect(query.get('X-Goog-Algorithm')).toBe('GOOG4-RSA-SHA256');
    expect(Number(query.get('X-Goog-Expires'))).toBeLessThanOrEqual(15 * 60);
    const served = await fetch(signed);
    expect(served.ok).toBe(true);
    expect(Buffer.from(await served.arrayBuffer())).toEqual(Buffer.from('webp'));
    const publicRead = await fetch(`${config.publicBaseUrl}/${path}`);
    expect(publicRead.ok).toBe(false);
  });

  it('exists dice si la imagen procesada está guardada', async () => {
    const path = uniquePath('chat/match-1');

    await expect(storage.exists(path)).resolves.toBe(false);
    await storage.store(path, Buffer.from('webp'), 'image/webp');

    await expect(storage.exists(path)).resolves.toBe(true);
  });

  it('delete borra el objeto y borrar uno que no existe no es un error', async () => {
    const path = uniquePath('chat/match-1');
    await storage.store(path, Buffer.from('webp'), 'image/webp');

    await storage.delete(path);
    await expect(storage.delete(path)).resolves.toBeUndefined();

    const gone = await fetch(await storage.signedReadUrl(path, inMinutes(1)));
    expect(gone.ok).toBe(false);
  });

  it('deleteMatchImages borra las imágenes procesadas y los originales de ese match y no las de otro', async () => {
    const match = randomUUID();
    const other = randomUUID();
    await storage.store(`chat/${match}/a.webp`, Buffer.from('a'), 'image/webp');
    await storage.store(`chat/${match}/b.webp`, Buffer.from('b'), 'image/webp');
    await storage.store(`chat-uploads/${match}/user/up`, Buffer.from('u'), 'image/jpeg');
    await storage.store(`chat/${other}/a.webp`, Buffer.from('o'), 'image/webp');

    await storage.deleteMatchImages(match);
    await expect(storage.deleteMatchImages(match)).resolves.toBeUndefined();

    await expect(storage.exists(`chat/${match}/a.webp`)).resolves.toBe(false);
    await expect(storage.exists(`chat/${match}/b.webp`)).resolves.toBe(false);
    await expect(storage.exists(`chat-uploads/${match}/user/up`)).resolves.toBe(false);
    await expect(storage.exists(`chat/${other}/a.webp`)).resolves.toBe(true);
  });
});
