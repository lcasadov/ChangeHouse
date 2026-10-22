// i18next se inicializa en español para que los componentes resuelvan sus textos
import './src/i18n';

import { createElement as mockCreateElement } from 'react';

// Los iconos cargan su tipografía con expo-font, que no existe en Jest: se sustituyen por un
// elemento host que conserva las propiedades (nombre, tamaño, color) para poder comprobarlas.
jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: Record<string, unknown>) => mockCreateElement('Ionicons', props),
}));
