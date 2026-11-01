import { borderWidth, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useBreakpoint } from '../../ui';
import { useIsAdmin } from '../admin/use-is-admin';
import { hiddenTabRoute, navigationLayoutFor, tabBarColors, tabsFor } from './tabs';

/**
 * Navegación principal: pestañas inferiores y, en web ancha (`expanded`), barra lateral
 * con las mismas cuatro secciones. Colores, tipografía y espaciado salen de los tokens.
 */
export function AppTabs() {
  const theme = useTheme();
  const { t } = useTranslation();
  const breakpoint = useBreakpoint();
  const isAdmin = useIsAdmin();
  const sideNavigation = navigationLayoutFor(Platform.OS, breakpoint) === 'side';
  const colors = tabBarColors(theme);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: sideNavigation ? 'left' : 'bottom',
        tabBarLabelPosition: sideNavigation ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: colors.activeTint,
        tabBarInactiveTintColor: colors.inactiveTint,
        tabBarActiveBackgroundColor: colors.activeBackground,
        tabBarInactiveBackgroundColor: colors.inactiveBackground,
        tabBarItemStyle: sideNavigation
          ? { borderRadius: theme.radius.md, marginVertical: theme.space[1] }
          : { borderRadius: theme.radius.md, margin: theme.space[1] },
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          borderTopWidth: sideNavigation ? 0 : borderWidth.thin,
          borderRightWidth: sideNavigation ? borderWidth.thin : 0,
          paddingHorizontal: sideNavigation ? theme.space[2] : 0,
          paddingTop: sideNavigation ? theme.space[4] : 0,
        },
        tabBarLabelStyle: {
          fontFamily: theme.font.label.family,
          fontSize: theme.font.label.size,
          lineHeight: theme.font.label.lineHeight,
        },
        sceneStyle: { backgroundColor: theme.color.bg },
      }}
    >
      {tabsFor(isAdmin).map(({ route, section, icon }) => (
        <Tabs.Screen
          key={route}
          name={route}
          options={{
            title: t(`tabs.${section}`),
            tabBarAccessibilityLabel: t(`tabs.${section}`),
            tabBarIcon: ({ size, focused }) => (
              <Ionicons
                name={focused ? icon.active : icon.inactive}
                size={size}
                color={focused ? colors.activeTint : colors.inactiveTint}
                accessible={false}
              />
            ),
          }}
        />
      ))}
      <Tabs.Screen name={hiddenTabRoute(isAdmin)} options={{ href: null }} />
    </Tabs>
  );
}
