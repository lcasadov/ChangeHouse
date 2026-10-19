import { borderWidth, touchTarget, useTheme } from '@changehouse/ui';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { FieldError } from './FieldError';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export interface TextFieldProps extends Pick<
  TextInputProps,
  | 'autoComplete'
  | 'autoCapitalize'
  | 'keyboardType'
  | 'maxLength'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'textContentType'
> {
  /** Etiqueta visible; también es el nombre accesible del campo. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Al salir del campo: la validación se muestra entonces, no mientras se escribe. */
  onBlur?: () => void;
  /** Mensaje de error ya traducido; ausente si el valor es válido. */
  error?: string | undefined;
  hint?: string;
  /** Oculta lo escrito (contraseñas). */
  secret?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  hint,
  secret = false,
  autoCapitalize = 'none',
  ...inputProps
}: Readonly<TextFieldProps>) {
  const theme = useTheme();
  const focusRing = useFocusRing();
  const invalid = Boolean(error);

  return (
    <View style={{ gap: theme.space[1] }}>
      <Text variant="label">{label}</Text>
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        onFocus={focusRing.onFocus}
        onBlur={() => {
          focusRing.onBlur();
          onBlur?.();
        }}
        secureTextEntry={secret}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        accessibilityHint={error}
        aria-invalid={invalid}
        placeholderTextColor={theme.color.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.color.surface,
            borderColor: invalid ? theme.color.danger : theme.color.borderStrong,
            borderRadius: theme.radius.sm,
            borderWidth: borderWidth.thin,
            color: theme.color.text,
            fontFamily: theme.font.body.family,
            fontSize: theme.font.body.size,
            minHeight: touchTarget,
            paddingHorizontal: theme.space[3],
            paddingVertical: theme.space[2],
          },
          focusRing.style,
        ]}
      />
      {hint && !invalid ? (
        <Text variant="caption" tone="textMuted">
          {hint}
        </Text>
      ) : null}
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ input: { width: '100%' } });
