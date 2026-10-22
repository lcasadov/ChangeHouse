import type { PhotoUploader, PhotoUploadTarget } from './photo-uploader';

const SUCCESS_MIN = 200;
const SUCCESS_MAX = 300;

function send(
  target: PhotoUploadTarget,
  body: Blob,
  onProgress: (ratio: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', target.url);
    request.setRequestHeader('Content-Type', target.contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= SUCCESS_MIN && request.status < SUCCESS_MAX) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`El almacenamiento rechazó la subida (${String(request.status)})`));
      }
    };
    request.onerror = () => {
      reject(new Error('Fallo de red en la subida'));
    };
    request.ontimeout = () => {
      reject(new Error('Tiempo agotado en la subida'));
    };
    request.send(body);
  });
}

/**
 * Sube el fichero con un `PUT` a la URL firmada. Usa `XMLHttpRequest` porque `fetch` no informa del
 * progreso de subida; funciona igual en móvil y en web, y el fichero se lee como `Blob` desde su URI.
 */
export function createXhrPhotoUploader(): PhotoUploader {
  return {
    async upload(target, onProgress) {
      const body = await (await fetch(target.uri)).blob();
      await send(target, body, onProgress);
    },
  };
}
