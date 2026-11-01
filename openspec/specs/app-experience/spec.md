# app-experience Specification

## Purpose
Experiencia visual transversal de la app: la fotografía de ambiente que recibe a
quien llega, la navegación principal, los avisos persistentes y los estados
vacíos, en los dos temas y con la accesibilidad de WCAG 2.2 AA.

## Requirements

### Requirement: Fotografía de ambiente en la bienvenida y el acceso

La bienvenida SHALL ocupar toda la pantalla con fotografías de viviendas que se
suceden con un fundido lento, bajo un velo que mantenga el contraste del texto.
El acceso y la recuperación de la contraseña SHALL mostrar una fotografía de
ambiente. Las fotografías SHALL ser decorativas para los lectores de pantalla y
SHALL quedarse fijas con «reducir movimiento».

#### Scenario: Bienvenida con fotografía
- **GIVEN** una persona sin sesión que abre la app
- **WHEN** se muestra la bienvenida
- **THEN** ve una fotografía a pantalla completa, el titular y los botones de crear cuenta y entrar, legibles en los dos temas

#### Scenario: Movimiento reducido
- **GIVEN** un dispositivo con «reducir movimiento» activado
- **WHEN** se muestra la bienvenida
- **THEN** se ve una sola fotografía fija y no hay fundidos ni zoom

#### Scenario: Acceso en web ancha
- **GIVEN** la pantalla de acceso en una ventana de al menos 1024 px de ancho
- **WHEN** se muestra
- **THEN** el formulario ocupa una columna y la fotografía de ambiente la otra

### Requirement: Navegación principal legible

La navegación principal (pestañas inferiores y barra lateral) SHALL marcar la
sección activa con un fondo suave del tema, su icono relleno y su texto en el
color de acción. El texto SHALL mantener al menos 4,5:1 de contraste sobre ese
fondo en los dos temas. El estado activo SHALL anunciarse a los lectores de
pantalla.

#### Scenario: Sección activa en la barra lateral
- **GIVEN** la app en web ancha con la sección «Explorar» abierta
- **WHEN** se mira la barra lateral
- **THEN** «Explorar» aparece con fondo suave, icono relleno y texto con contraste de al menos 4,5:1, y se anuncia como seleccionada

### Requirement: Aviso de verificación compacto

El aviso para verificar el email SHALL ocupar una sola franja compacta, con el
mensaje y sus dos acciones («Reenviar enlace» y «Ya lo he confirmado»), sin
desplazar el contenido principal más de lo imprescindible. El resultado de cada
acción SHALL anunciarse.

#### Scenario: Aviso con las dos acciones
- **GIVEN** un usuario registrado con email sin verificar
- **WHEN** abre cualquier pestaña
- **THEN** ve una franja con el mensaje y las acciones de reenviar y de comprobar, y el contenido de la pestaña sigue a la vista

### Requirement: Estados vacíos con imagen

Los estados vacíos de Explorar (sin más viviendas), Matches (sin matches) y Mis
casas (sin viviendas) SHALL mostrar una imagen de ambiente decorativa, un título,
una explicación y la acción siguiente.

#### Scenario: Sin matches
- **GIVEN** un usuario sin matches
- **WHEN** abre la pestaña «Matches»
- **THEN** ve la imagen de ambiente, el motivo y la acción para seguir explorando
