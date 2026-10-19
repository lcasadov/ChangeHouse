import { Stack } from 'expo-router';

// `welcome` va primero: es adonde redirige la protección de rutas cuando no hay sesión
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="access" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
