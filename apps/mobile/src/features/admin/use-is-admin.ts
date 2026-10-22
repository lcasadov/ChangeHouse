import { useMe } from '../account/use-me';

/** Si la persona con sesión tiene el rol `admin` (asignado, exclusivo con el resto). */
export function useIsAdmin(): boolean {
  const me = useMe();
  return me.data?.roles.includes('admin') ?? false;
}
