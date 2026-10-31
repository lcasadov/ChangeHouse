import { useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Button, Dialog, Notice } from '../../ui';
import type { ReportTarget } from './moderation-api';
import { ReportSheet } from './ReportSheet';
import { blockErrorKey, reportErrorKey, useModerationActions } from './use-moderation-actions';

export interface MoreOptionsProps {
  /** De qué trata el menú («Piso en Chamberí», «Beto»…): da nombre accesible al botón. */
  subject: string;
  /** Lo que «Denunciar» denuncia. */
  report: ReportTarget;
  /**
   * A quién bloquea «Bloquear». Solo se ofrece donde el contrato expone el identificador del
   * usuario (el remitente de un mensaje); las viviendas y los matches no lo traen.
   */
  block?: { userId: string; name: string };
}

type Feedback =
  | { kind: 'reported' }
  | { kind: 'blocked' }
  | { kind: 'blockFailed'; key: ReturnType<typeof blockErrorKey> };

/**
 * «Más opciones» (`docs/style-guide.md` §3): abre un menú con «Denunciar» —hoja con motivos
 * frecuentes y texto— y, si se puede, «Bloquear», que pide confirmación explicando que dejaréis de
 * veros. El resultado se anuncia con un aviso junto al botón.
 */
export function MoreOptions({ subject, report, block }: Readonly<MoreOptionsProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const actions = useModerationActions();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reportFailure, setReportFailure] = useState<string | null>(null);
  const [sheetKey, setSheetKey] = useState(0);

  const sendReport = async (reason: string) => {
    setReportFailure(null);
    try {
      await actions.report.mutateAsync({ target: report, reason });
      setReporting(false);
      setSheetKey((key) => key + 1);
      setFeedback({ kind: 'reported' });
    } catch (error) {
      setReportFailure(t(`moderation.report.errors.${reportErrorKey(error)}`));
    }
  };

  const blockUser = async () => {
    if (!block) return;
    setBlocking(false);
    try {
      await actions.block.mutateAsync(block.userId);
      setFeedback({ kind: 'blocked' });
    } catch (error) {
      setFeedback({ kind: 'blockFailed', key: blockErrorKey(error) });
    }
  };

  const name = block?.name ?? '';
  const dismiss = { label: t('moderation.dismiss'), onPress: () => setFeedback(null) };

  return (
    <View style={{ gap: theme.space[2] }}>
      <Button
        variant="ghost"
        label={t('moderation.more.action')}
        accessibilityLabel={t('moderation.more.label', { subject })}
        onPress={() => {
          setMenu(true);
        }}
      />
      {feedback?.kind === 'reported' ? (
        <Notice tone="success" action={dismiss}>
          {t('moderation.report.sent')}
        </Notice>
      ) : null}
      {feedback?.kind === 'blocked' ? (
        <Notice tone="success" action={dismiss}>
          {t('moderation.block.done', { name })}
        </Notice>
      ) : null}
      {feedback?.kind === 'blockFailed' ? (
        <Notice
          tone="danger"
          action={{
            label: t('moderation.block.retry'),
            onPress: () => {
              setFeedback(null);
              blockUser().catch(() => undefined);
            },
          }}
        >
          {t(`moderation.block.errors.${feedback.key}`, { name })}
        </Notice>
      ) : null}
      <BottomSheet
        visible={menu}
        title={t('moderation.more.title', { subject })}
        closeLabel={t('moderation.more.close')}
        onClose={() => {
          setMenu(false);
        }}
      >
        <Button
          variant="secondary"
          label={t('moderation.more.report')}
          onPress={() => {
            setMenu(false);
            setFeedback(null);
            setReportFailure(null);
            setReporting(true);
          }}
        />
        {block ? (
          <Button
            variant="secondary"
            label={t('moderation.more.block')}
            onPress={() => {
              setMenu(false);
              setFeedback(null);
              setBlocking(true);
            }}
          />
        ) : null}
      </BottomSheet>
      <ReportSheet
        key={sheetKey}
        visible={reporting}
        submitting={actions.report.isPending}
        failure={reportFailure}
        onSubmit={(reason) => {
          sendReport(reason).catch(() => undefined);
        }}
        onCancel={() => {
          setReporting(false);
        }}
      />
      <Dialog
        visible={blocking}
        title={t('moderation.block.title', { name })}
        description={t('moderation.block.description')}
        confirmLabel={t('moderation.block.confirm')}
        cancelLabel={t('moderation.block.cancel')}
        confirmVariant="danger"
        onConfirm={() => {
          blockUser().catch(() => undefined);
        }}
        onCancel={() => {
          setBlocking(false);
        }}
      />
    </View>
  );
}
