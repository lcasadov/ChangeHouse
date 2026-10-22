import { useTheme } from '@changehouse/ui';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { FormScreen, Notice, Screen, Text } from '../../ui';
import { useMe } from '../account/use-me';
import { DiscoveryFeed } from '../discovery/DiscoveryFeed';
import { LoadingView } from '../session/LoadingView';
import { SectionPlaceholder } from '../shell/SectionPlaceholder';
import { FilterChips } from './FilterChips';
import { FirstUseStep } from './FirstUseStep';
import type { Preferences } from './preferences';
import { PreferencesSheet } from './PreferencesSheet';
import { useAutosavedPreferences } from './use-autosaved-preferences';
import { useMyPreferences, useSaveMyPreferences } from './use-search-preferences';
import { ZonePicker } from './ZonePicker';

/** Roles que buscan vivienda; la administración y las agencias no tienen preferencias de búsqueda. */
const SEARCHING_ROLES = new Set(['owner', 'seeker']);

function StatusLine({ status }: Readonly<{ status: 'idle' | 'saving' | 'saved' | 'failed' }>) {
  const { t } = useTranslation();
  if (status === 'failed') return <Notice tone="danger">{t('search.status.failed')}</Notice>;
  if (status === 'idle') return null;
  return (
    <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
      {t(status === 'saving' ? 'search.status.saving' : 'search.status.saved')}
    </Text>
  );
}

/** Qué filtros abre la hoja: todos, o con la zona a la vista cuando se llega desde «Ampliar zona». */
type SheetMode = 'filters' | 'zone';

interface SearchHomeProps {
  saved: Preferences;
  onPreferencesRequired: () => void;
}

/** La búsqueda guardada: barra de zona, chips de un toque, hoja de filtros y, debajo, las tarjetas. */
function SearchHome({ saved, onPreferencesRequired }: Readonly<SearchHomeProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const autosaved = useAutosavedPreferences(saved);
  const { preferences, change } = autosaved;
  // Las tarjetas dependen de lo guardado en la API, no de lo que se está escribiendo
  const searchKey = useMemo(() => JSON.stringify(saved), [saved]);

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          gap: theme.space[3],
          paddingVertical: theme.space[3],
        }}
      >
        <ZonePicker
          preferences={preferences}
          onChange={change}
          error={
            (preferences.municipalities ?? []).length === 0 && !preferences.center
              ? t('search.zone.required')
              : undefined
          }
        />
        <FilterChips
          preferences={preferences}
          onChange={change}
          onMore={() => {
            setSheet('filters');
          }}
        />
        <StatusLine status={autosaved.status} />
        <DiscoveryFeed
          searchKey={searchKey}
          onWidenZone={() => {
            setSheet('zone');
          }}
          onAdjustCompensation={() => {
            setSheet('filters');
          }}
          onPreferencesRequired={onPreferencesRequired}
        />
      </ScrollView>
      <PreferencesSheet
        visible={sheet !== null}
        title={t('search.sheet.title')}
        initial={preferences}
        includeZone={sheet === 'zone'}
        onSave={autosaved.saveNow}
        onClose={() => {
          setSheet(null);
        }}
      />
    </Screen>
  );
}

/** «Explorar»: el primer uso pide zona y compensación; después, la búsqueda en un toque. */
export function ExploreScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const searches = me.data?.roles.some((role) => SEARCHING_ROLES.has(role)) ?? false;
  const query = useMyPreferences(searches);
  const save = useSaveMyPreferences();
  // La API puede pedir las preferencias aunque la app crea tenerlas (422): vuelve al primer paso
  const [needsFirstUse, setNeedsFirstUse] = useState(false);
  const requireFirstUse = useCallback(() => {
    setNeedsFirstUse(true);
  }, []);

  if (me.data && !searches) return <SectionPlaceholder section="explore" icon="compass-outline" />;
  if (me.isPending || query.isPending) return <LoadingView />;
  if (query.isError) {
    return (
      <FormScreen>
        <Notice
          tone="danger"
          action={{
            label: t('search.retry'),
            onPress: () => {
              query.refetch().catch(() => undefined);
            },
          }}
        >
          {t('search.loadFailed')}
        </Notice>
      </FormScreen>
    );
  }
  if (query.data === null || needsFirstUse) {
    return (
      <FirstUseStep
        onSave={async (input) => {
          await save(input);
          setNeedsFirstUse(false);
        }}
      />
    );
  }
  return <SearchHome saved={query.data} onPreferencesRequired={requireFirstUse} />;
}
