import i18next from 'i18next';

import {
  DEFAULT_LANGUAGE,
  initI18n,
  resolveLanguage,
  resources,
  SUPPORTED_LANGUAGES,
} from './index';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('resolveLanguage', () => {
  it('usa la etiqueta exacta si está soportada', () => {
    expect(resolveLanguage([{ languageTag: 'es-ES', languageCode: 'es' }])).toBe('es-ES');
  });

  it('empareja por código de idioma (es-MX → es-ES)', () => {
    expect(resolveLanguage([{ languageTag: 'es-MX', languageCode: 'es' }])).toBe('es-ES');
  });

  it('recorre las preferencias hasta encontrar una soportada', () => {
    expect(
      resolveLanguage([
        { languageTag: 'fr-FR', languageCode: 'fr' },
        { languageTag: 'es-AR', languageCode: 'es' },
      ]),
    ).toBe('es-ES');
  });

  it('cae al idioma predeterminado si no hay coincidencia o código', () => {
    expect(resolveLanguage([{ languageTag: 'ja-JP', languageCode: 'ja' }])).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage([{ languageTag: 'xx', languageCode: null }])).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage([])).toBe(DEFAULT_LANGUAGE);
  });
});

describe('recursos de traducción', () => {
  it('todos los idiomas soportados tienen exactamente las mismas claves y ninguna vacía', () => {
    const [reference, ...others] = SUPPORTED_LANGUAGES.map(
      (language) => resources[language].translation,
    );
    const referenceKeys = flattenKeys(reference).sort();

    expect(referenceKeys.length).toBeGreaterThan(0);
    for (const other of others) expect(flattenKeys(other).sort()).toEqual(referenceKeys);
    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of referenceKeys) {
        expect(i18next.getFixedT(language)(key as never)).not.toBe('');
      }
    }
  });
});

describe('initI18n', () => {
  it('queda inicializado en es-ES con fallback es-ES y es idempotente', () => {
    const instance = initI18n([{ languageTag: 'es-ES', languageCode: 'es' }]);

    expect(instance.isInitialized).toBe(true);
    expect(instance.language).toBe('es-ES');
    expect(instance.options.fallbackLng).toEqual(['es-ES']);
    expect(initI18n()).toBe(instance);
    expect(instance.t('tabs.explore')).toBe('Explorar');
  });
});
