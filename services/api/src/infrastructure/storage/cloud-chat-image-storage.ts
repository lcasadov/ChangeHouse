import { type Bucket, Storage } from '@google-cloud/storage';

import type { ChatImageStorage } from '../../application/chat/chat-image-storage.js';
import type { OriginalFile } from '../../application/home/photo-storage.js';
import { type CloudStorageConfig, emulatorClient, isNotFound } from './cloud-photo-storage.js';

/**
 * Adaptador de `ChatImageStorage` sobre el bucket privado: los originales y las imágenes procesadas
 * del chat nunca se publican; se leen con URL firmadas V4 de corta duración.
 */
export class CloudChatImageStorage implements ChatImageStorage {
  private readonly bucket: Bucket;

  constructor(config: Pick<CloudStorageConfig, 'privateBucket' | 'emulatorHost'>) {
    const client = config.emulatorHost ? emulatorClient(config.emulatorHost) : new Storage();
    this.bucket = client.bucket(config.privateBucket);
  }

  async createUploadUrl(path: string, contentType: string, expiresAt: Date): Promise<string> {
    const [url] = await this.bucket
      .file(path)
      .getSignedUrl({ version: 'v4', action: 'write', expires: expiresAt, contentType });
    return url;
  }

  async readOriginal(path: string, maxBytes: number): Promise<OriginalFile> {
    const file = this.bucket.file(path);
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

  async store(path: string, data: Buffer, contentType: string): Promise<void> {
    await this.bucket.file(path).save(data, {
      contentType,
      resumable: false,
      metadata: { cacheControl: 'private, max-age=0' },
    });
  }

  async delete(path: string): Promise<void> {
    await this.bucket.file(path).delete({ ignoreNotFound: true });
  }

  async exists(path: string): Promise<boolean> {
    const [found] = await this.bucket.file(path).exists();
    return found;
  }

  async signedReadUrl(path: string, expiresAt: Date): Promise<string> {
    const [url] = await this.bucket
      .file(path)
      .getSignedUrl({ version: 'v4', action: 'read', expires: expiresAt });
    return url;
  }
}
