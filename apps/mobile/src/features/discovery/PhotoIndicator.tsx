import { disabledOpacity, useTheme } from '@changehouse/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

/** El tramo de la foto actual pesa el doble: se distingue por tamaño además de por opacidad. */
const ACTIVE_SEGMENT_GROW = 2;

export interface PhotoIndicatorProps {
  /** Identificadores de las fotos, en orden: un tramo por foto. */
  photoIds: readonly string[];
  /** Posición, desde 0, de la foto que se ve. */
  position: number;
}

/**
 * Un tramo por foto sobre un degradado superior que lo hace legible con cualquier foto. Es
 * decorativo: la posición va en el resumen de la tarjeta, que es lo que anuncia un lector de pantalla.
 */
export function PhotoIndicator({ photoIds, position }: Readonly<PhotoIndicatorProps>) {
  const theme = useTheme();

  return (
    <View
      testID="photo-indicator"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.root}
    >
      <LinearGradient
        colors={[theme.color.photoScrimEnd, theme.color.photoScrimStart]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.segments, { gap: theme.space[1], padding: theme.space[3] }]}>
        {photoIds.map((id, index) => {
          const active = index === position;
          return (
            <View
              key={id}
              testID={`photo-indicator-segment-${String(index)}`}
              style={{
                backgroundColor: theme.color.textOnPhoto,
                borderRadius: theme.radius.full,
                flexBasis: 0,
                flexGrow: active ? ACTIVE_SEGMENT_GROW : 1,
                height: theme.space[1],
                opacity: active ? 1 : disabledOpacity,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { left: 0, position: 'absolute', right: 0, top: 0 },
  segments: { flexDirection: 'row' },
});
