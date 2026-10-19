import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormScreen, Link, Notice, Text, TextField } from '../../ui';
import type { AccessMode } from './access-validation';
import { useAccessForm } from './use-access-form';

/** Registro e inicio de sesión en una única pantalla: Google y Apple primero, el email después. */
export function AccessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<AccessMode>(params.mode === 'signUp' ? 'signUp' : 'signIn');
  const form = useAccessForm(mode);
  const signingUp = mode === 'signUp';
  const busy = form.pending !== null;

  return (
    <FormScreen>
      <Button
        variant="ghost"
        label={t('auth.access.back')}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/welcome');
        }}
      />
      <Text variant="title" accessibilityRole="header">
        {t(signingUp ? 'auth.access.signUpTitle' : 'auth.access.signInTitle')}
      </Text>

      {form.social.map((provider) => (
        <Button
          key={provider.id}
          variant="secondary"
          label={t(`auth.access.${provider.id}`)}
          loading={form.pending === provider.id}
          disabled={busy && form.pending !== provider.id}
          onPress={() => {
            form.signInWith(provider).catch(() => undefined);
          }}
        />
      ))}
      {form.social.length > 0 ? (
        <Text tone="textMuted" style={{ textAlign: 'center' }}>
          {t('auth.access.or')}
        </Text>
      ) : null}

      <TextField
        label={t('auth.access.email')}
        value={form.email}
        onChangeText={form.changeEmail}
        onBlur={form.blurEmail}
        error={form.problems.email ? t(`auth.errors.${form.problems.email}`) : undefined}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label={t('auth.access.password')}
        value={form.password}
        onChangeText={form.changePassword}
        onBlur={form.blurPassword}
        error={form.problems.password ? t(`auth.errors.${form.problems.password}`) : undefined}
        hint={signingUp ? t('auth.access.passwordHint') : undefined}
        secret
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        textContentType={signingUp ? 'newPassword' : 'password'}
        returnKeyType="go"
        onSubmitEditing={() => {
          form.submit().catch(() => undefined);
        }}
      />

      {form.message ? <Notice tone="danger">{t(`auth.errors.${form.message}`)}</Notice> : null}

      <Button
        label={t(signingUp ? 'auth.access.signUpSubmit' : 'auth.access.signInSubmit')}
        loading={form.pending === 'email'}
        disabled={busy && form.pending !== 'email'}
        onPress={() => {
          form.submit().catch(() => undefined);
        }}
      />
      {signingUp ? null : (
        <Link
          label={t('auth.access.forgotPassword')}
          onPress={() => {
            router.push('/forgot-password');
          }}
        />
      )}
      <Button
        variant="ghost"
        label={t(signingUp ? 'auth.access.switchToSignIn' : 'auth.access.switchToSignUp')}
        onPress={() => {
          setMode(signingUp ? 'signIn' : 'signUp');
        }}
      />
    </FormScreen>
  );
}
