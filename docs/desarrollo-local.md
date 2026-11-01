# Desarrollo y pruebas en local

Todo ChangeHouse corre en el PC, sin Google Cloud:
- PostgreSQL con PostGIS y el almacenamiento de fotos simulado, en Docker;
- los emuladores de Firebase (Auth y Firestore);
- la API, la app y la landing.

## Requisitos

- Node 24 y pnpm 10 (`corepack enable`).
- Docker Desktop arrancado.
- Java 21 para los emuladores de Firebase.

## Arrancar en el PC

```bash
pnpm install
cp services/api/.env.example services/api/.env
cp apps/mobile/.env.example apps/mobile/.env
pnpm infra:up        # Docker: base de datos y almacenamiento de fotos
pnpm db:migrate
pnpm emulators       # en otra terminal: Auth y Firestore (consola en http://localhost:4000)
pnpm dev             # en otra terminal: API (8080), app web (8081) y landing (4321)
```

Abre la app en `http://localhost:8081`. Las direcciones del alta de viviendas son
de prueba: escribe, por ejemplo, «Gran Vía» y elige una sugerencia.

### Hacerte admin

Regístrate en la app y ejecuta:

```bash
pnpm admin:grant tu@email.com
```

Cierra la app y vuelve a abrirla para ver la pestaña «Administración».

## Probar en tu móvil (misma Wi-Fi)

La app usa el SDK de Firebase para JavaScript, así que funciona en **Expo Go**,
que es gratis en App Store y Google Play. Expo Go debe ser compatible con el SDK
58.

1. Apunta los `.env` a la IP del PC en la Wi-Fi:

   ```bash
   pnpm lan:env               # detecta la IP; o pnpm lan:env 192.168.1.40
   ```

   Rellena la IP en estos ficheros:
   - `apps/mobile/.env`: URL de la API, enlaces legales y emuladores de Auth y
     Firestore;
   - `services/api/.env`: `FAKE_GCS_HOST`;
   - `.env` de la raíz: `FAKE_GCS_PUBLIC_HOST`, el host con el que el
     almacenamiento publica las fotos.

2. Reinicia lo que lee esos valores: `pnpm infra:up`, `pnpm emulators` y
   `pnpm dev`.
3. Escanea el QR que muestra `pnpm dev` (Expo): en Android, con Expo Go; en
   iPhone, con la cámara.

Para volver a usar solo el PC: `pnpm lan:env --reset`, y reinicia igual.

### Si el móvil no conecta

- El móvil y el PC deben estar en la **misma red**, sin el aislamiento de
  clientes de algunas Wi-Fi de invitados.
- El **cortafuegos de Windows** debe permitir los puertos. Ejecuta en
  PowerShell como administrador:

  ```powershell
  New-NetFirewallRule -DisplayName "ChangeHouse local" -Direction Inbound -Protocol TCP -LocalPort 8080,8081,8085,9099,4321,4443,4000 -Action Allow -Profile Private
  ```

  La red Wi-Fi debe estar marcada como **privada** en Windows.
- Comprueba desde el navegador del móvil que la API responde: `http://<IP>:8080/v1/me`
  debe devolver un error 401 en JSON (sin sesión). Si no carga, el problema es la red o el cortafuegos.

### Qué no funciona en Expo Go

- **Avisos push**: Expo Go no los admite en Android. El resto de la app sí
  funciona.
- **Acceso con Google y con Apple**: necesitan identificadores reales. En local
  usa email y contraseña.

## Probar como lo haría alguien de fuera

- **E2E de la app web**: `pnpm --filter @changehouse/mobile test:e2e`. Levanta
  su propio entorno con una base de datos aparte, `changehouse_e2e`.
- **E2E de la landing**: `pnpm --filter @changehouse/landing test:e2e`.
