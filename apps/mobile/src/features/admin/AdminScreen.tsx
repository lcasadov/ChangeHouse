import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Screen } from '../../ui';
import { AdminTabs } from './AdminTabs';

/** `Screen` de las secciones de «Administración»: las pestañas arriba y el contenido debajo. */
export function AdminScreen({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Screen>
      <AdminTabs />
      <View style={{ flex: 1 }}>{children}</View>
    </Screen>
  );
}
