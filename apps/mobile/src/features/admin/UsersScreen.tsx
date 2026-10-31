import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button, Text, TextField } from '../../ui';
import type { AdminUser } from './admin-api';
import { adminRoutes } from './admin-routes';
import { AdminScreen } from './AdminScreen';
import { DataTable } from './DataTable';
import { formatDate } from './format-date';
import { PagedSection } from './PagedSection';
import { itemsOf, useAdminUsers } from './use-admin-panel';

/**
 * «Usuarios» de «Administración»: búsqueda por email o nombre visible, paginada, con el estado de
 * cada cuenta y el acceso a suspenderla o reactivarla.
 */
export function UsersScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const query = useAdminUsers(search);
  const users = itemsOf(query.data);

  return (
    <AdminScreen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.space[4], paddingVertical: theme.space[5] }}
      >
        <View style={{ gap: theme.space[1] }}>
          <Text variant="title" accessibilityRole="header">
            {t('admin.userList.title')}
          </Text>
          <Text tone="textMuted">{t('admin.userList.intro')}</Text>
        </View>
        <TextField
          label={t('admin.userList.searchLabel')}
          value={text}
          onChangeText={setText}
          returnKeyType="search"
          onSubmitEditing={() => {
            setSearch(text.trim());
          }}
        />
        <Button
          variant="secondary"
          label={t('admin.userList.search')}
          onPress={() => {
            setSearch(text.trim());
          }}
        />
        <PagedSection
          query={query}
          count={users.length}
          empty={{
            title: t('admin.userList.empty.title'),
            description: t('admin.userList.empty.description'),
          }}
          texts={{
            loadFailed: t('admin.userList.loadFailed'),
            retry: t('admin.userList.retry'),
            loadMore: t('admin.userList.loadMore'),
            loadMoreFailed: t('admin.userList.loadMoreFailed'),
          }}
        >
          <DataTable<AdminUser>
            items={users}
            keyOf={(user) => user.id}
            columns={[
              {
                key: 'name',
                header: t('admin.userList.columns.name'),
                value: (u) => u.displayName,
              },
              { key: 'email', header: t('admin.userList.columns.email'), value: (u) => u.email },
              {
                key: 'status',
                header: t('admin.userList.columns.status'),
                value: (u) =>
                  t(
                    u.suspended
                      ? 'admin.userList.status.suspended'
                      : 'admin.userList.status.active',
                  ),
              },
              {
                key: 'created',
                header: t('admin.userList.columns.created'),
                value: (u) => formatDate(u.createdAt),
              },
            ]}
            renderAction={(user) => (
              <Button
                variant="secondary"
                label={t('admin.userList.manage')}
                accessibilityLabel={t('admin.userList.manageLabel', {
                  name: user.displayName,
                  email: user.email,
                })}
                onPress={() => {
                  router.push(adminRoutes.suspension(user.id));
                }}
              />
            )}
          />
        </PagedSection>
      </ScrollView>
    </AdminScreen>
  );
}
