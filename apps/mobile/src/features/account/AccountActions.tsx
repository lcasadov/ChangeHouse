import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Dialog, Notice, Text, TextField } from '../../ui';
import { useDeleteAccount, useExportData } from './use-account-actions';

/** «Tus datos»: exportar en JSON (portabilidad) y eliminar la cuenta en dos pasos. */
export function AccountActions() {
  const { t } = useTranslation();
  const exporter = useExportData();
  const deletion = useDeleteAccount();
  const [step, setStep] = useState<'closed' | 'explain' | 'confirm'>('closed');
  const [typed, setTyped] = useState('');

  const close = () => {
    setStep('closed');
    setTyped('');
    deletion.reset();
  };
  const confirmWord = t('profile.deleteAccount.confirmWord');
  const deleteFailure = deletion.state.failure === 'network' ? 'network' : 'unknown';
  const deleteFailed = deletion.state.failure !== null;

  return (
    <>
      <Text variant="label" accessibilityRole="header">
        {t('profile.export.action')}
      </Text>
      <Text tone="textMuted">{t('profile.export.description')}</Text>
      {exporter.state.failure ? (
        <Notice tone="danger">{t(`profile.export.errors.${exporter.state.failure}`)}</Notice>
      ) : null}
      {exporter.state.failure === null && exporter.state.done ? (
        <Notice tone="success">{t('profile.export.done')}</Notice>
      ) : null}
      <Button
        variant="secondary"
        label={t('profile.export.action')}
        loading={exporter.state.busy}
        onPress={() => {
          exporter.start().catch(() => undefined);
        }}
      />

      <Button
        variant="danger"
        label={t('profile.deleteAccount.action')}
        onPress={() => {
          setStep('explain');
        }}
      />
      <Dialog
        visible={step === 'explain'}
        title={t('profile.deleteAccount.explainTitle')}
        description={t('profile.deleteAccount.explainDescription')}
        confirmLabel={t('profile.deleteAccount.continue')}
        cancelLabel={t('profile.deleteAccount.cancel')}
        onConfirm={() => {
          setStep('confirm');
        }}
        onCancel={close}
      />
      <Dialog
        visible={step === 'confirm'}
        title={t('profile.deleteAccount.confirmTitle')}
        description={t('profile.deleteAccount.confirmDescription')}
        confirmLabel={t('profile.deleteAccount.confirm')}
        cancelLabel={t('profile.deleteAccount.cancel')}
        confirmVariant="danger"
        confirmDisabled={typed !== confirmWord || deletion.state.busy}
        onConfirm={() => {
          deletion.start().catch(() => undefined);
        }}
        onCancel={close}
      >
        <TextField
          label={t('profile.deleteAccount.confirmField')}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
        />
        {deleteFailed ? (
          <Notice tone="danger">{t(`profile.deleteAccount.errors.${deleteFailure}`)}</Notice>
        ) : null}
      </Dialog>
    </>
  );
}
