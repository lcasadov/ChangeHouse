# Spec Delta

## Purpose

Protecciones transversales de la plataforma ChangeHouse:
- cabeceras de seguridad de la web;
- reglas y almacenamiento iguales en todos los entornos;
- configuración obligatoria en la nube;
- registros sin datos personales;
- un despliegue que no ejecuta datos de entrada.

## ADDED Requirements

### Requirement: Cabeceras de seguridad de la web

La app web y la landing SHALL servirse con una `Content-Security-Policy` que solo
permita los orígenes propios, la API, Firebase, el almacenamiento de fotos y
Sentry, y que prohíba la incrustación (`frame-ancestors 'none'`). También SHALL
servirse con `X-Frame-Options: DENY`.

#### Scenario: Incrustar la app en otra página
- **GIVEN** una página de otro dominio
- **WHEN** intenta mostrar la app web en un iframe
- **THEN** el navegador lo bloquea por las cabeceras recibidas

#### Scenario: La app funciona con la política
- **GIVEN** la app web servida con la política
- **WHEN** un usuario inicia sesión, ve tarjetas con fotos y abre un chat
- **THEN** todo funciona sin violaciones de la política en la consola

### Requirement: Reglas y almacenamiento desplegados en todos los entornos

Las reglas de Firestore y de Storage SHALL desplegarse en cada entorno (DES y
PROD) junto con la versión que se despliega. Los buckets de fotos SHALL crearse
por script con estas condiciones:
- los originales y las subidas del chat se borran automáticamente al día;
- el bucket público permite leer cada objeto pero MUST NOT permitir listar su
  contenido de forma anónima.

#### Scenario: Listado anónimo del bucket público
- **GIVEN** el bucket público de un entorno
- **WHEN** un cliente sin credenciales intenta listar su contenido
- **THEN** recibe un error de acceso, aunque puede leer una foto publicada por su URL

#### Scenario: Reglas en PROD
- **GIVEN** una promoción a PROD
- **WHEN** termina el despliegue
- **THEN** las reglas de Firestore y Storage de PROD son las del repositorio en esa versión

### Requirement: Configuración y registros seguros

En la nube la API MUST NOT arrancar sin los orígenes permitidos de la landing y de
la app. Los registros MUST NOT contener datos personales: ni parámetros de
búsqueda de la URL ni el detalle de los errores de la base de datos con valores
de filas.

#### Scenario: Falta un origen en la nube
- **GIVEN** la API en Cloud Run sin el origen de la app configurado
- **WHEN** arranca
- **THEN** falla al arrancar indicando la variable que falta

#### Scenario: Búsqueda de usuarios en los registros
- **GIVEN** un admin que busca usuarios por un prefijo de email
- **WHEN** se registra la petición
- **THEN** el registro contiene la ruta sin el texto buscado

### Requirement: Despliegue sin inyección

El workflow de despliegue MUST NOT interpolar datos de entrada en comandos. La
imagen que se promociona a PROD SHALL validarse contra el registro y el formato
de digest esperados antes de usarse, y la promoción a PROD SHALL permitirse solo
desde la rama de producción. Las acciones de terceros de los workflows SHALL
fijarse por SHA.

#### Scenario: Digest manipulado
- **GIVEN** una promoción a PROD lanzada a mano
- **WHEN** el campo de la imagen contiene texto que no es un digest del registro de DES
- **THEN** el workflow falla antes de desplegar nada
