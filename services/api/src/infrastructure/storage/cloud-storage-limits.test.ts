import type { Storage } from '@google-cloud/storage';
import { describe, expect, it } from 'vitest';

import { CloudChatImageStorage } from './cloud-chat-image-storage.js';
import { CloudPhotoStorage, UPLOAD_SIZE_RANGE_HEADERS } from './cloud-photo-storage.js';

const CONFIG = {
  privateBucket: 'privado',
  publicBucket: 'publico',
  publicBaseUrl: 'http://localhost:4443/publico',
  emulatorHost: 'localhost:4443',
};
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);
const SIGNED_HEADER = 'x-goog-content-length-range';

/** Cabeceras que la firma V4 exige repetir en la subida (`X-Goog-SignedHeaders`). */
function signedHeaders(url: string): string[] {
  return (new URL(url).searchParams.get('X-Goog-SignedHeaders') ?? '').split(';');
}

describe('límite de tamaño de las URL firmadas de subida', () => {
  it('Scenario: Fichero demasiado grande - la URL de una foto firma el rango de tamaño', async () => {
    const storage = new CloudPhotoStorage(CONFIG);

    const url = await storage.createUploadUrl('originals/h/p', 'image/jpeg', inMinutes(15));

    expect(signedHeaders(url)).toContain(SIGNED_HEADER);
    expect(signedHeaders(url)).toContain('content-type');
  });

  it('Scenario: Fichero demasiado grande - la URL de una imagen del chat también', async () => {
    const storage = new CloudChatImageStorage(CONFIG);

    const url = await storage.createUploadUrl('chat-uploads/m/u/i', 'image/png', inMinutes(15));

    expect(signedHeaders(url)).toContain(SIGNED_HEADER);
  });

  it('la cabecera exigida fija el máximo en 25 MB (26214400 bytes)', () => {
    expect(UPLOAD_SIZE_RANGE_HEADERS).toEqual({ [SIGNED_HEADER]: '0,26214400' });
  });
});

/** Un `Storage` mínimo: anota cómo se abre cada fichero y qué se descarga. */
function stubClient(metadata: { size: string; generation: string }) {
  const opened: { path: string; generation: number | string | undefined }[] = [];
  const client = {
    bucket: () => ({
      file: (path: string, options?: { generation?: number | string }) => {
        opened.push({ path, generation: options?.generation });
        return {
          getMetadata: () => Promise.resolve([metadata]),
          download: () => Promise.resolve([Buffer.from('contenido')]),
        };
      },
    }),
  } as unknown as Storage;
  return { client, opened };
}

const BUILDERS = [
  ['foto', (client: Storage) => new CloudPhotoStorage(CONFIG, client)],
  ['chat', (client: Storage) => new CloudChatImageStorage(CONFIG, client)],
] as const;

describe('descarga del original anclada a la generación que se midió', () => {
  it.each(BUILDERS)(
    'Scenario: Original sustituido tras medirlo (%s) - descarga la generación leída en getMetadata, no la actual',
    async (_name, build) => {
      const { client, opened } = stubClient({ size: '9', generation: '1730000000000001' });

      const result = await build(client).readOriginal('originals/h/p', 1024);

      expect(result).toEqual({ status: 'found', data: Buffer.from('contenido') });
      expect(opened.at(-1)).toEqual({ path: 'originals/h/p', generation: 1730000000000001 });
    },
  );

  it.each(BUILDERS)('un original demasiado grande (%s) no se descarga', async (_name, build) => {
    const { client, opened } = stubClient({ size: '2000', generation: '7' });

    const result = await build(client).readOriginal('originals/h/p', 1024);

    expect(result).toEqual({ status: 'too_large' });
    expect(opened).toHaveLength(1);
  });
});

describe('retención: borrado de las imágenes de un match', () => {
  it('deleteMatchImages borra por prefijo las imágenes procesadas y los originales del match', async () => {
    const prefixes: string[] = [];
    const client = {
      bucket: () => ({
        deleteFiles: (options: { prefix: string }) => {
          prefixes.push(options.prefix);
          return Promise.resolve();
        },
      }),
    } as unknown as Storage;

    await new CloudChatImageStorage(CONFIG, client).deleteMatchImages('match-1');

    expect(prefixes).toEqual(['chat/match-1/', 'chat-uploads/match-1/']);
  });
});
