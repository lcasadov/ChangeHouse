import type { Home } from './homes-api';

/** Lo que recibe cada paso del asistente. */
export interface StepProps {
  /** La vivienda guardada; ausente en el alta, antes de crear el borrador. */
  home?: Home | undefined;
  /** El paso se ha guardado: el asistente pasa al siguiente con la vivienda actualizada. */
  onSaved: (home: Home) => void;
  /** Ausente en el primer paso. */
  onBack?: (() => void) | undefined;
  /** Salir al listado; el borrador ya está guardado. */
  onExit: () => void;
}
