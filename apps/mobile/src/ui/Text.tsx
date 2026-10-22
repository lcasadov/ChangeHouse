import type { ColorTokens, FontRole } from '@changehouse/ui';
import { FONT_FALLBACK_STACK, useTheme } from '@changehouse/ui';
import { Platform, Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

export interface TextProps extends NativeTextProps {
  /** Rol tipográfico (`font.*` de la guía de estilo). */
  variant?: FontRole;
  /** Token de color del texto. */
  tone?: keyof ColorTokens;
}

/**
 * Texto con tipografía y color de los tokens. No fija `fontWeight`: cada peso de Inter es una
 * familia distinta y combinarlos produciría negrita sintética. En la web la familia lleva el
 * respaldo del sistema.
 */
export function Text({ variant = 'body', tone = 'text', style, ...rest }: Readonly<TextProps>) {
  const theme = useTheme();
  const token = theme.font[variant];
  const fontFamily =
    Platform.OS === 'web' ? `${token.family}, ${FONT_FALLBACK_STACK}` : token.family;
  return (
    <NativeText
      {...rest}
      style={[
        {
          color: theme.color[tone],
          fontFamily,
          fontSize: token.size,
          lineHeight: token.lineHeight,
        },
        style,
      ]}
    />
  );
}
