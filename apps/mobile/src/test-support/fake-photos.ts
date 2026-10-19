import type { PhotoPicker, PickedPhoto } from '../features/homes/photo-picker';
import type { PhotoUploader, PhotoUploadTarget } from '../features/homes/photo-uploader';
import type { FakeBackend } from './fake-backend';

/** Una foto elegida de la galería con el nombre dado; la extensión `.txt` simula un fichero que no es imagen. */
export function pickedPhoto(name: string, contentType = 'image/jpeg'): PickedPhoto {
  return { uri: `file:///galeria/${name}`, contentType };
}

/** La galería del dispositivo: cada llamada a `pick` devuelve la siguiente selección preparada. */
export class FakePhotoPicker implements PhotoPicker {
  /** El máximo de fotos que se pidió en cada apertura de la galería. */
  readonly limits: number[] = [];
  /** La galería no se puede abrir (por ejemplo, sin permisos). */
  fails = false;
  private readonly selections: PickedPhoto[][] = [];

  /** Prepara lo que elegirá la persona la próxima vez que abra la galería. */
  choose(...photos: PickedPhoto[]): void {
    this.selections.push(photos);
  }

  pick(limit: number): Promise<PickedPhoto[]> {
    this.limits.push(limit);
    if (this.fails) return Promise.reject(new Error('Sin acceso a la galería'));
    return Promise.resolve((this.selections.shift() ?? []).slice(0, limit));
  }
}

/**
 * El envío del fichero a la URL firmada: avisa del progreso, deja el fichero en el almacenamiento
 * del backend simulado y puede retenerse o fallar para probar el progreso y los errores.
 */
export class FakePhotoUploader implements PhotoUploader {
  readonly uploads: PhotoUploadTarget[] = [];
  /** Cuántos envíos fallan antes de volver a funcionar. */
  failures = 0;
  private gate: Promise<void> | null = null;

  constructor(private readonly backend: FakeBackend) {}

  /** Retiene los envíos a mitad de camino (40 %) hasta llamar a la función devuelta. */
  hold(): () => void {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.gate = gate;
    return () => {
      this.gate = null;
      release();
    };
  }

  async upload(target: PhotoUploadTarget, onProgress: (ratio: number) => void): Promise<void> {
    this.uploads.push(target);
    const gate = this.gate;
    if (gate) {
      onProgress(0.4);
      await gate;
    }
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('Sin conexión con el almacenamiento');
    }
    onProgress(1);
    this.backend.homes.receiveUpload(target.url, !target.uri.endsWith('.txt'));
  }
}
