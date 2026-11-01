import { createXhrPhotoUploader } from './xhr-photo-uploader';

class FakeXhr {
  static instances: FakeXhr[] = [];
  readonly headers: Record<string, string> = {};
  readonly upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  status = 0;
  method = '';
  url = '';
  body: unknown = null;

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
  }
}

const target = {
  url: 'https://storage.test/upload/1',
  contentType: 'image/jpeg',
  uri: 'file:///a.jpg',
};
const blob = { size: 3 } as unknown as Blob;
const sent = async () => {
  await Promise.resolve();
  await Promise.resolve();
  return FakeXhr.instances[0] as FakeXhr;
};

beforeEach(() => {
  FakeXhr.instances = [];
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  globalThis.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) });
});

describe('createXhrPhotoUploader', () => {
  it('hace PUT del fichero con su tipo de contenido y avisa del progreso', async () => {
    const onProgress = jest.fn();
    const promise = createXhrPhotoUploader().upload(target, onProgress);
    const xhr = await sent();

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 } as ProgressEvent);
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 1, total: 0 } as ProgressEvent);
    xhr.status = 200;
    xhr.onload?.();
    await promise;

    expect(xhr).toMatchObject({ method: 'PUT', url: target.url, body: blob });
    // La firma de la URL incluye el rango de tamaño: sin esta cabecera Cloud Storage rechaza la subida
    expect(xhr.headers).toEqual({
      'Content-Type': 'image/jpeg',
      'x-goog-content-length-range': '0,26214400',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(target.uri);
    expect(onProgress.mock.calls).toEqual([[0.25], [1]]);
  });

  it.each([['onerror'], ['ontimeout']] as const)('%s rechaza la subida', async (event) => {
    const promise = createXhrPhotoUploader().upload(target, jest.fn());
    const xhr = await sent();

    xhr[event]?.();

    await expect(promise).rejects.toThrow('subida');
  });

  it('un estado distinto de 2xx rechaza la subida', async () => {
    const promise = createXhrPhotoUploader().upload(target, jest.fn());
    const xhr = await sent();

    xhr.status = 403;
    xhr.onload?.();

    await expect(promise).rejects.toThrow('403');
  });

  it('si no se puede leer el fichero local rechaza sin llegar a enviar', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('no existe'));

    await expect(createXhrPhotoUploader().upload(target, jest.fn())).rejects.toThrow('no existe');
    expect(FakeXhr.instances).toHaveLength(0);
  });
});
