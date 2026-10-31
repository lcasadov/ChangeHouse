import { borderWidth, touchTarget, useTheme } from '@changehouse/ui';
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text, useBreakpoint } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import { adminRoutes } from './admin-routes';

type SectionKey = 'moderation' | 'reports' | 'users' | 'metrics' | 'audit' | 'waitlist';

const SECTIONS: readonly { key: SectionKey; href: string }[] = [
  { key: 'moderation', href: adminRoutes.queue },
  { key: 'reports', href: adminRoutes.reports },
  { key: 'users', href: adminRoutes.users },
  { key: 'metrics', href: adminRoutes.metrics },
  { key: 'audit', href: adminRoutes.audit },
  { key: 'waitlist', href: adminRoutes.waitlist },
];

/** La sección a la que pertenece una ruta; la suspensión cuelga de «Usuarios» y el detalle de «Moderación». */
export function sectionOf(pathname: string): SectionKey {
  if (pathname.startsWith(adminRoutes.users) || pathname.startsWith('/admin/user-suspension')) {
    return 'users';
  }
  const found = SECTIONS.find(
    (section) => section.key !== 'moderation' && pathname.startsWith(section.href),
  );
  return found?.key ?? 'moderation';
}

function SectionTab({
  label,
  selected,
  onPress,
}: Readonly<{ label: string; selected: boolean; onPress: () => void }>) {
  const theme = useTheme();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        {
          alignItems: 'center',
          backgroundColor: selected ? theme.color.primary : theme.color.surface,
          borderColor: selected ? theme.color.primary : theme.color.borderStrong,
          borderRadius: theme.radius.full,
          borderWidth: borderWidth.thin,
          justifyContent: 'center',
          minHeight: touchTarget,
          paddingHorizontal: theme.space[3],
        },
        focusRing.style,
      ]}
    >
      <Text
        variant="label"
        accessible={false}
        style={{ color: selected ? theme.color.textOnPrimary : theme.color.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Las pestañas superiores de «Administración». En pantallas estrechas pasan a varias filas en lugar
 * de desplazarse en horizontal.
 */
export function AdminTabs() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const active = sectionOf(pathname);
  const compact = useBreakpoint() === 'compact';
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('admin.tabs.label')}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: compact ? theme.space[2] : theme.space[3],
        paddingTop: theme.space[4],
      }}
    >
      {SECTIONS.map(({ key, href }) => (
        <SectionTab
          key={key}
          label={t(`admin.tabs.${key}`)}
          selected={key === active}
          onPress={() => {
            if (pathname !== href) router.navigate(href);
          }}
        />
      ))}
    </View>
  );
}
