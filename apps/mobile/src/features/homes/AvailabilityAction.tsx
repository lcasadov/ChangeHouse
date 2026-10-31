import { useTheme } from '@changehouse/ui';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Notice, Text } from '../../ui';
import { type Home, HomesApiError } from './homes-api';
import { usePauseHome, useResumeHome } from './use-homes';

type Failure = 'stateChanged' | 'actionFailed';

const failureOf = (error: unknown): Failure =>
  error instanceof HomesApiError && error.kind === 'conflict' ? 'stateChanged' : 'actionFailed';

/**
 * «Pausar» una vivienda publicada o «Reactivar» una pausada, con lo que supone cada acción. Es
 * reversible, así que no pide confirmación; el botón se bloquea mientras la API responde y el
 * cambio se anuncia con la nota de estado del detalle.
 */
export function AvailabilityAction({ home }: Readonly<{ home: Home }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const pause = usePauseHome(home.id);
  const resume = useResumeHome(home.id);
  // Estado desde el que ya se lanzó la acción: un segundo toque antes de que la pantalla refleje el
  // nuevo estado no la repite; si falla, se puede reintentar
  const startedFrom = useRef<Home['status'] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  const action = home.status === 'published' ? 'pause' : 'resume';
  const mutation = action === 'pause' ? pause : resume;

  const run = async () => {
    if (startedFrom.current === home.status) return;
    startedFrom.current = home.status;
    setFailure(null);
    try {
      await mutation.mutateAsync();
    } catch (error) {
      startedFrom.current = null;
      setFailure(failureOf(error));
    }
  };

  return (
    <View style={{ gap: theme.space[2] }}>
      <Text tone="textMuted">{t(`homes.detail.${action}.hint`)}</Text>
      {failure ? <Notice tone="danger">{t(`homes.detail.${failure}`)}</Notice> : null}
      <Button
        variant="secondary"
        label={t(`homes.detail.${action}.action`)}
        loading={mutation.isPending}
        onPress={() => {
          run().catch(() => undefined);
        }}
      />
    </View>
  );
}
