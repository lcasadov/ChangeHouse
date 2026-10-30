import { Stack } from 'expo-router';

/** El detalle de un match y su chat comparten pila: volver del chat deja el detalle. */
export default function MatchLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
