/** Lo que se puede decidir sobre una tarjeta. */
export type Decision = 'like' | 'dismiss';

/** Cuánto tiempo se puede deshacer una decisión desde la interfaz; la API no lo limita (`design.md`). */
export const UNDO_WINDOW_MS = 5000;
