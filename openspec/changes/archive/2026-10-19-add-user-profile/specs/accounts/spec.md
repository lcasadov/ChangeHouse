# Spec Delta

## ADDED Requirements

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
