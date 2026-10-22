import { MIN_PASSWORD_LENGTH, validateEmail, validatePassword } from './access-validation';

describe('validateEmail', () => {
  it.each(['ana@example.com', '  ana@example.com  ', 'a.b+c@sub.example.es'])(
    'acepta %j',
    (email) => {
      expect(validateEmail(email)).toBeNull();
    },
  );

  it.each(['', '   '])('pide el email si está vacío (%j)', (email) => {
    expect(validateEmail(email)).toBe('emailRequired');
  });

  it.each(['ana', 'ana@', '@example.com', 'ana@example', 'ana @example.com', 'a@b@c.com'])(
    'rechaza %j por su forma',
    (email) => {
      expect(validateEmail(email)).toBe('emailInvalid');
    },
  );
});

describe('validatePassword', () => {
  it('al registrarse exige al menos 8 caracteres', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(validatePassword('1234567', 'signUp')).toBe('passwordTooShort');
    expect(validatePassword('12345678', 'signUp')).toBeNull();
  });

  it('al entrar no exige longitud: una cuenta antigua puede tener otra', () => {
    expect(validatePassword('corta', 'signIn')).toBeNull();
  });

  it('en ambos casos exige que haya contraseña', () => {
    expect(validatePassword('', 'signIn')).toBe('passwordRequired');
    expect(validatePassword('', 'signUp')).toBe('passwordRequired');
  });
});
