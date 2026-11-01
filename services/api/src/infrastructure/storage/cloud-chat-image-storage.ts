import { type Bucket, Storage } from '@google-cloud/storage';

import type { ChatImageStorage } from '../../application/chat/chat-image-storage.js';
import { chatImagePrefix, chatUploadPrefix } from '../../application/chat/chat-paths.js';
import type { OriginalFile } from '../../application/home/photo-storage.js';
import {
  type CloudStorageConfig,
  emulatorClient,
  readPinnedOriginal,
  UPLOAD_SIZE_RANGE_HEADERS,
} from './cloud-photo-storage.js';

/**
 * Adaptador de `ChatImageStorage` sobre el bucket privado: los originales y las imágenes procesadas
 * del chat nunca se publican; se leen con URL firmadas V4 de corta duración.
 */
export class CloudChatImageStorage implements ChatImageStorage {
  private readonly bucket: Bucket;

  constructor(
    config: Pick<CloudStorageConfig, 'privateBucket' | 'emulatorHost'>,
    client: Storage = config.emulatorHost ? emulatorClient(config.emulatorHost) : new Storage(),
  ) {
    this.bucket = client.bucket(config.privateBucket);
  }

  async createUploadUrl(path: string, contentType: string, expiresAt: Date): Promise<string> {
    const [url] = await this.bucket.file(path).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType,
      extensionHeaders: UPLOAD_SIZE_RANGE_HEADERS,
    });
    return url;
  }

  readOriginal(path: string, maxBytes: number): Promise<OriginalFile> {
    return readPinnedOriginal(this.bucket, path, maxBytes);
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

  async deleteMatchImages(matchId: string): Promise<void> {
    for (const prefix of [chatImagePrefix(matchId), chatUploadPrefix(matchId)]) {
      await this.bucket.deleteFiles({ prefix, force: true });
    }
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
