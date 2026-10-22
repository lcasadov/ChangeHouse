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
Artifact Registry, Cloud SQL (PostgreSQL 17, copias diarias), contraseña en
Secret Manager, cuentas de servicio con permisos mínimos, Workload Identity
Federation limitado al repositorio y al environment de GitHub, y una alerta de
presupuesto (RNF-53). Al terminar imprime las variables que hay que dar de alta
en el GitHub Environment correspondiente.

Terraform sustituirá estos scripts en la fase 2 (`$IAC_TOOL`).
