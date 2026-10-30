import { generateKeyPairSync } from 'node:crypto';

import { type Bucket, Storage } from '@google-cloud/storage';

import type { OriginalFile, PhotoStorage } from '../../application/home/photo-storage.js';

export interface CloudStorageConfig {
  privateBucket: string;
  publicBucket: string;
  publicBaseUrl: string;
  /** `host:puerto` de fake-gcs-server; sin él se usa Cloud Storage con las credenciales del entorno. */
  emulatorHost: string | undefined;
}

const NOT_FOUND = 404;
const RSA_KEY_BITS = 2048;
/** Las fotos publicadas no cambian nunca (cada una tiene su propio identificador): caché de un año. */
const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Cliente para el emulador. fake-gcs-server no valida la firma de las URL, pero la biblioteca exige
 * una clave para firmarlas: se genera una efímera que no sale del proceso y no sirve en ningún otro sitio.
 */
export function emulatorClient(emulatorHost: string): Storage {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: RSA_KEY_BITS,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return new Storage({
    apiEndpoint: `http://${emulatorHost}`,
    projectId: 'changehouse-local',
    credentials: {
      client_email: 'emulator@changehouse-local.iam.gserviceaccount.com',
      private_key: privateKey,
    },
  });
}

export function isNotFound(error: unknown): boolean {
  return (error as { code?: number }).code === NOT_FOUND;
}

/**
 * Adaptador de `PhotoStorage` sobre Cloud Storage: URL firmadas V4 para subir los originales a un
 * bucket privado, y las fotos procesadas en uno público. En producción firma con la cuenta de servicio
 * del entorno (Cloud Run); en local y en pruebas, contra fake-gcs-server.
 */
export class CloudPhotoStorage implements PhotoStorage {
  private readonly privateBucket: Bucket;
  private readonly publicBucket: Bucket;
  private readonly publicBaseUrl: string;

  constructor(config: CloudStorageConfig) {
    const client = config.emulatorHost ? emulatorClient(config.emulatorHost) : new Storage();
    this.privateBucket = client.bucket(config.privateBucket);
    this.publicBucket = client.bucket(config.publicBucket);
    this.publicBaseUrl = config.publicBaseUrl;
  }

  async createUploadUrl(path: string, contentType: string, expiresAt: Date): Promise<string> {
    const [url] = await this.privateBucket
      .file(path)
      .getSignedUrl({ version: 'v4', action: 'write', expires: expiresAt, contentType });
    return url;
  }

  async readOriginal(path: string, maxBytes: number): Promise<OriginalFile> {
    const file = this.privateBucket.file(path);
    try {
      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) > maxBytes) return { status: 'too_large' };
      const [data] = await file.download();
      return { status: 'found', data };
    } catch (error) {
      if (isNotFound(error)) return { status: 'missing' };
      throw error;
    }
  }

  async publish(path: string, data: Buffer, contentType: string): Promise<void> {
    await this.publicBucket.file(path).save(data, {
      contentType,
      resumable: false,
      metadata: { cacheControl: PUBLIC_CACHE_CONTROL },
    });
  }

  async deleteOriginal(path: string): Promise<void> {
    await this.privateBucket.file(path).delete({ ignoreNotFound: true });
  }

  async deletePublished(path: string): Promise<void> {
    await this.publicBucket.file(path).delete({ ignoreNotFound: true });
  }

  publicUrl(path: string): string {
    return `${this.publicBaseUrl}/${path}`;
  }
}
