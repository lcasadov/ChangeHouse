import { me } from '../../test-support/fake-backend';
import { deriveSessionState } from './session-state';

describe('deriveSessionState', () => {
  it('mientras se restaura la sesión está cargando', () => {
    expect(deriveSessionState('loading', { status: 'pending', data: undefined })).toBe('loading');
  });

  it('sin sesión no se mira la cuenta: se va a la bienvenida', () => {
    expect(deriveSessionState('signedOut', { status: 'pending', data: undefined })).toBe(
      'signedOut',
    );
    expect(deriveSessionState('signedOut', { status: 'error', data: undefined })).toBe('signedOut');
  });

  it('con sesión y la cuenta aún por consultar está cargando', () => {
    expect(deriveSessionState('signedIn', { status: 'pending', data: undefined })).toBe('loading');
  });

  it('con sesión y sin poder consultar la cuenta es un error recuperable', () => {
    expect(deriveSessionState('signedIn', { status: 'error', data: undefined })).toBe('error');
  });

  it('con sesión y sin alta (null) toca el alta; con alta, las pestañas', () => {
    expect(deriveSessionState('signedIn', { status: 'success', data: null })).toBe('unregistered');
    expect(deriveSessionState('signedIn', { status: 'success', data: me() })).toBe('ready');
  });

  it('Scenario: Usuario suspendido usa la app - con la cuenta suspendida toca la pantalla de cuenta suspendida', () => {
    expect(
      deriveSessionState('signedIn', { status: 'success', data: me({ suspended: true }) }),
    ).toBe('suspended');
  });
});
