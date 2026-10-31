import { describe, expect, it } from 'vitest';

import { DEVICE_PLATFORMS, MAX_FCM_TOKEN_LENGTH, validateDeviceInput } from './device.js';

describe('validateDeviceInput', () => {
  it('las plataformas y el límite del token son los del contrato de registerDevice', () => {
    expect(DEVICE_PLATFORMS).toEqual(['android', 'ios', 'web']);
    expect(MAX_FCM_TOKEN_LENGTH).toBe(4096);
  });

  it('acepta un token y una plataforma', () => {
    expect(validateDeviceInput({ fcmToken: 'tok-1', platform: 'android' })).toEqual({
      success: true,
      data: { fcmToken: 'tok-1', platform: 'android' },
    });
  });

  it('acepta un token de exactamente 4.096 caracteres', () => {
    const fcmToken = 'a'.repeat(MAX_FCM_TOKEN_LENGTH);

    expect(validateDeviceInput({ fcmToken, platform: 'ios' })).toMatchObject({ success: true });
  });

  it('señala el token vacío, el demasiado largo, la plataforma desconocida y los campos que sobran', () => {
    expect(validateDeviceInput({ fcmToken: '', platform: 'web' })).toEqual({
      success: false,
      errors: [{ field: 'fcmToken', code: 'required' }],
    });
    expect(
      validateDeviceInput({ fcmToken: 'a'.repeat(MAX_FCM_TOKEN_LENGTH + 1), platform: 'web' }),
    ).toEqual({ success: false, errors: [{ field: 'fcmToken', code: 'too_long' }] });
    expect(validateDeviceInput({ fcmToken: 't', platform: 'symbian' })).toEqual({
      success: false,
      errors: [{ field: 'platform', code: 'invalid' }],
    });
    expect(validateDeviceInput({ fcmToken: 't', platform: 'web', extra: 1 })).toEqual({
      success: false,
      errors: [{ field: 'extra', code: 'invalid' }],
    });
    expect(validateDeviceInput({ platform: 'web' })).toMatchObject({ success: false });
  });
});
