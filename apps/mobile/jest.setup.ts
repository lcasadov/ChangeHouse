// i18next se inicializa en español para que los componentes resuelvan sus textos
import './src/i18n';
// Gestos: sustituye el módulo nativo de react-native-gesture-handler para poder dispararlos
import 'react-native-gesture-handler/jestSetup';

import { createElement as mockCreateElement } from 'react';

// Los iconos cargan su tipografía con expo-font, que no existe en Jest: se sustituyen por un
// elemento host que conserva las propiedades (nombre, tamaño, color) para poder comprobarlas.
jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: Record<string, unknown>) => mockCreateElement('Ionicons', props),
}));

// Worklets trata Jest como la web y no puede dar a gesture-handler el entorno de ejecución de la
// interfaz que éste intenta instalar: sin ese paso los gestos siguen funcionando en el hilo de JS.
jest.mock(
  'react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings',
  () => ({
    installUIRuntimeBindings: () => undefined,
  }),
);

// La háptica no existe en Jest: se sustituye para poder comprobar cuándo se pide
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
