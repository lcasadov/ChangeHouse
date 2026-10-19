import { CONSENT_TYPES as SHARED_CONSENT_TYPES } from '@changehouse/shared';
import { describe, expect, it } from 'vitest';

import { CONSENT_TYPES, missingLegalAcceptance } from './consent.js';

const current = { terms: '2026-10', privacy: '2026-10' };

describe('consentimientos', () => {
  it('los tipos del dominio coinciden con los del contrato compartido', () => {
    expect([...CONSENT_TYPES]).toEqual([...SHARED_CONSENT_TYPES]);
  });

  it.each([
    [{ terms: '2026-10', privacy: '2026-10' }, []],
    [{}, ['acceptedTermsVersion', 'acceptedPrivacyVersion']],
    [{ terms: '2026-10' }, ['acceptedPrivacyVersion']],
    [{ terms: '2026-04', privacy: '2026-10' }, ['acceptedTermsVersion']],
    [{ terms: '2026-10', privacy: '2027-01' }, ['acceptedPrivacyVersion']],
  ])('missingLegalAcceptance(%j) señala %j', (accepted, expected) => {
    expect(missingLegalAcceptance(accepted, current)).toEqual(expected);
  });
});
