import { borderWidth, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone, Text } from '../../ui';
import { CompensationPill, compensationText } from '../discovery/CompensationPill';
import { photosOf } from '../homes/home-photos';
import { homeTitleOf } from '../homes/home-title';
import { kindOf, matchViewOf } from './match-model';
import type { Match } from './matches-api';
import { useOtherHome } from './use-matches';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Tono e icono de cada estado: el texto lo dice, el icono y el color lo acompañan (`MatchStatus`). */
const STATUS_PRESENTATION: Record<Match['status'], { tone: BadgeTone; icon: IconName }> = {
  open: { tone: 'info', icon: 'hourglass-outline' },
  confirmed: { tone: 'success', icon: 'checkmark-circle-outline' },
  in_operation: { tone: 'info', icon: 'swap-horizontal' },
  closed: { tone: 'neutral', icon: 'lock-closed-outline' },
  expired: { tone: 'warning', icon: 'time-outline' },
};

export interface MatchRowProps {
  match: Match;
  /** Las viviendas de quien mira: así se reconoce cuál es su participación. */
  ownHomeIds: ReadonlySet<string>;
}

/**
 * Un match en la lista (`MatchCard` de `docs/style-guide.md` §3): la portada y el título de la otra
 * casa, el tipo de match, lo que paga o recibe quien mira y el estado, con texto además de color.
 * Para un lector de pantalla es una sola frase. Si la otra casa ya no se puede consultar (su dueño la
 * retiró), la fila lo dice en lugar de desaparecer.
 */
export function MatchRow({ match, ownHomeIds }: Readonly<MatchRowProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { otherHomeId, compensation } = matchViewOf(match, ownHomeIds);
  const other = useOtherHome(otherHomeId);
  const cover = photosOf(other.data)[0];
  const { tone, icon } = STATUS_PRESENTATION[match.status];
  const statusLabel = t(`matches.status.${match.status}`);
  const kind = t(`matches.kind.${kindOf(match.type)}`);

  let title = t('matches.row.loadingHome');
  if (other.data) title = homeTitleOf(t, other.data);
  else if (other.isError) title = t('matches.row.unavailable');

  const summary = compensation
    ? t('matches.row.summary', {
        title,
        kind,
        compensation: compensationText(t, compensation),
        status: statusLabel,
      })
    : t('matches.row.summaryNoCompensation', { title, kind, status: statusLabel });

  return (
    <View
      testID="match-row"
      accessible
      accessibilityLabel={summary}
      style={[
        styles.row,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          borderRadius: theme.radius.lg,
          borderWidth: borderWidth.thin,
          gap: theme.space[3],
          padding: theme.space[3],
        },
      ]}
    >
      <View
        accessible={false}
        style={[
          styles.cover,
          {
            backgroundColor: theme.color.surfaceMuted,
            borderRadius: theme.radius.md,
            height: theme.space[8] + theme.space[4],
            width: theme.space[8] + theme.space[4],
          },
        ]}
      >
        {cover ? (
          <Image
            testID="match-row-cover"
            source={{ uri: cover.url }}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessible={false}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <Ionicons
            accessible={false}
            name="home-outline"
            size={theme.space[6]}
            color={theme.color.textMuted}
          />
        )}
      </View>
      <View style={[styles.body, { gap: theme.space[2] }]}>
        <Text variant="bodyStrong" accessible={false}>
          {title}
        </Text>
        {other.isError ? (
          <Text variant="caption" tone="textMuted" accessible={false}>
            {t('matches.row.unavailableHint')}
          </Text>
        ) : null}
        <Text variant="caption" tone="textMuted" accessible={false}>
          {kind}
        </Text>
        {compensation ? <CompensationPill compensation={compensation} /> : null}
        <Badge tone={tone} icon={icon} label={statusLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  cover: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { alignItems: 'flex-start', flexDirection: 'row' },
});
