import { useMemo } from 'react';

import { useAppleSignIn } from './apple-sign-in';
import type { SocialSignIn } from './auth-service';
import { type GoogleEnv, readGoogleConfig, useGoogleSignIn } from './google-sign-in';

/** Los proveedores externos configurados en este dispositivo, en el orden en que se muestran. */
export function useSocialSignIns(env: Readonly<GoogleEnv>): readonly SocialSignIn[] {
  const google = useGoogleSignIn(readGoogleConfig(env));
  const apple = useAppleSignIn();
  return useMemo(
    () => [google, apple].filter((provider): provider is SocialSignIn => provider !== null),
    [google, apple],
  );
}
