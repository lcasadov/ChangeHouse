/** Reloj inyectable: el dominio y los casos de uso no llaman a `new Date()`. */
export interface Clock {
  now(): Date;
}
