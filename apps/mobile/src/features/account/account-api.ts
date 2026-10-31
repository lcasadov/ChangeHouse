import type { MeInput } from '@changehouse/shared';

import type { components } from '../../api/schema';

/** El dispositivo que recibe los avisos (cuerpo de `registerDevice`). */
export interface DeviceRegistration {
  fcmToken: string;
  platform: 'android' | 'ios' | 'web';
}

/** Perfil del usuario (`Me` del contrato). */
export type Me = components['schemas']['Me'];

export type AccountApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** Faltan los textos legales vigentes (422 `LEGAL_ACCEPTANCE_REQUIRED`). */
  | 'legal-acceptance'
  /** El servidor rechaza los datos (400). */
  | 'invalid'
  | 'server';

export class AccountApiError extends Error {
  constructor(readonly kind: AccountApiErrorKind) {
    super(kind);
    this.name = 'AccountApiError';
  }
}

/** Puerto de salida de la cuenta; el adaptador HTTP vive en `http-account-api.ts`. */
export interface AccountApi {
  /** El perfil, o `null` si la persona se ha autenticado pero aún no se ha dado de alta (404). */
  getMe: () => Promise<Me | null>;
  upsertMe: (input: MeInput) => Promise<Me>;
  /** Registra o refresca el token FCM de este dispositivo (`registerDevice`). */
  registerDevice: (input: DeviceRegistration) => Promise<void>;
  /** Elimina la cuenta (`deleteMe`, 204): anonimización y baja en el proveedor de identidad. */
  deleteMe: () => Promise<void>;
  /** Los datos personales del usuario en JSON (`exportMyData`). */
  exportMyData: () => Promise<Record<string, unknown>>;
}
