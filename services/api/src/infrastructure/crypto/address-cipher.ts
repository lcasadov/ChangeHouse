import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION_BYTES = 1;
const MAX_VERSION = 255;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Cifrado de la dirección postal exacta (AES-256-GCM). El valor guardado es
 * `versión (1 byte) | IV (12) | texto cifrado | etiqueta (16)`: la versión identifica la clave
 * con la que se cifró, de modo que se puede rotar la clave sin migrar de golpe los datos
 * anteriores. La versión viaja como dato autenticado: cambiarla invalida la etiqueta.
 */
export class AddressCipher {
  /** `keys`: versión → clave de 32 bytes. `currentVersion`: la que cifra; las demás solo descifran. */
  constructor(
    private readonly keys: ReadonlyMap<number, Buffer>,
    private readonly currentVersion: number,
  ) {
    for (const [version, key] of keys) {
      if (!Number.isInteger(version) || version < 1 || version > MAX_VERSION) {
        throw new Error(
          `La versión de clave ${String(version)} no es válida (1 a ${String(MAX_VERSION)})`,
        );
      }
      if (key.length !== KEY_BYTES) {
        throw new Error(`La clave de cifrado debe tener ${String(KEY_BYTES)} bytes`);
      }
    }
    if (!keys.has(currentVersion)) {
      throw new Error(`No hay clave para la versión vigente ${String(currentVersion)}`);
    }
  }

  /** Una clave en base64 (`ADDRESS_ENCRYPTION_KEY`), como única clave y versión 1. */
  static fromBase64(base64Key: string, version = 1): AddressCipher {
    const key = BASE64.test(base64Key) ? Buffer.from(base64Key, 'base64') : Buffer.alloc(0);
    if (key.length !== KEY_BYTES) {
      throw new Error(`La clave de cifrado debe ser base64 de ${String(KEY_BYTES)} bytes`);
    }
    return new AddressCipher(new Map([[version, key]]), version);
  }

  encrypt(plain: string): Buffer {
    const key = this.keyFor(this.currentVersion);
    const version = Buffer.from([this.currentVersion]);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(version);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([version, iv, encrypted, cipher.getAuthTag()]);
  }

  /** Falla si la clave no corresponde, si el valor se ha manipulado o si la versión no se conoce. */
  decrypt(stored: Buffer): string {
    if (stored.length < VERSION_BYTES + IV_BYTES + TAG_BYTES) {
      throw new Error('La dirección cifrada está truncada');
    }
    const version = stored.subarray(0, VERSION_BYTES);
    const iv = stored.subarray(VERSION_BYTES, VERSION_BYTES + IV_BYTES);
    const tag = stored.subarray(stored.length - TAG_BYTES);
    const encrypted = stored.subarray(VERSION_BYTES + IV_BYTES, stored.length - TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, this.keyFor(version.readUInt8(0)), iv);
    decipher.setAAD(version);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private keyFor(version: number): Buffer {
    const key = this.keys.get(version);
    if (!key) throw new Error(`No hay clave para la versión ${String(version)}`);
    return key;
  }
}
