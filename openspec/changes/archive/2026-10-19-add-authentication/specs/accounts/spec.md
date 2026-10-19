# Spec Delta

## Purpose

Cuentas de usuario de ChangeHouse: cómo una persona entra en la app, demuestra
que su email es suyo, recupera el acceso y queda dada de alta con su
consentimiento registrado.

## ADDED Requirements

### Requirement: Registro e inicio de sesión

La app SHALL permitir registrarse e iniciar sesión con email y contraseña, con
Google y con Apple, desde una única pantalla de acceso, y SHALL mantener la
sesión iniciada entre aperturas hasta que el usuario la cierre.

#### Scenario: Registro con email y contraseña
- **GIVEN** una persona sin cuenta en la pantalla de acceso
- **WHEN** introduce un email válido y una contraseña de al menos 8 caracteres y confirma
- **THEN** se crea su cuenta, queda con la sesión iniciada y pasa al alta en ChangeHouse

#### Scenario: Contraseña demasiado corta
- **GIVEN** la pantalla de registro
- **WHEN** la persona introduce una contraseña de menos de 8 caracteres
- **THEN** ve el error junto al campo y no se crea ninguna cuenta

#### Scenario: Credenciales incorrectas
- **GIVEN** una cuenta existente
- **WHEN** alguien intenta entrar con una contraseña errónea
- **THEN** ve un mensaje que no revela si el email existe y puede reintentar o recuperar la contraseña

#### Scenario: Acceso con Google o Apple
- **GIVEN** la pantalla de acceso con los proveedores configurados
- **WHEN** la persona elige Google o Apple y completa el proveedor
- **THEN** queda con la sesión iniciada; si es su primer acceso, pasa al alta en ChangeHouse

#### Scenario: Sesión recordada
- **GIVEN** un usuario con la sesión iniciada
- **WHEN** cierra la app y la vuelve a abrir
- **THEN** entra directamente a las pestañas sin volver a identificarse

#### Scenario: Cerrar sesión
- **GIVEN** un usuario con la sesión iniciada
- **WHEN** elige cerrar sesión
- **THEN** vuelve a la pantalla de bienvenida y las pestañas dejan de ser accesibles

### Requirement: Verificación del email y recuperación de la contraseña

La app SHALL enviar un enlace de verificación al registrarse con email y SHALL
ofrecer la recuperación de la contraseña por email, sin revelar si una
dirección tiene cuenta.

#### Scenario: Aviso de email sin verificar
- **GIVEN** un usuario registrado con email que aún no lo ha verificado
- **WHEN** entra en la app
- **THEN** ve un aviso con la opción de reenviar el enlace de verificación

#### Scenario: Recuperar la contraseña
- **GIVEN** la pantalla de acceso
- **WHEN** la persona pide recuperar la contraseña para un email
- **THEN** ve siempre el mismo mensaje de confirmación, exista o no la cuenta

### Requirement: Alta en ChangeHouse con consentimiento

En el primer acceso, el sistema SHALL dar de alta al usuario en ChangeHouse con
su nombre visible y SHALL exigir la aceptación de las versiones vigentes de los
términos y de la política de privacidad, registrando versión y fecha de cada
una (RF-04).

#### Scenario: Primer acceso completo
- **GIVEN** una persona autenticada que aún no está dada de alta
- **WHEN** indica su nombre visible y acepta términos y privacidad
- **THEN** queda dada de alta, se registran los dos consentimientos con su versión y fecha, y entra en las pestañas

#### Scenario: Sin aceptar los textos legales
- **GIVEN** una persona autenticada en su primer acceso
- **WHEN** intenta continuar sin aceptar términos o privacidad
- **THEN** no se completa el alta y se le indica qué falta aceptar

#### Scenario: Alta repetida
- **GIVEN** un usuario ya dado de alta
- **WHEN** la app vuelve a enviar su alta
- **THEN** no se crea un segundo usuario y se actualizan solo los datos enviados

### Requirement: Consulta de la propia cuenta y de los consentimientos

Un usuario autenticado SHALL poder consultar su cuenta —nombre visible, email,
roles y si tiene vivienda publicada— y la lista de consentimientos que ha
aceptado, y SHALL poder aceptar nuevas versiones.

#### Scenario: Consultar la propia cuenta
- **GIVEN** un usuario dado de alta sin viviendas
- **WHEN** consulta su cuenta
- **THEN** recibe su nombre visible, su email, el rol `seeker` y `hasPublishedHome` en falso

#### Scenario: Aceptar una nueva versión de la privacidad
- **GIVEN** un usuario que aceptó la versión anterior de la privacidad
- **WHEN** acepta la versión nueva
- **THEN** su lista de consentimientos conserva la anterior y añade la nueva con su fecha
