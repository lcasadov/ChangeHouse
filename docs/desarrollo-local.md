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
pnpm emulators       # en otra terminal: Auth, Firestore y Storage (consola en http://localhost:4000)
pnpm dev             # en otra terminal: API (8080), app web (8081) y landing (4321)
```

Abre la app en `http://localhost:8081`. Las direcciones del alta de viviendas son
de prueba, sin Google. Escribe una de estas y elige la sugerencia:
- en Madrid: «Malasaña», «Chamberí», «Retiro» o «Lavapiés»;
- fuera de Madrid: «Alcalá» o «Getafe».

Los emuladores guardan sus datos en `.emulator-data/` al pararlos con **Ctrl+C** y
los recuperan al arrancar. Si los cierras de otra forma, se pierden las cuentas de
Auth pero los usuarios siguen en PostgreSQL. `pnpm seed:demo` repara las cuentas de
prueba; para las tuyas, borra la base de datos (`docker compose down -v`,
`pnpm infra:up` y `pnpm db:migrate`).

## Datos de prueba

Con todo arrancado, ejecuta:

```bash
pnpm seed:demo
```

Crea, a través de la API real, siete personas con su vivienda publicada. Cada
vivienda lleva 4 fotos que pasan por la subida y el procesado reales: la fachada
(según el tipo de vivienda), el salón, la cocina y el dormitorio, con la paleta y
la hora del día propias de cada persona. Se puede repetir sin duplicar nada. La
contraseña de todas las cuentas es `demo-1234`.

Si tus casas de prueba se crearon antes del 1 de noviembre de 2026, tienen los
dibujos antiguos. Para ver las fotos nuevas, vuelve al estado inicial (al final
de «Pruebas manuales») y repite la semilla.

| Cuenta | Vivienda | Valor | ¿Te ha dado «me gusta»? |
|---|---|---|---|
| `yo@demo.changehouse.test` | Piso en Malasaña | 240.000 € | Es tu cuenta |
| `lucia@demo.changehouse.test` | Ático en Chamberí | 260.000 € | Sí |
| `marcos@demo.changehouse.test` | Adosado en Alcalá de Henares | 230.000 € | Sí |
| `carmen@demo.changehouse.test` | Dúplex en Retiro | 250.000 € | Sí |
| `javier@demo.changehouse.test` | Estudio en Lavapiés | 180.000 € | No |
| `elena@demo.changehouse.test` | Chalet en Getafe | 300.000 € | No |
| `pablo@demo.changehouse.test` | Bajo en Malasaña | 210.000 € | No |
| `admin@demo.changehouse.test` | — (administrador) | — | — |

Todas buscan en Madrid, Alcalá de Henares y Getafe, y aceptan pagar hasta
150.000 € de diferencia, así que todas se ven entre sí en Explorar.

## Pruebas manuales

Para hacer de dos personas a la vez, usa dos navegadores, o uno normal y otro en
modo incógnito, o el PC y el móvil.

### 1. Match directo (una sola cuenta)

1. Entra como `yo@…`. En **Explorar** verás seis casas con fotos y la compensación
   estimada («Tú recibes», «Tú pagas» o «Cambio justo»).
2. En el filtro **Tipo**, elige «Ático» para que solo salga la casa de Lucía, y pulsa
   **Me gusta**. Como Lucía ya te lo había dado, aparece «¡Tenéis un match!». Repite
   con «Adosado» (Marcos) y «Dúplex» (Carmen).
3. En **Matches**, abre el match. Comprueba que ves la otra vivienda y que tu
   vivienda aparece en el intercambio.
4. Pulsa **Confirmar interés**. Para que el match quede confirmado tiene que
   confirmar también Lucía: entra como `lucia@…` en el otro navegador.
5. **Abrir chat**: envía mensajes de texto y una imagen desde los dos lados.
   Comprueba que llegan al momento y que no salen duplicados.
6. Activa **Compartir mi teléfono en este match** (antes ponlo en **Perfil**).
   Comprueba que Lucía lo ve, y que deja de verlo cuando lo desactivas.
7. Pulsa **Retirarme** en el match de Marcos o de Carmen y comprueba que desaparece
   para las dos partes.

### 2. Match entre dos personas (dos navegadores)

1. Navegador A: `yo@…`. Navegador B: `javier@…`.
2. En A, filtra por el tipo «Estudio» y da **Me gusta** a la casa de Javier. Todavía
   no hay match («Me gusta enviado»).
3. En B, Javier filtra por el tipo «Piso» y da **Me gusta** a tu casa. Aparece
   «¡Tenéis un match!» y el match sale en **Matches** de las dos cuentas.
4. Prueba también **Descartar** y **Deshacer** con Elena o Pablo.
5. El límite es de 10 «me gusta» al día por persona. Si lo agotas, recibirás el aviso
   del límite.

### 3. Alta de una vivienda tuya con fotos

1. Como `yo@…`, ve a **Mis casas** → **Añadir otra casa**. En la dirección escribe
   «Retiro» y elige la sugerencia.
2. Rellena los datos y pulsa **Añadir fotos**: sube al menos 3 fotos tuyas, de la
   galería en el móvil o de un archivo en el PC.
3. Pulsa **Enviar a revisión**. La casa queda «En revisión».
4. Entra como `admin@…` y ve a **Administración**. Aprueba la casa, o recházala
   con un motivo. Vuelve a `yo@…` y comprueba el estado.
5. Con la casa publicada, **Pausar** la oculta de Explorar para los demás.

### 4. Seguridad y moderación

1. En un match o en Explorar, **Denunciar** a Pablo y luego **Bloquear** a Pablo. Ya
   no os veis.
2. Como `admin@…`, en **Administración**, revisa la denuncia y usa **Suspender o
   reactivar** con Pablo.
3. Entra como `pablo@…`: verás la pantalla de cuenta suspendida.
4. En **Perfil** de cualquier cuenta, descarga tus datos y elimina la cuenta. Lo
   mejor es hacerlo con una cuenta nueva, no con las de prueba.

Para volver al estado inicial:
1. Para los emuladores.
2. Ejecuta `docker compose down -v` y borra `.emulator-data/`.
3. Ejecuta `pnpm infra:up` y `pnpm db:migrate`.
4. Arranca los emuladores y ejecuta `pnpm seed:demo`.

### Imágenes y vídeo de prueba

Las fotos de las casas de prueba, las imágenes de ambiente de la app
(`apps/mobile/assets/ambient/`) y las de la landing, con el vídeo de fondo del
héroe (`apps/landing/public/media/`), salen de un mismo generador
(`scripts/media/`). Son escenas dibujadas por código: deterministas y sin
licencias de terceros.

Están versionadas; solo hace falta regenerarlas al cambiar una escena:

```bash
pnpm media:generate             # imágenes y vídeo (graba el vídeo con el Chromium de Playwright)
pnpm media:generate --sin-video # solo las imágenes
```

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
