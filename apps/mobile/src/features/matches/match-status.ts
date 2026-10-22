import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { BadgeTone } from '../../ui';
import type { Match } from './matches-api';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Tono e icono de cada estado: el texto lo dice, el icono y el color lo acompañan (`MatchStatus`). */
export const STATUS_PRESENTATION: Record<Match['status'], { tone: BadgeTone; icon: IconName }> = {
  open: { tone: 'info', icon: 'hourglass-outline' },
  confirmed: { tone: 'success', icon: 'checkmark-circle-outline' },
  in_operation: { tone: 'info', icon: 'swap-horizontal' },
  closed: { tone: 'neutral', icon: 'lock-closed-outline' },
  expired: { tone: 'warning', icon: 'time-outline' },
};

/** Tono e icono del estado de un participante en el match (`ParticipantStatus`). */
export const PARTICIPANT_PRESENTATION: Record<
  Match['participants'][number]['status'],
  { tone: BadgeTone; icon: IconName }
> = {
  pending: { tone: 'neutral', icon: 'time-outline' },
  confirmed: { tone: 'success', icon: 'checkmark-circle-outline' },
  withdrawn: { tone: 'warning', icon: 'exit-outline' },
};
