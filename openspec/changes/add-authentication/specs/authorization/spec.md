# Spec Delta

## Purpose

Control de acceso de la API de ChangeHouse: quién es quien hace cada petición y
qué puede hacer, decidido siempre en el servidor y denegado por defecto.

## ADDED Requirements

### Requirement: Autenticación de las peticiones

La API SHALL verificar el ID token de Firebase de cada petición a una operación
protegida y SHALL responder 401 en formato `Problem`, sin detallar el motivo,
cuando falta, es inválido o ha caducado; MUST NOT registrar el token.

#### Scenario: Petición sin token
- **GIVEN** una operación protegida
- **WHEN** llega una petición sin cabecera `Authorization`
- **THEN** la API responde 401 en formato `Problem` sin indicar el motivo

#### Scenario: Token caducado o manipulado
- **GIVEN** un token caducado o con la firma alterada
- **WHEN** se usa en una petición
- **THEN** la API responde 401 y el registro no contiene el token

#### Scenario: Única operación pública
- **GIVEN** la operación de alta en la lista de espera
- **WHEN** llega sin token
- **THEN** se procesa con normalidad

### Requirement: Roles y denegación por defecto

La API SHALL decidir cada operación en un único punto de autorización a partir
del rol del usuario —`seeker` u `owner`, derivados de si tiene vivienda
publicada; `agency` o `admin`, asignados— y de su relación con el recurso;
toda operación sin regla explícita MUST denegarse; y la decisión SHALL coincidir
celda a celda con `docs/rbac-matrix.md`.

#### Scenario: Operación sin regla
- **GIVEN** una operación de la API sin regla en la política de autorización
- **WHEN** cualquier usuario autenticado la invoca
- **THEN** la API la deniega

#### Scenario: Endpoint de administración sin el rol
- **GIVEN** un usuario con rol `seeker` u `owner`
- **WHEN** invoca una operación `/admin/*`
- **THEN** recibe 403 en formato `Problem` y queda registrada la denegación con su `correlationId`

#### Scenario: La matriz se cumple entera
- **GIVEN** la matriz de permisos como datos (operación, actor, resultado esperado)
- **WHEN** se ejecuta la prueba que la recorre
- **THEN** cada operación implementada devuelve el resultado esperado para cada actor, y una operación implementada sin filas hace fallar la prueba

#### Scenario: El cliente no fija roles
- **GIVEN** un usuario autenticado
- **WHEN** envía en su alta un campo de rol o de estado
- **THEN** la API lo rechaza con 400 y su rol no cambia
