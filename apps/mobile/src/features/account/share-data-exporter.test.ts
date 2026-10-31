import { Share } from 'react-native';

import { createShareDataExporter } from './share-data-exporter';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('createShareDataExporter', () => {
  it('abre la hoja de compartir del sistema con el JSON y el nombre del fichero como título', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });

    await createShareDataExporter().deliver({ filename: 'datos.json', content: '{"a":1}' });

    expect(share).toHaveBeenCalledWith({ message: '{"a":1}', title: 'datos.json' });
  });

  it('cancelar la hoja no es un error', async () => {
    jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });

    await expect(
      createShareDataExporter().deliver({ filename: 'datos.json', content: '{}' }),
    ).resolves.toBeUndefined();
  });

  it('si el sistema no puede compartir, el fallo se propaga', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('sin hoja'));

    await expect(
      createShareDataExporter().deliver({ filename: 'datos.json', content: '{}' }),
    ).rejects.toThrow('sin hoja');
  });
});
