import { useTheme } from '@changehouse/ui';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Notice } from '../../ui';
import { stepOfFields, type WizardStep } from './home-form';
import { type Home, HomesApiError } from './homes-api';
import { useSubmitHome } from './use-homes';

const SUBMIT_FIELDS = [
  'usefulM2',
  'builtM2',
  'bedrooms',
  'bathrooms',
  'hasLift',
  'garage',
  'storageRoom',
  'valueMinCents',
  'valueMaxCents',
  'isPrimaryResidence',
  'vppQualificationDate',
  'photos',
] as const;
type SubmitField = (typeof SUBMIT_FIELDS)[number];

const isSubmitField = (field: string): field is SubmitField =>
  (SUBMIT_FIELDS as readonly string[]).includes(field);

type Failure =
  | { kind: 'missing'; fields: readonly SubmitField[]; step: WizardStep }
  | { kind: 'network' | 'conflict' | 'unknown' };

function failureOf(error: unknown): Failure {
  if (!(error instanceof HomesApiError)) return { kind: 'unknown' };
  if (error.kind === 'incomplete') {
    const fields = error.fields.filter(isSubmitField);
    if (fields.length > 0) return { kind: 'missing', fields, step: stepOfFields(fields) };
  }
  if (error.kind === 'network' || error.kind === 'conflict') return { kind: error.kind };
  return { kind: 'unknown' };
}

export interface SubmitActionProps {
  home: Home;
  /** La API aceptó el envío; `home` ya está «En revisión» en la caché. */
  onSubmitted?: (home: Home) => void;
  /** La API dice que faltan datos: lleva al paso donde se rellenan. */
  onComplete: (step: WizardStep) => void;
}

/**
 * «Enviar a revisión» de un borrador. Si faltan datos, la API los nombra y se ofrece ir a completarlos;
 * el botón se bloquea mientras se envía, para que un segundo toque no repita el envío.
 */
export function SubmitAction({ home, onSubmitted, onComplete }: Readonly<SubmitActionProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const submit = useSubmitHome(home.id);
  const submitting = useRef(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const send = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setFailure(null);
    try {
      const submitted = await submit.mutateAsync();
      onSubmitted?.(submitted);
    } catch (error) {
      setFailure(failureOf(error));
    } finally {
      submitting.current = false;
    }
  };

  return (
    <View style={{ gap: theme.space[3] }}>
      {failure?.kind === 'missing' ? (
        <>
          <Notice tone="danger">
            {t('homes.submit.missing', {
              fields: failure.fields.map((field) => t(`homes.fields.${field}`)).join(', '),
            })}
          </Notice>
          <Button
            variant="secondary"
            label={t('homes.submit.complete')}
            onPress={() => {
              onComplete(failure.step);
            }}
          />
        </>
      ) : null}
      {failure && failure.kind !== 'missing' ? (
        <Notice tone="danger">{t(`homes.submit.${failure.kind}`)}</Notice>
      ) : null}
      <Button
        label={t('homes.submit.action')}
        loading={submit.isPending}
        onPress={() => {
          send().catch(() => undefined);
        }}
      />
    </View>
  );
}
