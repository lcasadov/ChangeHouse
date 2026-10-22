import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { DiscoveryCard } from '../discovery/discovery-api';
import { photosOf } from '../homes/home-photos';
import { homeTitleOf } from '../homes/home-title';
import { useMyHomes } from '../homes/use-homes';
import { chainThirdHomeIdOf, cycleOf, matchViewOf } from './match-model';
import { matchRoutes } from './match-routes';
import { type CelebrationChain, MatchCelebration } from './MatchCelebration';
import type { Match } from './matches-api';
import { useOtherHome } from './use-matches';

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
  const ownHomeIds = new Set([ownHomeId]);
  const thirdHomeId = chainThirdHomeIdOf(match, ownHomeIds);
  const third = useOtherHome(thirdHomeId);
  // Ciclo desde quien mira: él, de quien recibe y a quien entrega
  const [, from, to] = cycleOf(match.participants, ownHomeIds);
  let chain: CelebrationChain | undefined;
  if (thirdHomeId && from && to) {
    chain = {
      third: {
        title: third.data ? homeTitleOf(t, third.data) : t('matches.celebration.chain.thirdHome'),
        coverUrl: photosOf(third.data)[0]?.url,
      },
      fromName: from.displayName,
      toName: to.displayName,
    };
  }

  return (
    <MatchCelebration
      visible
      mine={{
        title: own ? homeTitleOf(t, own) : t('matches.celebration.myHome'),
        coverUrl: photosOf(own)[0]?.url,
      }}
      theirs={{ title: homeTitleOf(t, card), coverUrl: photosOf(card)[0]?.url }}
      {...(chain ? { chain } : {})}
      compensation={matchViewOf(match, ownHomeIds).compensation}
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
