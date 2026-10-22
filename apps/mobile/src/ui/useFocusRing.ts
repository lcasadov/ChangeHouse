import { borderWidth, useTheme } from '@changehouse/ui';
import { useState } from 'react';

/** Anillo de foco con el token `color.focus`: manejadores y estilo a añadir al control. */
export function useFocusRing() {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return {
    onFocus: () => {
      setFocused(true);
    },
    onBlur: () => {
      setFocused(false);
    },
    style: focused
      ? ({
          outlineColor: theme.color.focus,
          outlineOffset: borderWidth.thick,
          outlineStyle: 'solid',
          outlineWidth: borderWidth.thick,
        } as const)
      : undefined,
  };
}
