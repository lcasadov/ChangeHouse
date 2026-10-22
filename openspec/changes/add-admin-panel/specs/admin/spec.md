# Spec Delta

## Purpose

Herramientas del equipo de ChangeHouse para seguir la salud del producto y
gestionar usuarios y captación, con acceso exclusivo del rol `admin`.

## ADDED Requirements

### Requirement: Métricas del producto

Un admin SHALL consultar para un periodo las altas, las viviendas publicadas por
barrio o zona, los me gusta, los matches directos y en cadena y las
operaciones; un periodo con fecha final anterior a la inicial MUST rechazarse.

#### Scenario: Métricas de un mes
- **GIVEN** datos de actividad en octubre
- **WHEN** un admin consulta del 1 al 31 de octubre
- **THEN** ve los totales del periodo y las viviendas publicadas agrupadas por zona

#### Scenario: Periodo invertido
- **GIVEN** un admin en el panel
- **WHEN** pide del 31 al 1 de octubre
- **THEN** la API responde 400 y la app señala las fechas

### Requirement: Gestión de usuarios

Un admin SHALL buscar usuarios por email o nombre visible, paginados, y ver su
estado (activo o suspendido) con acceso a suspenderlos o reactivarlos.

#### Scenario: Buscar un usuario
- **GIVEN** un usuario con email «ana@example.com»
- **WHEN** un admin busca «ana@»
- **THEN** aparece en los resultados con su estado

### Requirement: Consulta de la auditoría

Un admin SHALL consultar el registro de auditoría paginado, del más reciente al
más antiguo, sin poder modificarlo.

#### Scenario: Ver la auditoría
- **GIVEN** moderaciones y suspensiones realizadas
- **WHEN** un admin abre la auditoría
- **THEN** ve cada acción con su autor, entidad y fecha, sin opciones de edición

### Requirement: Lista de espera para el equipo

Un admin SHALL consultar la lista de espera filtrando por municipio y SHALL
exportarla en CSV; ningún otro rol MUST acceder a ella.

#### Scenario: Exportar la lista de espera
- **GIVEN** inscripciones en la lista de espera
- **WHEN** un admin la exporta en CSV
- **THEN** obtiene un fichero con email, municipio, tipo de vivienda, qué busca y fecha de consentimiento

#### Scenario: Sin rol de administración
- **GIVEN** un usuario `owner`
- **WHEN** intenta consultar la lista de espera
- **THEN** la API responde 403
