import { AccessibilityInfo } from 'react-native';

/** Dice el mensaje a los lectores de pantalla sin mover el foco (el resultado de una acción sin pantalla propia). */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
