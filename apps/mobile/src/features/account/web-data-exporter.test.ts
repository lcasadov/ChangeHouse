import { createWebDataExporter } from './web-data-exporter';

interface FakeLink {
  href: string;
  download: string;
  click: jest.Mock;
  remove: jest.Mock;
}

describe('createWebDataExporter', () => {
  const original = {
    document: globalThis.document,
    create: Reflect.get(URL, 'createObjectURL') as unknown,
    revoke: Reflect.get(URL, 'revokeObjectURL') as unknown,
  };

  afterEach(() => {
    Object.assign(globalThis, { document: original.document });
    Object.assign(URL, { createObjectURL: original.create, revokeObjectURL: original.revoke });
  });

  function setup(clickFails = false) {
    const link: FakeLink = {
      href: '',
      download: '',
      click: jest.fn(() => {
        if (clickFails) throw new Error('bloqueado');
      }),
      remove: jest.fn(),
    };
    const appendChild = jest.fn();
    Object.assign(globalThis, {
      document: { createElement: () => link, body: { appendChild } },
    });
    const createObjectURL = jest.fn<string, [Blob]>(() => 'blob:datos');
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    return { link, appendChild, createObjectURL, revokeObjectURL };
  }

  it('descarga un fichero JSON con el nombre indicado y libera la URL temporal', async () => {
    const { link, appendChild, createObjectURL, revokeObjectURL } = setup();

    await createWebDataExporter().deliver({ filename: 'datos.json', content: '{"a":1}' });

    expect(link.href).toBe('blob:datos');
    expect(link.download).toBe('datos.json');
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe('application/json');
    expect(blob?.size).toBe(7);
    expect(link.remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:datos');
  });

  it('descarga con el tipo indicado cuando el fichero no es JSON (CSV)', async () => {
    const { createObjectURL } = setup();

    await createWebDataExporter().deliver({
      filename: 'lista.csv',
      content: 'a,b',
      mimeType: 'text/csv',
    });

    expect(createObjectURL.mock.calls[0]?.[0].type).toBe('text/csv');
  });

  it('si el navegador bloquea la descarga, limpia y rechaza con el fallo', async () => {
    const { link, revokeObjectURL } = setup(true);

    await expect(
      createWebDataExporter().deliver({ filename: 'datos.json', content: '{}' }),
    ).rejects.toThrow('bloqueado');
    expect(link.remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:datos');
  });
});
