import { useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState, FormScreen, Notice, Text } from '../../ui';
import { useMe } from '../account/use-me';
import { LoadingView } from '../session/LoadingView';
import { SectionPlaceholder } from '../shell/SectionPlaceholder';
import { FilterChips } from './FilterChips';
import { FirstUseStep } from './FirstUseStep';
import type { Preferences } from './preferences';
import { PreferencesSheet } from './PreferencesSheet';
import { summaryText } from './summary';
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

/** La búsqueda guardada: barra de zona, chips de un toque, hoja de filtros y, por ahora, su resumen. */
function SearchHome({ saved }: Readonly<{ saved: Preferences }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const autosaved = useAutosavedPreferences(saved);
  const { preferences, change } = autosaved;

  return (
    <FormScreen>
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
          setSheetOpen(true);
        }}
      />
      <StatusLine status={autosaved.status} />
      {/* Hasta que exista el descubrimiento, la búsqueda guardada se resume aquí */}
      <View style={{ minHeight: theme.space[8] * 4 }}>
        <EmptyState
          icon="compass-outline"
          title={t('explore.empty.title')}
          description={summaryText(t, preferences)}
        />
      </View>
      <PreferencesSheet
        visible={sheetOpen}
        title={t('search.sheet.title')}
        initial={preferences}
        includeZone={false}
        onSave={autosaved.saveNow}
        onClose={() => {
          setSheetOpen(false);
        }}
      />
    </FormScreen>
  );
}

/** «Explorar»: el primer uso pide zona y compensación; después, la búsqueda en un toque. */
export function ExploreScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const searches = me.data?.roles.some((role) => SEARCHING_ROLES.has(role)) ?? false;
  const query = useMyPreferences(searches);
  const save = useSaveMyPreferences();

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
  if (query.data === null) {
    return (
      <FirstUseStep
        onSave={async (input) => {
          await save(input);
        }}
      />
    );
  }
  return <SearchHome saved={query.data} />;
}
