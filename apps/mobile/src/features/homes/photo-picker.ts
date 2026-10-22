import * as ImagePicker from 'expo-image-picker';

/** Una foto elegida de la galería, aún sin subir. */
export interface PickedPhoto {
  uri: string;
  /** Tipo MIME en minúsculas; vacío si no se pudo determinar. */
  contentType: string;
}

/** Puerto de entrada de fotos: la galería del dispositivo (en la app, `expo-image-picker`). */
export interface PhotoPicker {
  /** Abre la galería para elegir hasta `limit` fotos; sin selección (cancelar) devuelve una lista vacía. */
  pick: (limit: number) => Promise<PickedPhoto[]>;
}

const BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
};

const ALIASES: Record<string, string> = { 'image/jpg': 'image/jpeg', 'image/heif': 'image/heic' };

/** El tipo del fichero: el que declara la galería o, si no lo hay, el que indica la extensión. */
export function contentTypeOf(mimeType: string | null | undefined, uri: string): string {
  if (mimeType) {
    const declared = mimeType.toLowerCase();
    return ALIASES[declared] ?? declared;
  }
  const extension = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(uri)?.[1]?.toLowerCase() ?? '';
  return BY_EXTENSION[extension] ?? '';
}

/**
 * La galería real. En iOS pide la representación compatible (JPEG) para que ninguna foto HEIC
 * salga del dispositivo sin convertir, y nunca pide los metadatos EXIF: el servidor los elimina de
 * todos modos.
 */
export function createExpoPhotoPicker(): PhotoPicker {
  return {
    async pick(limit) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: limit,
        exif: false,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return [];
      return result.assets.map((asset) => ({
        uri: asset.uri,
        contentType: contentTypeOf(asset.mimeType, asset.uri),
      }));
    },
  };
}
