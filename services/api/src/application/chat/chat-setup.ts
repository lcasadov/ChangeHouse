export interface ChatRosterMember {
  readonly userId: string;
  readonly firebaseUid: string;
  readonly displayName: string;
}

/** Quién participa en un match y si su chat ya existe. */
export interface ChatRoster {
  readonly matchId: string;
  readonly chatId: string | null;
  readonly members: readonly ChatRosterMember[];
}

/** Puerto de salida: lo que PostgreSQL aporta a la creación del chat. */
export interface ChatSetup {
  /** `null` si el match no existe. */
  findRoster(matchId: string): Promise<ChatRoster | null>;
  /** Anota en el match el identificador de su chat. */
  linkChat(matchId: string, chatId: string): Promise<void>;
}
