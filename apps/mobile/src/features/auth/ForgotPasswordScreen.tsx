import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Notice, Text, TextField } from '../../ui';
import { useServices } from '../session/services';
import { type EmailProblem, validateEmail } from './access-validation';
import { AuthError } from './auth-service';
import { AuthLayout } from './AuthLayout';

/**
 * Recuperación de la contraseña. La confirmación es siempre la misma, exista o no la cuenta: la
 * pantalla nunca revela qué emails están registrados.
 */
export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { auth } = useServices();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<EmailProblem | null>(null);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<'network' | 'unknown' | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (pending) return;
    const found = validateEmail(email);
    setProblem(found);
    setFailed(null);
    if (found) return;

    setPending(true);
    try {
      await auth.sendPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      setSent(false);
      setFailed(error instanceof AuthError && error.code === 'network' ? 'network' : 'unknown');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <Text variant="title" accessibilityRole="header">
        {t('auth.forgot.title')}
      </Text>
      <Text tone="textMuted">{t('auth.forgot.description')}</Text>
      <TextField
        label={t('auth.access.email')}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setProblem(null);
        }}
        error={problem ? t(`auth.errors.${problem}`) : undefined}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => {
          submit().catch(() => undefined);
        }}
      />
      {sent ? <Notice tone="success">{t('auth.forgot.sent')}</Notice> : null}
      {failed ? <Notice tone="danger">{t(`auth.errors.${failed}`)}</Notice> : null}
      <Button
        label={t('auth.forgot.submit')}
        loading={pending}
        onPress={() => {
          submit().catch(() => undefined);
        }}
      />
      <Button
        variant="ghost"
        label={t('auth.forgot.backToSignIn')}
        onPress={() => {
          router.back();
        }}
      />
    </AuthLayout>
  );
}
