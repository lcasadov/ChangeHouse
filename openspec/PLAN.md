# Plan del proyecto

Estado de los changes de OpenSpec de ChangeHouse. La zona curada la mantienen las
personas; la zona generada la reescribe `plan-sync` en cada operación.

## Plan curado

| change | fase | prerrequisitos | notas |
|---|---|---|---|
| add-landing | B · Captación | plataforma (#8–#16) | Fase 0 |
| add-waitlist | B · Captación | add-landing | Primer uso de API y base de datos |
| add-authentication | C · Primer match | plataforma | Autorización centralizada y matriz RBAC |
| add-user-profile | C · Primer match | add-authentication | |
| add-home-listing | C · Primer match | add-user-profile | Varias viviendas, ubicación exacta o zona |
| add-home-photos | C · Primer match | add-home-listing | |
| add-home-moderation | C · Primer match | add-home-listing | |
| add-search-preferences | C · Primer match | add-user-profile | Por usuario y por vivienda |
| add-discovery-feed | C · Primer match | add-search-preferences, add-home-moderation | |
| add-like-dismiss-undo | C · Primer match | add-discovery-feed | Límite de 10 al día |
| add-direct-match | C · Primer match | add-like-dismiss-undo | Mayor riesgo técnico |
| add-match-details-and-decisions | C · Primer match | add-direct-match | Hito: primer match de principio a fin |
| add-chain-match | D · MVP | add-direct-match | < 1 s con 50.000 viviendas |
| add-match-chat | D · MVP | add-direct-match | Firestore |
| add-notifications | D · MVP | add-match-chat | Push y email |
| add-home-vpp-regime | D · MVP | add-home-listing | |
| add-home-pause-resume | D · MVP | add-home-moderation | |
| add-account-deletion-and-export | D · MVP | add-user-profile | RGPD y tiendas |
| add-reports-and-blocking | D · MVP | add-match-chat | |
| add-user-suspension | D · MVP | add-reports-and-blocking | |
| add-admin-panel | D · MVP | add-home-moderation, add-waitlist | Incluye exportación de la lista de espera |
| add-landing-blog | D · MVP | add-landing | Prioridad baja |
| harden-security-before-launch | E · Lanzamiento | MVP completo | Hallazgos de la auditoría de seguridad; bloquea el primer despliegue |

<!-- catalogo:generado:inicio -->

## Estado (generado)

| change | estado | % | completadas/total | fase |
|---|---|---|---|---|


**Progreso global de los changes activos**: 0/0 (0 %)

| estado | changes |
|---|---|
| ✅ ARCHIVADO | 23 |

### Changes archivados

| change | tareas | fecha |
|---|---|---|
| 2026-10-19-add-authentication | 13/13 | 2026-10-19 |
| 2026-10-19-add-discovery-feed | 9/9 | 2026-10-19 |
| 2026-10-19-add-home-listing | 11/11 | 2026-10-19 |
| 2026-10-19-add-home-moderation | 6/6 | 2026-10-19 |
| 2026-10-19-add-home-photos | 8/8 | 2026-10-19 |
| 2026-10-19-add-landing | 12/12 | 2026-10-19 |
| 2026-10-19-add-search-preferences | 7/7 | 2026-10-19 |
| 2026-10-19-add-user-profile | 6/6 | 2026-10-19 |
| 2026-10-19-add-waitlist | 12/12 | 2026-10-19 |
| 2026-10-22-add-chain-match | 7/7 | 2026-10-22 |
| 2026-10-22-add-direct-match | 8/8 | 2026-10-22 |
| 2026-10-22-add-home-vpp-regime | 5/5 | 2026-10-22 |
| 2026-10-22-add-like-dismiss-undo | 7/7 | 2026-10-22 |
| 2026-10-22-add-match-details-and-decisions | 7/7 | 2026-10-22 |
| 2026-10-23-add-home-pause-resume | 5/5 | 2026-10-23 |
| 2026-10-23-add-landing-blog | 5/5 | 2026-10-23 |
| 2026-10-30-add-match-chat | 8/8 | 2026-10-30 |
| 2026-10-31-add-account-deletion-and-export | 6/6 | 2026-10-31 |
| 2026-10-31-add-admin-panel | 5/5 | 2026-10-31 |
| 2026-10-31-add-notifications | 7/7 | 2026-10-31 |
| 2026-10-31-add-reports-and-blocking | 6/6 | 2026-10-31 |
| 2026-10-31-add-user-suspension | 5/5 | 2026-10-31 |
| 2026-11-01-harden-security-before-launch | 17/17 | 2026-11-01 |

<!-- catalogo:generado:fin -->
