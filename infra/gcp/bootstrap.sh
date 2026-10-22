#!/usr/bin/env bash
# Crea un entorno de ChangeHouse en Google Cloud + Firebase. Idempotente: se puede repetir.
#   ./infra/gcp/bootstrap.sh des    (o prod)
# Requisitos: gcloud autenticado (`gcloud auth login`), una cuenta de facturación
# y las variables BILLING_ACCOUNT y BUDGET_EUR (por defecto 50).
set -euo pipefail

ENV="${1:?uso: bootstrap.sh des|prod}"
case "$ENV" in des|prod) ;; *) echo "Entorno no válido: $ENV" >&2; exit 2 ;; esac

PROJECT="changehouse-${ENV}"
REGION="europe-southwest1"           # Madrid (RNF-10)
REPO_GITHUB="lcasadov/ChangeHouse"
BILLING_ACCOUNT="${BILLING_ACCOUNT:?define BILLING_ACCOUNT (gcloud billing accounts list)}"
BUDGET_EUR="${BUDGET_EUR:-50}"
SQL_INSTANCE="changehouse-${ENV}-pg"
SQL_TIER="${SQL_TIER:-db-f1-micro}"

echo "== Proyecto ${PROJECT}"
gcloud projects describe "$PROJECT" >/dev/null 2>&1 || gcloud projects create "$PROJECT" --name="ChangeHouse ${ENV^^}"
gcloud billing projects link "$PROJECT" --billing-account="$BILLING_ACCOUNT"
gcloud config set project "$PROJECT" >/dev/null

echo "== APIs"
gcloud services enable \
  run.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  firebase.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com \
  storage.googleapis.com fcm.googleapis.com cloudbuild.googleapis.com \
  billingbudgets.googleapis.com logging.googleapis.com

echo "== Firebase"
firebase projects:addfirebase "$PROJECT" >/dev/null 2>&1 || true
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 || \
  gcloud firestore databases create --location="$REGION" --type=firestore-native

echo "== Artifact Registry"
gcloud artifacts repositories describe changehouse --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create changehouse --repository-format=docker --location="$REGION"

echo "== Cloud SQL (PostgreSQL 17)"
gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1 || \
  gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_17 --region="$REGION" \
    --tier="$SQL_TIER" --storage-auto-increase --backup-start-time=03:00 --availability-type=zonal
gcloud sql databases describe changehouse --instance="$SQL_INSTANCE" >/dev/null 2>&1 || \
  gcloud sql databases create changehouse --instance="$SQL_INSTANCE"
if ! gcloud secrets describe db-password >/dev/null 2>&1; then
  PASS="$(openssl rand -base64 32)"
  gcloud sql users create changehouse --instance="$SQL_INSTANCE" --password="$PASS"
  printf '%s' "$PASS" | gcloud secrets create db-password --data-file=- --replication-policy=user-managed --locations="$REGION"
fi
# PostGIS se crea en la primera migración (CREATE EXTENSION postgis).

echo "== Cuentas de servicio"
for SA in api deployer; do
  gcloud iam service-accounts describe "${SA}@${PROJECT}.iam.gserviceaccount.com" >/dev/null 2>&1 || \
    gcloud iam service-accounts create "$SA" --display-name="ChangeHouse ${SA}"
done
API_SA="api@${PROJECT}.iam.gserviceaccount.com"
DEPLOY_SA="deployer@${PROJECT}.iam.gserviceaccount.com"
for ROLE in roles/cloudsql.client roles/secretmanager.secretAccessor roles/datastore.user roles/firebaseauth.viewer roles/storage.objectAdmin roles/firebasecloudmessaging.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:${API_SA}" --role="$ROLE" --condition=None >/dev/null
done
for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser roles/firebasehosting.admin roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:${DEPLOY_SA}" --role="$ROLE" --condition=None >/dev/null
done

echo "== Workload Identity Federation para GitHub Actions"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
gcloud iam workload-identity-pools describe github --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe github --workload-identity-pool=github --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc github --workload-identity-pool=github --location=global \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment" \
    --attribute-condition="assertion.repository=='${REPO_GITHUB}' && assertion.environment=='${ENV^^}'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO_GITHUB}" >/dev/null

echo "== Alerta de presupuesto (${BUDGET_EUR} EUR)"
gcloud billing budgets list --billing-account="$BILLING_ACCOUNT" --format='value(displayName)' | grep -qx "changehouse-${ENV}" || \
  gcloud billing budgets create --billing-account="$BILLING_ACCOUNT" --display-name="changehouse-${ENV}" \
    --budget-amount="${BUDGET_EUR}EUR" --filter-projects="projects/${PROJECT}" \
    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0

cat <<OUT

Entorno ${ENV^^} listo. Configura en GitHub (Settings → Environments → ${ENV^^}) estas variables:
  GCP_PROJECT_ID              = ${PROJECT}
  GCP_REGION                  = ${REGION}
  GCP_WORKLOAD_IDENTITY       = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github
  GCP_DEPLOY_SERVICE_ACCOUNT  = ${DEPLOY_SA}
  GCP_API_SERVICE_ACCOUNT     = ${API_SA}
  CLOUD_SQL_INSTANCE          = ${PROJECT}:${REGION}:${SQL_INSTANCE}
OUT
