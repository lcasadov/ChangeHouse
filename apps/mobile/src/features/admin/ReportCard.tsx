import { borderWidth, useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Text } from '../../ui';
import type { Report } from './admin-api';
import { formatDate } from './format-date';

export interface ReportCardProps {
  report: Report;
  /** Hay una decisión en curso sobre alguna denuncia. */
  busy: boolean;
  onResolve: () => void;
  onDismiss: () => void;
}

/**
 * Una denuncia abierta: qué se denuncia (tipo y referencia), el motivo, cuándo y las dos decisiones
 * del admin. El contrato no devuelve la copia del mensaje denunciado, solo su referencia.
 */
export function ReportCard({ report, busy, onResolve, onDismiss }: Readonly<ReportCardProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      testID="report-card"
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderRadius: theme.radius.lg,
        borderWidth: borderWidth.thin,
        gap: theme.space[2],
        padding: theme.space[4],
      }}
    >
      <Text variant="bodyStrong">
        {t('admin.reports.item.target', {
          type: t(`admin.reports.item.targetType.${report.targetType}`),
          id: report.targetId,
        })}
      </Text>
      <Text>{t('admin.reports.item.reason', { reason: report.reason })}</Text>
      {report.evidence ? (
        <View
          style={{
            backgroundColor: theme.color.surfaceMuted,
            borderRadius: theme.radius.md,
            gap: theme.space[1],
            padding: theme.space[3],
          }}
        >
          <Text variant="label" tone="textMuted">
            {t('admin.reports.item.evidence.title')}
          </Text>
          <Text>
            {report.evidence.text === null
              ? t('admin.reports.item.evidence.image')
              : t('admin.reports.item.evidence.text', { text: report.evidence.text })}
          </Text>
          <Text variant="caption" tone="textMuted">
            {t('admin.reports.item.evidence.sent', { date: formatDate(report.evidence.sentAt) })}
          </Text>
        </View>
      ) : null}
      <Text variant="caption" tone="textMuted">
        {t('admin.reports.item.created', { date: formatDate(report.createdAt) })}
      </Text>
      <View style={{ gap: theme.space[2], paddingTop: theme.space[2] }}>
        <Button
          label={t('admin.reports.resolve.action')}
          accessibilityLabel={t('admin.reports.item.resolveLabel', { reason: report.reason })}
          disabled={busy}
          onPress={onResolve}
        />
        <Button
          variant="secondary"
          label={t('admin.reports.dismiss.action')}
          accessibilityLabel={t('admin.reports.item.dismissLabel', { reason: report.reason })}
          disabled={busy}
          onPress={onDismiss}
        />
      </View>
    </View>
  );
}
