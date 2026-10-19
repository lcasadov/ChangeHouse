import * as ImagePicker from 'expo-image-picker';

import { contentTypeOf, createExpoPhotoPicker } from './photo-picker';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

const launch = jest.mocked(ImagePicker.launchImageLibraryAsync);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('contentTypeOf', () => {
  it.each([
    ['image/jpeg', 'file:///a', 'image/jpeg'],
    ['image/jpg', 'file:///a', 'image/jpeg'],
    ['IMAGE/PNG', 'file:///a', 'image/png'],
    ['image/webp', 'file:///a', 'image/webp'],
    ['image/heic', 'file:///a', 'image/heic'],
    ['image/heif', 'file:///a', 'image/heic'],
    [undefined, 'file:///galeria/IMG_1.JPG', 'image/jpeg'],
    [undefined, 'file:///galeria/IMG_2.heic?x=1', 'image/heic'],
    [null, 'file:///galeria/IMG_3.png', 'image/png'],
    ['image/gif', 'file:///a.gif', 'image/gif'],
    [undefined, 'file:///galeria/sin-extension', ''],
  ])('%s sobre %s es %s', (mimeType, uri, expected) => {
    expect(contentTypeOf(mimeType, uri)).toBe(expected);
  });
});

describe('createExpoPhotoPicker', () => {
  it('abre la galería con selección múltiple limitada, en formato compatible y sin metadatos', async () => {
    launch.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///a.jpg', mimeType: 'image/jpeg', width: 1, height: 1 },
        { uri: 'file:///b.heic', width: 1, height: 1 },
      ],
    });

    const photos = await createExpoPhotoPicker().pick(5);

    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        exif: false,
        preferredAssetRepresentationMode: 'compatible',
      }),
    );
    expect(photos).toEqual([
      { uri: 'file:///a.jpg', contentType: 'image/jpeg' },
      { uri: 'file:///b.heic', contentType: 'image/heic' },
    ]);
  });

  it('si se cancela la selección no devuelve fotos', async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });

    expect(await createExpoPhotoPicker().pick(3)).toEqual([]);
  });
});
