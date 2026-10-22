import { borderWidth, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Text } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import { CompensationPill, compensationText } from '../discovery/CompensationPill';
import { photosOf } from '../homes/home-photos';
import { homeTitleOf } from '../homes/home-title';
import { kindOf, matchViewOf } from './match-model';
import { matchRoutes } from './match-routes';
import { STATUS_PRESENTATION } from './match-status';
import type { Match } from './matches-api';
import { useOtherHome } from './use-matches';

export interface MatchRowProps {
  match: Match;
  /** Las viviendas de quien mira: así se reconoce cuál es su participación. */
  ownHomeIds: ReadonlySet<string>;
}

/**
 * Un match en la lista (`MatchCard` de `docs/style-guide.md` §3): la portada y el título de la otra
 * casa, el tipo de match, lo que paga o recibe quien mira y el estado, con texto además de color.
 * Para un lector de pantalla es una sola frase y un botón que abre el detalle del match. Si la otra casa ya no se puede consultar (su dueño la
 * retiró), la fila lo dice en lugar de desaparecer.
 */
export function MatchRow({ match, ownHomeIds }: Readonly<MatchRowProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const focusRing = useFocusRing();
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
    <Pressable
      testID="match-row"
      accessible
      accessibilityRole="button"
      accessibilityLabel={summary}
      accessibilityHint={t('matches.row.open')}
      onPress={() => {
        router.push(matchRoutes.detail(match.id));
      }}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        styles.row,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          borderRadius: theme.radius.lg,
          borderWidth: borderWidth.thin,
          gap: theme.space[3],
          minHeight: touchTarget,
          padding: theme.space[3],
        },
        focusRing.style,
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  cover: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { alignItems: 'flex-start', flexDirection: 'row' },
});
