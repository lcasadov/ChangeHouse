import { useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, Dialog, Notice, Text } from '../../ui';
import { PreferencesSheet } from './PreferencesSheet';
import { summaryText } from './summary';
import {
  useDeleteHomePreferences,
  useHomePreferences,
  useMyPreferences,
  useSaveHomePreferences,
} from './use-search-preferences';

/**
 * «Preferencias de esta vivienda» en el detalle de una vivienda propia: sin propias busca con las
 * del usuario; se pueden definir y editar con el mismo editor y «Usar las mías» las elimina tras
 * confirmar, porque no se puede deshacer.
 */
export function HomePreferences({ homeId }: Readonly<{ homeId: string }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const own = useHomePreferences(homeId);
  const mine = useMyPreferences();
  const save = useSaveHomePreferences(homeId);
  const remove = useDeleteHomePreferences(homeId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const effective = own.data ?? mine.data ?? null;

  const body = () => {
    if (own.isPending) return <ActivityIndicator color={theme.color.primary} />;
    if (own.isError) {
      return (
        <Notice
          tone="danger"
          action={{
            label: t('search.retry'),
            onPress: () => {
              own.refetch().catch(() => undefined);
            },
          }}
        >
          {t('search.home.loadFailed')}
        </Notice>
      );
    }
    return (
      <>
        <Text accessibilityLiveRegion="polite">
          {t(own.data ? 'search.home.own' : 'search.home.inherited')}
        </Text>
        {effective ? <Text tone="textMuted">{summaryText(t, effective)}</Text> : null}
        {own.data ? (
          <>
            <Button
              variant="secondary"
              label={t('search.home.edit')}
              onPress={() => {
                setSheetOpen(true);
              }}
            />
            <Button
              variant="ghost"
              label={t('search.home.useMine')}
              onPress={() => {
                setDeleteFailed(false);
                setConfirming(true);
              }}
            />
          </>
        ) : (
          <Button
            variant="secondary"
            label={t('search.home.define')}
            onPress={() => {
              setSheetOpen(true);
            }}
          />
        )}
        {deleteFailed ? <Notice tone="danger">{t('search.home.deleteFailed')}</Notice> : null}
      </>
    );
  };

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text variant="heading" accessibilityRole="header">
        {t('search.home.title')}
      </Text>
      {body()}
      <PreferencesSheet
        visible={sheetOpen}
        title={t('search.home.sheetTitle')}
        initial={own.data ?? mine.data ?? null}
        includeZone
        onSave={async (input) => {
          await save(input);
        }}
        onClose={() => {
          setSheetOpen(false);
        }}
      />
      <Dialog
        visible={confirming}
        title={t('search.home.confirmTitle')}
        description={t('search.home.confirmDescription')}
        confirmLabel={t('search.home.confirmAction')}
        cancelLabel={t('search.home.cancel')}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate(undefined, {
            onError: () => {
              setDeleteFailed(true);
            },
          });
        }}
      />
    </View>
  );
}
