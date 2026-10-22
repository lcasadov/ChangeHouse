import { me } from '../../test-support/fake-backend';
import { errorKeyOf, formValuesOf, profileResolver } from './profile-form';

type ResolverArgs = Parameters<typeof profileResolver>;
const options = {} as ResolverArgs[2];
const resolve = (values: ResolverArgs[0]) => profileResolver(values, undefined, options);

const valid = {
  displayName: 'Ana',
  municipality: '',
  phone: '',
  meetsVppRequirements: false,
  isOver65: false,
};

describe('formValuesOf', () => {
  it('convierte lo ausente en cadenas vacías para los campos de texto', () => {
    expect(formValuesOf(me({ municipality: null, phone: null }))).toEqual(valid);
  });

  it('conserva los datos guardados', () => {
    expect(
      formValuesOf(
        me({
          displayName: 'Ana García',
          municipality: 'Getafe',
          phone: '+34612345678',
          meetsVppRequirements: true,
          isOver65: true,
        }),
      ),
    ).toEqual({
      displayName: 'Ana García',
      municipality: 'Getafe',
      phone: '+34612345678',
      meetsVppRequirements: true,
      isOver65: true,
    });
  });
});

describe('profileResolver', () => {
  it('devuelve los datos validados con el teléfono vacío como no indicado', async () => {
    expect(await resolve(valid)).toEqual({
      values: { ...valid, phone: undefined },
      errors: {},
    });
  });

  it('devuelve un error por campo con el código del esquema como tipo', async () => {
    const result = await resolve({ ...valid, displayName: ' ', phone: '612' });

    expect(result).toEqual({
      values: {},
      errors: { displayName: { type: 'required' }, phone: { type: 'invalid' } },
    });
  });
});

describe('errorKeyOf', () => {
  it.each([
    ['displayName', 'required', 'displayNameRequired'],
    ['displayName', 'too_long', 'displayNameTooLong'],
    ['municipality', 'too_long', 'municipalityTooLong'],
    ['phone', 'invalid', 'phoneInvalid'],
    ['isOver65', 'invalid', null],
  ] as const)('%s con %s → %s', (field, type, key) => {
    expect(errorKeyOf(field, type)).toBe(key);
  });
});
