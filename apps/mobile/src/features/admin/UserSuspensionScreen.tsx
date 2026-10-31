import { useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button, Dialog, Notice, Screen, Text, TextField } from '../../ui';
import { AdminApiError, type AdminUser } from './admin-api';
import { REASON_MAX_LENGTH, validateReason } from './reject-reason';
import { useSetUserSuspension } from './use-user-suspension';

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fallos del envío que tienen un mensaje propio; el resto se explica de forma genérica. */
const KNOWN_FAILURES = [
  'not-found',
  'cannot-suspend-self',
  'cannot-suspend-admin',
  'network',
] as const;
type Failure = (typeof KNOWN_FAILURES)[number] | 'unknown';

function failureOf(error: unknown): Failure {
  const kind = error instanceof AdminApiError ? error.kind : null;
  return KNOWN_FAILURES.find((known) => known === kind) ?? 'unknown';
}

interface FormErrors {
  userId?: 'userIdInvalid';
  reason?: 'required' | 'tooLong';
}

interface Outcome {
  user: AdminUser;
}

/**
 * Suspender o reactivar a un usuario por su identificador (RF-90), con motivo obligatorio. Es la
 * entrada mínima hasta que llegue el listado de usuarios con `add-admin-panel`. Suspender se confirma
 * antes: cierra sus matches abiertos y oculta sus viviendas; reactivar no los reabre.
 */
export function UserSuspensionScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const mutation = useSetUserSuspension();
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  /** El motivo ya recortado si el formulario es válido; si no, señala cada campo. */
  const validated = (): { id: string; text: string } | null => {
    const id = userId.trim();
    const checked = validateReason(reason);
    const next: FormErrors = {
      ...(USER_ID.test(id) ? {} : { userId: 'userIdInvalid' }),
      ...(checked.ok ? {} : { reason: checked.error }),
    };
    setErrors(next);
    return checked.ok && next.userId === undefined ? { id, text: checked.reason } : null;
  };

  const send = (suspended: boolean, id: string, text: string) => {
    setOutcome(null);
    setFailure(null);
    mutation.mutate(
      { userId: id, suspended, reason: text },
      {
        onSuccess: (user) => {
          setOutcome({ user });
        },
        onError: (error) => {
          setFailure(failureOf(error));
        },
      },
    );
  };

  const suspend = () => {
    const form = validated();
    if (form) setConfirming(form.text);
  };

  const reactivate = () => {
    const form = validated();
    if (form) send(false, form.id, form.text);
  };

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.space[4], paddingVertical: theme.space[5] }}
      >
        <View style={{ gap: theme.space[1] }}>
          <Text variant="title" accessibilityRole="header">
            {t('admin.users.title')}
          </Text>
          <Text tone="textMuted">{t('admin.users.intro')}</Text>
        </View>
        <TextField
          label={t('admin.users.userIdLabel')}
          hint={t('admin.users.userIdHint')}
          value={userId}
          onChangeText={(text) => {
            setUserId(text);
            setErrors((current) => ({ ...current, userId: undefined }));
          }}
          autoCapitalize="none"
          error={errors.userId ? t(`admin.users.errors.${errors.userId}`) : undefined}
        />
        <TextField
          label={t('admin.users.reasonLabel')}
          hint={t('admin.users.reasonHint')}
          value={reason}
          onChangeText={(text) => {
            setReason(text);
            setErrors((current) => ({ ...current, reason: undefined }));
          }}
          autoCapitalize="sentences"
          maxLength={REASON_MAX_LENGTH}
          multiline
          error={errors.reason ? t(`admin.users.errors.${errors.reason}`) : undefined}
        />
        {outcome ? (
          <Notice tone="success">
            {t(
              outcome.user.suspended
                ? 'admin.users.outcome.suspended'
                : 'admin.users.outcome.reactivated',
              { name: outcome.user.displayName, email: outcome.user.email },
            )}
          </Notice>
        ) : null}
        {failure ? <Notice tone="danger">{t(`admin.users.errors.${failure}`)}</Notice> : null}
        <Button
          variant="danger"
          label={t('admin.users.suspend')}
          loading={mutation.isPending}
          onPress={suspend}
        />
        <Button
          variant="secondary"
          label={t('admin.users.reactivate')}
          disabled={mutation.isPending}
          onPress={reactivate}
        />
      </ScrollView>
      <Dialog
        visible={confirming !== null}
        title={t('admin.users.confirm.title')}
        description={t('admin.users.confirm.description')}
        confirmLabel={t('admin.users.confirm.confirm')}
        cancelLabel={t('admin.users.confirm.cancel')}
        onConfirm={() => {
          const text = confirming;
          setConfirming(null);
          if (text !== null) send(true, userId.trim(), text);
        }}
        onCancel={() => {
          setConfirming(null);
        }}
      />
    </Screen>
  );
}
