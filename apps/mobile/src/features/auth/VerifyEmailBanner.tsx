import { useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice, type NoticeTone } from '../../ui';
import { useServices } from '../session/services';
import { useAuth } from './AuthProvider';

type Feedback = 'resent' | 'stillPending' | 'failed';
type Busy = 'resend' | 'refresh';

const FEEDBACK_TONE: Record<Feedback, NoticeTone> = {
  resent: 'success',
  stillPending: 'info',
  failed: 'danger',
};

/**
 * Aviso persistente para quien se registró con email y aún no lo ha verificado: permite reenviar el
 * enlace y comprobar la verificación sin salir de la app. No bloquea el uso de la app.
 */
export function VerifyEmailBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { auth } = useServices();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);

  if (!user?.hasPassword || user.emailVerified) return null;

  const run = async (kind: Busy, action: () => Promise<void>, success: Feedback) => {
    setBusy(kind);
    try {
      await action();
      setFeedback(success);
    } catch {
      setFeedback('failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.color.bg }}>
      <View style={{ paddingHorizontal: theme.space[3], paddingTop: theme.space[2] }}>
        <Notice
          testID="verify-email-banner"
          actionsTestID="verify-email-actions"
          tone={feedback ? FEEDBACK_TONE[feedback] : 'warning'}
          detail={feedback ? t(`auth.verify.${feedback}`) : undefined}
          actions={[
            {
              label: t('auth.verify.resend'),
              loading: busy === 'resend',
              disabled: busy === 'refresh',
              onPress: () => {
                run('resend', () => auth.resendVerificationEmail(), 'resent').catch(
                  () => undefined,
                );
              },
            },
            {
              label: t('auth.verify.refresh'),
              loading: busy === 'refresh',
              disabled: busy === 'resend',
              onPress: () => {
                run('refresh', () => auth.refreshUser(), 'stillPending').catch(() => undefined);
              },
            },
          ]}
        >
          {t('auth.verify.banner')}
        </Notice>
      </View>
    </SafeAreaView>
  );
}
