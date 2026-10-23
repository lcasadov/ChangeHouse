import type { HomePatch } from '@changehouse/shared';

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
  /**
   * Antes de guardar: resuelve `false` si la persona decide no guardar (p. ej. tras avisarle de que
   * el cambio devuelve la vivienda a revisión). Ausente, se guarda siempre.
   */
  confirmSave?: ((patch: HomePatch) => Promise<boolean>) | undefined;
}
