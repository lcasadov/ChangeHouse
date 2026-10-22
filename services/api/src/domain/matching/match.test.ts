import { describe, expect, it } from 'vitest';

import { MatchNotFoundError, MatchNotOpenError } from './errors.js';
import {
  confirmInterest,
  ensureCanSharePhone,
  type MatchState,
  type ParticipantStatus,
  withdrawFromMatch,
} from './match.js';

function match(
  status: MatchState['status'],
  mine: ParticipantStatus,
  theirs: ParticipantStatus,
): MatchState {
  return {
    status,
    participants: [
      { homeId: 'home-a', userId: 'user-a', status: mine },
      { homeId: 'home-b', userId: 'user-b', status: theirs },
    ],
  };
}

const statuses = (state: MatchState) => state.participants.map((p) => p.status);

describe('confirmInterest', () => {
  it('Scenario: Primera confirmación - el participante pasa a confirmed y el match sigue open', () => {
    const result = confirmInterest(match('open', 'pending', 'pending'), 'user-a');

    expect(result.status).toBe('open');
    expect(statuses(result)).toEqual(['confirmed', 'pending']);
  });

  it('Scenario: Todos confirman - el último en confirmar lleva el match a confirmed', () => {
    const result = confirmInterest(match('open', 'pending', 'confirmed'), 'user-a');

    expect(result.status).toBe('confirmed');
    expect(statuses(result)).toEqual(['confirmed', 'confirmed']);
  });

  it('confirmar de nuevo es idempotente: devuelve el mismo estado, también con el match ya confirmed', () => {
    const open = match('open', 'confirmed', 'pending');
    const confirmed = match('confirmed', 'confirmed', 'confirmed');

    expect(confirmInterest(open, 'user-a')).toEqual(open);
    expect(confirmInterest(confirmed, 'user-a')).toEqual(confirmed);
  });

  it('no modifica el estado recibido', () => {
    const original = match('open', 'pending', 'confirmed');

    confirmInterest(original, 'user-a');

    expect(original).toEqual(match('open', 'pending', 'confirmed'));
  });

  it('Scenario: Match cerrado - confirmar lanza MatchNotOpenError', () => {
    for (const status of ['closed', 'expired', 'in_operation'] as const) {
      expect(() => confirmInterest(match(status, 'pending', 'pending'), 'user-a'), status).toThrow(
        MatchNotOpenError,
      );
    }
  });

  it('un participante que se retiró no puede confirmar', () => {
    expect(() => confirmInterest(match('open', 'withdrawn', 'pending'), 'user-a')).toThrow(
      MatchNotOpenError,
    );
  });

  it('quien no participa no existe para el match', () => {
    expect(() => confirmInterest(match('open', 'pending', 'pending'), 'user-c')).toThrow(
      MatchNotFoundError,
    );
  });
});

describe('withdrawFromMatch', () => {
  it('Scenario: Retirarse - desde open el participante pasa a withdrawn y el match a closed', () => {
    const result = withdrawFromMatch(match('open', 'pending', 'confirmed'), 'user-a');

    expect(result.status).toBe('closed');
    expect(statuses(result)).toEqual(['withdrawn', 'confirmed']);
  });

  it('desde confirmed también cierra el match', () => {
    const result = withdrawFromMatch(match('confirmed', 'confirmed', 'confirmed'), 'user-b');

    expect(result.status).toBe('closed');
    expect(statuses(result)).toEqual(['confirmed', 'withdrawn']);
  });

  it('un match closed no admite retirada', () => {
    expect(() => withdrawFromMatch(match('closed', 'pending', 'pending'), 'user-a')).toThrow(
      MatchNotOpenError,
    );
  });

  it('quien no participa no existe para el match', () => {
    expect(() => withdrawFromMatch(match('open', 'pending', 'pending'), 'user-c')).toThrow(
      MatchNotFoundError,
    );
  });
});

describe('errores del match', () => {
  it('MatchNotOpenError es un conflicto con código estable y MatchNotFoundError un 404', () => {
    expect(new MatchNotOpenError()).toMatchObject({ code: 'MATCH_NOT_OPEN', kind: 'conflict' });
    expect(new MatchNotFoundError()).toMatchObject({ code: 'MATCH_NOT_FOUND', kind: 'not_found' });
  });
});

describe('ensureCanSharePhone', () => {
  it('se puede decidir en un match open o confirmed', () => {
    expect(() => {
      ensureCanSharePhone(match('open', 'pending', 'pending'), 'user-a');
      ensureCanSharePhone(match('confirmed', 'confirmed', 'confirmed'), 'user-b');
    }).not.toThrow();
  });

  it('en un match cerrado lanza MatchNotOpenError y a quien no participa MatchNotFoundError', () => {
    expect(() => {
      ensureCanSharePhone(match('closed', 'pending', 'pending'), 'user-a');
    }).toThrow(MatchNotOpenError);
    expect(() => {
      ensureCanSharePhone(match('open', 'pending', 'pending'), 'user-c');
    }).toThrow(MatchNotFoundError);
  });
});
