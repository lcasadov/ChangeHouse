/** Generador de identificadores de entidad (UUID v7 generado en la aplicación). */
export interface IdGenerator {
  next(): string;
}
