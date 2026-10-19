import { PRIVACY_VERSION, TERMS_VERSION, validateMeInput } from '@changehouse/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, FormScreen, Link, Notice, Text, TextField } from '../../ui';
import { useAuth } from '../auth/AuthProvider';
import { useSignOut } from '../auth/use-sign-out';
import { useServices } from '../session/services';
import { AccountApiError } from './account-api';
import { useUpsertMe } from './use-me';

type NameProblem = 'displayNameRequired' | 'displayNameTooLong';
type SubmitFailure = 'legalOutdated' | 'network' | 'unknown';

interface Problems {
  displayName?: NameProblem;
  terms?: true;
  privacy?: true;
}

function failureOf(error: unknown): SubmitFailure {
  if (!(error instanceof AccountApiError)) return 'unknown';
  if (error.kind === 'legal-acceptance') return 'legalOutdated';
  return error.kind === 'network' ? 'network' : 'unknown';
}

function nameProblemOf(displayName: string): NameProblem | undefined {
  const result = validateMeInput({ displayName });
  if (result.success) return undefined;
  const error = result.errors.find((candidate) => candidate.field === 'displayName');
  if (!error) return undefined;
  return error.code === 'too_long' ? 'displayNameTooLong' : 'displayNameRequired';
}

/**
 * Alta en ChangeHouse en el primer acceso: nombre visible y aceptación de las versiones vigentes de
 * los términos y de la privacidad. Si falta algo se dice qué y no se llama a la API.
 */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const { legalUrls } = useServices();
  const { user } = useAuth();
  const signOut = useSignOut();
  const upsert = useUpsertMe();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [problems, setProblems] = useState<Problems>({});
  const [failure, setFailure] = useState<SubmitFailure | null>(null);

  const submit = async () => {
    if (upsert.isPending) return;
    const found: Problems = {};
    const nameProblem = nameProblemOf(displayName);
    if (nameProblem) found.displayName = nameProblem;
    if (!terms) found.terms = true;
    if (!privacy) found.privacy = true;
    setProblems(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    try {
      await upsert.mutateAsync({
        displayName: displayName.trim(),
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION,
      });
    } catch (error) {
      setFailure(failureOf(error));
    }
  };

  return (
    <FormScreen>
      <Text variant="title" accessibilityRole="header">
        {t('account.onboarding.title')}
      </Text>
      <Text tone="textMuted">{t('account.onboarding.description')}</Text>

      <TextField
        label={t('account.onboarding.displayName')}
        value={displayName}
        onChangeText={(value) => {
          setDisplayName(value);
          setProblems((current) => ({ ...current, displayName: undefined }));
        }}
        error={
          problems.displayName ? t(`account.onboarding.errors.${problems.displayName}`) : undefined
        }
        hint={t('account.onboarding.displayNameHint')}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />

      <Checkbox
        label={t('account.onboarding.terms')}
        checked={terms}
        onChange={(checked) => {
          setTerms(checked);
          setProblems((current) => ({ ...current, terms: undefined }));
        }}
        error={problems.terms ? t('account.onboarding.errors.termsRequired') : undefined}
      />
      <Link
        label={t('account.onboarding.readTerms', { version: TERMS_VERSION })}
        href={legalUrls.terms}
      />
      <Checkbox
        label={t('account.onboarding.privacy')}
        checked={privacy}
        onChange={(checked) => {
          setPrivacy(checked);
          setProblems((current) => ({ ...current, privacy: undefined }));
        }}
        error={problems.privacy ? t('account.onboarding.errors.privacyRequired') : undefined}
      />
      <Link
        label={t('account.onboarding.readPrivacy', { version: PRIVACY_VERSION })}
        href={legalUrls.privacy}
      />

      {failure ? <Notice tone="danger">{t(`account.onboarding.errors.${failure}`)}</Notice> : null}

      <Button
        label={t('account.onboarding.submit')}
        loading={upsert.isPending}
        onPress={() => {
          submit().catch(() => undefined);
        }}
      />
      <Button
        variant="ghost"
        label={t('auth.signOut')}
        onPress={() => {
          signOut().catch(() => undefined);
        }}
      />
    </FormScreen>
  );
}
