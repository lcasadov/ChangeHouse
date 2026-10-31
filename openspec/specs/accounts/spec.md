# accounts Specification

## Purpose
Cuentas de usuario de ChangeHouse: cómo una persona entra en la app, demuestra
que su email es suyo, recupera el acceso y queda dada de alta con su
consentimiento registrado.

## Requirements

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

### Requirement: Edición del perfil

Un usuario dado de alta SHALL poder consultar y editar desde la pestaña
«Perfil» su nombre visible, su municipio, su teléfono, si cumple los requisitos
de acceso a VPP y si es mayor de 65, con validación junto a cada campo y
confirmación al guardar.

#### Scenario: Guardar cambios del perfil
- **GIVEN** un usuario en su perfil
- **WHEN** cambia su municipio y marca que cumple los requisitos VPP y guarda
- **THEN** ve la confirmación y, al volver a abrir el perfil, aparecen los nuevos valores

#### Scenario: Nombre visible vacío
- **GIVEN** un usuario editando su perfil
- **WHEN** deja el nombre visible vacío o con más de 60 caracteres
- **THEN** ve el error junto al campo y no se guarda nada

#### Scenario: Teléfono con formato no válido
- **GIVEN** un usuario editando su perfil
- **WHEN** escribe un teléfono que no está en formato internacional válido
- **THEN** ve el error junto al campo con un ejemplo de formato correcto y no se guarda

#### Scenario: Cerrar sesión desde el perfil
- **GIVEN** un usuario en su perfil
- **WHEN** elige cerrar sesión y lo confirma
- **THEN** vuelve a la bienvenida

### Requirement: Privacidad del teléfono

El teléfono del usuario SHALL ser visible solo para él mismo; ninguna respuesta
de la API dirigida a otro usuario MUST incluirlo salvo que el propio usuario
lo autorice expresamente en un match (RF-03, RF-53).

#### Scenario: El teléfono no se expone
- **GIVEN** un usuario con teléfono guardado
- **WHEN** consulta su propia cuenta
- **THEN** ve su teléfono, y ninguna otra operación disponible para terceros lo devuelve

### Requirement: Eliminar la cuenta

Un usuario SHALL poder eliminar su cuenta desde la app tras confirmarlo dos
veces; el sistema SHALL anonimizar su email, nombre visible y teléfono, cerrar
sus viviendas, cerrar para todos sus matches abiertos, borrar sus dispositivos y
preferencias y darle de baja en el proveedor de identidad; SHALL conservar sus
consentimientos y las entradas de auditoría; y el email MUST quedar libre para un
registro futuro.

#### Scenario: Eliminación completa
- **GIVEN** un usuario con una vivienda publicada y un match abierto
- **WHEN** elimina su cuenta y lo confirma
- **THEN** su vivienda pasa a `closed`, el match se cierra para el otro participante, su sesión termina y no puede volver a entrar con esa cuenta

#### Scenario: Datos tras la eliminación
- **GIVEN** una cuenta eliminada
- **WHEN** se consulta lo que queda en el sistema
- **THEN** no hay email, nombre ni teléfono reconocibles, y siguen existiendo sus consentimientos con versión y fecha

#### Scenario: Doble confirmación
- **GIVEN** un usuario que pulsa «Eliminar mi cuenta»
- **WHEN** aparece la confirmación
- **THEN** se le explica qué se borra y qué se conserva, y debe escribir «ELIMINAR» para continuar

### Requirement: Exportar mis datos

Un usuario SHALL poder descargar en JSON sus datos personales —cuenta,
viviendas, preferencias, me gusta, descartes, matches en los que participa y
consentimientos— sin incluir datos personales de otros usuarios.

#### Scenario: Exportación
- **GIVEN** un usuario con viviendas y un match
- **WHEN** pide exportar sus datos
- **THEN** recibe un JSON con sus datos y, del match, solo su participación y el identificador de las otras viviendas, sin nombres, teléfonos ni direcciones ajenas
