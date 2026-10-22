import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { DiscoveryCard } from '../discovery/discovery-api';
import { photosOf } from '../homes/home-photos';
import { homeTitleOf } from '../homes/home-title';
import { useMyHomes } from '../homes/use-homes';
import { matchViewOf } from './match-model';
import { matchRoutes } from './match-routes';
import { MatchCelebration } from './MatchCelebration';
import type { Match } from './matches-api';

/** Un like que acaba de formar un match: el match, la vivienda propia que dio el like y la tarjeta que lo recibió. */
export interface Celebration {
  match: Match;
  ownHomeId: string;
  card: DiscoveryCard;
}

export interface MatchCelebrationHostProps {
  celebration: Celebration | null;
  /** «Seguir explorando», y también lo que ocurre antes de ir a «Ver match». */
  onClose: () => void;
}

function OpenCelebration({
  celebration,
  onClose,
}: Readonly<{ celebration: Celebration; onClose: () => void }>) {
  const { t } = useTranslation();
  const router = useRouter();
  const homes = useMyHomes();
  const { match, ownHomeId, card } = celebration;
  const own = homes.data?.find((home) => home.id === ownHomeId);

  return (
    <MatchCelebration
      visible
      mine={{
        title: own ? homeTitleOf(t, own) : t('matches.celebration.myHome'),
        coverUrl: photosOf(own)[0]?.url,
      }}
      theirs={{ title: homeTitleOf(t, card), coverUrl: photosOf(card)[0]?.url }}
      compensation={matchViewOf(match, new Set([ownHomeId])).compensation}
      onView={() => {
        onClose();
        // «Matches» queda debajo del detalle: al volver, la persona ve el match nuevo en su lista
        router.navigate(matchRoutes.list);
        router.push(matchRoutes.detail(match.id));
      }}
      onContinue={onClose}
    />
  );
}

/** Une la celebración con los datos de la app: las portadas de las dos casas, la compensación y la navegación. */
export function MatchCelebrationHost({
  celebration,
  onClose,
}: Readonly<MatchCelebrationHostProps>) {
  return celebration ? <OpenCelebration celebration={celebration} onClose={onClose} /> : null;
}
