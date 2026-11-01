# Infraestructura de ChangeHouse

## Local (lo que se usa hoy)

| Pieza | Cómo |
|---|---|
| PostgreSQL 17 + PostGIS y Cloud Storage simulado | `pnpm infra:up` (Docker Compose: PostgreSQL en el puerto 5432 y `fake-gcs-server` en el 4443, con los buckets `changehouse-photos-private` y `changehouse-photos-public` de `infra/fake-gcs`) · `pnpm infra:down` |
| Firebase Auth, Firestore, Storage | `pnpm emulators` (proyecto `demo-changehouse`, UI en http://localhost:4000). Requiere Java 11+ |
| Variables de la API | `services/api/.env.example` → copia a `services/api/.env` |

El proyecto `demo-changehouse` es un proyecto de demostración de Firebase: los
emuladores funcionan sin cuenta de Google Cloud y nada sale de la máquina.

## DES y PROD (Google Cloud + Firebase, `europe-southwest1`)

Preparado, **sin ejecutar** hasta que exista la cuenta de Google Cloud con facturación.

```bash
gcloud auth login
BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX ./infra/gcp/bootstrap.sh des
BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX ./infra/gcp/bootstrap.sh prod
```

El script es idempotente y crea: proyecto, APIs, Firebase y Firestore,
Artifact Registry, los buckets de fotos (el privado borra `originals/` y
`chat-uploads/` al día; el público permite leer cada objeto pero no listarlo, con
`roles/storage.legacyObjectReader`), Cloud SQL (PostgreSQL 17, copias diarias), contraseña en
Secret Manager, cuentas de servicio con permisos mínimos, Workload Identity
Federation limitado al repositorio y al environment de GitHub, y una alerta de
presupuesto (RNF-53). Al terminar imprime las variables que hay que dar de alta
en el GitHub Environment correspondiente.

Variables adicionales de cada Environment, que el despliegue usa para generar la
CSP de Hosting (`scripts/hosting-csp.mjs`): `API_ORIGIN` (origen de la API,
obligatoria en DES), `SENTRY_ORIGIN` y `STORAGE_PUBLIC_ORIGIN` (opcionales; la
segunda solo si las fotos se sirven desde un dominio propio).

Para que la app web pueda subir fotos al bucket privado, ejecuta el script con el
origen de la app: `APP_ORIGIN=https://<app> BILLING_ACCOUNT=… ./infra/gcp/bootstrap.sh des`.
Eso configura el CORS del bucket privado. Sin él, el script avisa y no lo configura.

Variables del servicio `api` de Cloud Run que la API exige al arrancar (se definen
en el servicio; el despliegue no las cambia): `LANDING_ORIGIN`, `APP_ORIGIN`,
`APP_PUBLIC_URL`, `STORAGE_PRIVATE_BUCKET` y `STORAGE_PUBLIC_BUCKET`. Además,
`LAUNCH_DATE` en PROD: sin ella, la lista de espera no se purga. La purga programada
corre dentro de la API (al arrancar y cada 24 h). Con `--min-instances=0` solo se
ejecuta mientras haya una instancia viva.

El Environment `PROD` debe limitarse a la rama `master` (Settings → Environments
→ PROD → Deployment branches and tags → Selected branches: `master`) y exigir
revisores. Es una configuración manual de una persona; el workflow además solo
lanza el job de PROD con `github.ref == refs/heads/master` y valida el digest de
la imagen antes de usarlo.

Terraform sustituirá estos scripts en la fase 2 (`$IAC_TOOL`).
