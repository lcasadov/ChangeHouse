import { breakpoints } from '@changehouse/ui';
import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'compact' | 'medium' | 'expanded';

export function breakpointForWidth(width: number): Breakpoint {
  if (width >= breakpoints.expanded) return 'expanded';
  if (width >= breakpoints.medium) return 'medium';
  return 'compact';
}

/** Punto de corte actual según `docs/style-guide.md` §4. */
export function useBreakpoint(): Breakpoint {
  return breakpointForWidth(useWindowDimensions().width);
}
