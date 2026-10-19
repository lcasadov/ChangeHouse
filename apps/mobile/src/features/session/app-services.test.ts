import { createApiClient } from '../../api/client';
import { createFirebaseAuth } from '../auth/create-firebase-auth';
import { createFirebaseAuthService } from '../auth/firebase-auth-service';
import { createAppServices, resetAppServicesForTests } from './app-services';

jest.mock('../auth/create-firebase-auth', () => ({ createFirebaseAuth: jest.fn(() => ({})) }));
jest.mock('../auth/firebase-auth-service', () => ({
  createFirebaseAuthService: jest.fn(() => ({ getIdToken: () => Promise.resolve('token') })),
}));
jest.mock('../../api/client', () => ({
  createApiClient: jest.fn(() => ({ GET: jest.fn(), PUT: jest.fn() })),
}));

const env = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'clave',
  EXPO_PUBLIC_API_URL: 'https://api.changehouse.test',
  EXPO_PUBLIC_LEGAL_BASE_URL: 'https://changehouse.test',
};

beforeEach(() => {
  jest.clearAllMocks();
  resetAppServicesForTests();
});

describe('createAppServices', () => {
  it('compone Firebase, el cliente de la API con el token y los textos legales', async () => {
    const social = [{ id: 'google' as const, start: () => Promise.resolve(null) }];

    const services = createAppServices(env, social);

    expect(services.social).toBe(social);
    expect(services.legalUrls).toEqual({
      terms: 'https://changehouse.test/terminos',
      privacy: 'https://changehouse.test/privacidad',
    });
    expect(createFirebaseAuth).toHaveBeenCalledTimes(1);
    const options = jest.mocked(createApiClient).mock.calls[0]?.[0];
    expect(options?.baseUrl).toBe('https://api.changehouse.test');
    await expect(options?.getToken()).resolves.toBe('token');
  });

  it('usa las direcciones locales por defecto', () => {
    createAppServices({ EXPO_PUBLIC_FIREBASE_API_KEY: 'clave' }, []);

    expect(jest.mocked(createApiClient).mock.calls[0]?.[0].baseUrl).toBe(
      'http://localhost:8080/v1',
    );
  });

  it('crea la autenticación una sola vez aunque cambien los proveedores externos', () => {
    createAppServices(env, []);
    createAppServices(env, []);

    expect(createFirebaseAuthService).toHaveBeenCalledTimes(1);
  });

  it('quita la barra final de las direcciones base', () => {
    const services = createAppServices(
      {
        ...env,
        EXPO_PUBLIC_API_URL: 'https://api.changehouse.test/',
        EXPO_PUBLIC_LEGAL_BASE_URL: 'https://changehouse.test/',
      },
      [],
    );

    expect(jest.mocked(createApiClient).mock.calls[0]?.[0].baseUrl).toBe(
      'https://api.changehouse.test',
    );
    expect(services.legalUrls.terms).toBe('https://changehouse.test/terminos');
  });

  it('compone el adaptador de viviendas y, sin clave de Google, las sugerencias de prueba', async () => {
    const services = createAppServices(env, []);

    expect(typeof services.homesApi.listMine).toBe('function');
    expect(await services.addressSuggestions.suggest('malasaña')).toMatchObject([
      { placeId: 'fixture-malasana' },
    ]);
  });

  it('con EXPO_PUBLIC_GOOGLE_PLACES_KEY el autocompletado va contra Google Places', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}));
    const services = createAppServices({ ...env, EXPO_PUBLIC_GOOGLE_PLACES_KEY: 'clave' }, []);

    await services.addressSuggestions.suggest('calle');

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(init?.headers).toMatchObject({ 'X-Goog-Api-Key': 'clave' });
    fetchSpy.mockRestore();
  });
});
