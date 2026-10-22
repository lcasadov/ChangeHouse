export {
  CONSENT_TYPES,
  type ConsentInput,
  consentInputSchema,
  type ConsentType,
  type MeInput,
  meInputSchema,
  type ProfileFormData,
  profileFormSchema,
  type ProfileFormValues,
  type ProfileInput,
  profileSchema,
  validateConsentInput,
  validateMeInput,
  validateProfileForm,
} from './account.js';
export { assertNever } from './assert-never.js';
export { HOME_TYPES, type HomeType } from './home-type.js';
export { PRIVACY_VERSION, TERMS_VERSION } from './legal.js';
export type { FieldError, FieldErrorCode, Validation } from './validation.js';
export {
  validateWaitlistInput,
  type WaitlistInput,
  waitlistInputSchema,
  type WaitlistValidation,
} from './waitlist.js';
