---
description: "Entregable · Genera el documento funcional del sistema en Word, con la plantilla de ChangeHouse. Describe comportamiento observable, no implementación."
argument-hint: "[contexto opcional]"
---

# Entregable · Documento funcional

Redacta el **documento funcional** del sistema: qué hace, para quién, con qué reglas y bajo
qué restricciones. Es el documento que firma el cliente, así que describe **comportamiento
observable**, no implementación.

Salida: `docs/entregables/{{SISTEMA}}-Documento-Funcional.docx`, generado sobre la plantilla
`.claude/harness/profile/entregables/documento-funcional.docx`, con diagramas UML
renderizados y anexos.

**Antes de empezar**, lee:

- `docs/project.md` — el contrato del proyecto. De ahí salen el nombre del sistema
  (`$PROJECT_NAME`), su descripción (`$PROJECT_DESCRIPTION`), el contrato de la API
  (`$API_CONTRACT`) y la matriz de permisos (`$RBAC_MATRIX_DOC`). Si falta un dato, para y
  pregunta.
- [Formato común de los entregables](../../harness/entregables-formato.md) — plantilla, marcadores,
  generación del Word y verificación. Es obligatorio: define cómo se construye el fichero.

## Reglas que no puedes saltarte

1. **No inventes comportamiento.** Cada regla, estado, campo o permiso que escribas debe
   proceder de una fuente: el código, la especificación de la API, un documento del proyecto
   o una respuesta del usuario. Si no lo encuentras, pregunta; no lo deduzcas.
2. **Distingue lo implementado de lo previsto.** Si algo está planificado pero no construido,
   dilo expresamente y recógelo en el anexo de estado de implementación. Un documento que
   describe como existente algo que no existe es peor que uno incompleto.
3. **Escribe en lenguaje de negocio.** Nada de nombres de clase, tablas ni rutas de fichero en
   el cuerpo del documento. El lector es funcional.
4. **Sé exhaustivo con los casos límite.** Los flujos alternativos, los errores y la
   concurrencia son la parte que de verdad se consulta cuando el sistema está en producción.

## Fase 0 — Cuestionario previo

**No empieces a redactar hasta tener estas respuestas.** Antes de preguntar, explora el
repositorio y responde tú mismo todo lo que puedas: `docs/project.md`, `docs/product.md`, los
specs de OpenSpec, la especificación de la API, el modelo de datos, las rutas del frontend y
la documentación existente suelen cubrir buena parte. **Presenta al usuario lo que ya has
deducido y pregunta solo lo que falta**, señalando en cada punto si es un dato que no consta o
una confirmación de algo que has inferido.

Agrupa las preguntas así:

### Identificación

- Nombre del sistema y una línea que lo describa.
- Organización emisora y clasificación del documento.
- Revisión y fecha que deben figurar en la portada y el pie.
- Roles que firman: autor, revisor funcional, revisor técnico, aprobador.

### Propósito y alcance

- Problema que resuelve el sistema y a quién sirve.
- Objetivos funcionales, enunciados como resultados, no como funcionalidades.
- Qué queda **fuera de alcance** de forma expresa.
- Evolución prevista en fases posteriores, si la hay.

### Actores y acceso

- Perfiles de usuario y qué distingue a cada uno.
- Cómo se autentican: proveedores de identidad (Google, Apple) o credenciales propias.
- Reglas de acceso: quién ve qué y quién puede actuar sobre qué.
- Si existen restricciones que dependen del **estado** de un elemento y no solo del rol.

### Dominio funcional

- Módulos o áreas funcionales del sistema.
- Entidades de negocio y sus atributos relevantes para el usuario.
- **Estados y transiciones** de cada entidad con ciclo de vida.
- Reglas de negocio críticas, en especial las que impiden algo.
- Qué ocurre cuando dos usuarios compiten por el mismo recurso.

### Interacción

- Pantallas principales y navegación entre ellas.
- Si hay soporte multiidioma, tema claro y oscuro, o requisitos de accesibilidad.
- Canales de notificación al usuario.

### Cumplimiento

- Normativa aplicable.
- Datos personales tratados y con qué finalidad.
- Plazos de conservación.
- Qué acciones deben quedar auditadas.

### Operación

- Volumen esperado de usuarios y de datos.
- Requisitos no funcionales exigidos: disponibilidad, tiempos de respuesta, navegadores.
- Datos maestros necesarios para arrancar y cómo se crea el primer usuario.
- Integraciones con sistemas externos, indicando cuáles están activas y cuáles previstas.

### Contexto del entregable

- ¿Hay documentos previos que deban quedar alineados o marcados como obsoletos?

Cuando falte un dato y el usuario no lo tenga, **no lo rellenes**: recógelo como supuesto
explícito o como riesgo abierto en el capítulo correspondiente.

## Fuentes que debes explorar

Antes del cuestionario y durante la redacción:

| Fuente | Qué extraer |
|---|---|
| Specs consolidados de OpenSpec | Capacidades implementadas, requisitos y escenarios |
| Especificación de la API | Recursos, operaciones, campos, códigos de error, roles por operación |
| Modelo de datos o migraciones | Entidades, relaciones, restricciones únicas, campos obligatorios |
| Código de los servicios de aplicación | Reglas de negocio reales, validaciones, transiciones de estado |
| Configuración de seguridad | Qué protege cada ruta y con qué rol |
| Rutas y vistas del frontend | Mapa de pantallas y navegación por perfil |
| Ficheros de textos e idiomas | Catálogo de mensajes al usuario |
| Documentación existente | Decisiones ya tomadas; contrástala con el código, puede estar desfasada |

**Cuando el código y la documentación se contradigan, manda el código**, y hazlo constar.

## Estructura del documento — reprodúcela

La plantilla ya trae esta estructura montada, con el índice. Adapta los nombres al dominio,
pero conserva la numeración y el propósito de cada capítulo. Los apartados marcados como
repetibles se duplican tantas veces como haga falta, renumerando los siguientes.

**Preliminares** (sin numerar): `Ficha del documento` · `Histórico de versiones` ·
`Revisión y aprobación` · `Índice`.

```ficha
Título
Sistema
Organización
Ámbito
Estado
Clasificación
Revisión
Fecha
```

```aprobacion
Autor
Revisor funcional
Revisor técnico
Revisor de seguridad
Aprobador
```

```indice
1. Introducción y alcance
   1.1 Propósito del sistema
   1.2 Objetivos funcionales
   1.3 Alcance funcional
   1.4 Fuera de alcance
   1.5 Evolución prevista
   1.6 Glosario
2. Actores y control de acceso
   2.1 Perfiles de usuario
   2.2 Matriz de acceso por recurso
   2.3 Permisos por acción y restricciones por estado
   2.4 Acceso y autenticación
   2.5 Requisitos de seguridad funcional
3. Casos de uso y diagramas UML
   3.1 Catálogo de casos de uso por dominio
   3.2 Diagrama de casos de uso — (un apartado por perfil o grupo de perfiles)
   3.3 Diagrama de secuencia — (uno por flujo crítico: like y detección de match, match en cadena, paso a operación)
   3.4 Diagrama de actividad — (proceso con decisiones del usuario)
   3.5 Flujos alternativos y errores de los casos de uso críticos
   3.6 Concurrencia sobre el mismo recurso
4. Modelo de datos funcional
   4.1 Entidades principales y atributos funcionales
   4.2 Relaciones funcionales clave
   4.3 Aclaraciones conceptuales
5. Mapa funcional
   5.1 Dominios y módulos
   5.2 Reglas transversales
6. Recorridos de usuario
   6.1 Recorrido — (uno por perfil)
   6.2 Flujo de extremo a extremo — (los que cruzan varios módulos)
7. Descripción funcional de los módulos
   7.1 Módulo — (un apartado por módulo: cuentas, viviendas, descubrimiento, matching, chat, simulador fiscal, operaciones y gestorías, administración)
   7.n Detalle ampliado — (los mecanismos que concentran complejidad: emparejamiento en cadena y compensación económica)
8. Requisitos funcionales y criterios de aceptación
   8.1 Prioridad funcional por módulo
   8.2 Requisitos por módulo
9. Trazabilidad
10. Ciclos de vida de las entidades de negocio
    10.1 Ciclo de vida — (uno por entidad con estados)
    10.n Reglas de transición
11. Interfaz de usuario
    11.1 Mapa de pantallas
    11.2 Portal — (un apartado por portal o área: app móvil y web, portal de gestoría, administración, landing)
    11.3 Principios de interacción
    11.4 Accesibilidad
    11.5 Internacionalización y tema
12. Reglas de negocio críticas
13. Requisitos no funcionales
14. Integraciones externas (vista funcional)
15. Normativa y cumplimiento
    15.1 Marco aplicable
    15.2 Datos personales tratados
    15.3 Medidas funcionales de cumplimiento
    15.4 Retención
    15.5 Catálogo de acciones auditables
    15.6 Privacidad por diseño
    15.7 Fiscalidad, vivienda protegida y datos registrales
16. Plan de pruebas (resumen funcional)
    16.1 Pirámide de pruebas
    16.2 Cobertura por caso de uso crítico
    16.3 Umbral de calidad
17. Puesta en marcha y carga inicial de datos
    17.1 Datos maestros necesarios
    17.2 Alta del primer administrador
    17.3 Fases de la puesta en marcha
    17.4 Criterios de aceptación de la puesta en marcha
18. Decisiones, riesgos y supuestos
    18.1 Decisiones funcionales tomadas
    18.2 Alternativas descartadas
    18.3 Riesgos abiertos
    18.4 Supuestos
    18.5 Dependencias externas
Anexo A — Estado de implementación (no normativo)
Anexo B — Catálogo de mensajes al usuario
```

### Cómo redactar los capítulos que más se consultan

- **Capítulo 2.** La matriz de acceso es una tabla recurso × perfil. Añade aparte los permisos que dependen del estado: «solo puede cancelarla mientras esté pendiente» no cabe en una matriz de roles.
- **Capítulo 7.** Cada módulo con la misma plantilla: propósito, quién lo usa, qué puede hacer, reglas que lo gobiernan, validaciones, y qué ocurre cuando algo falla.
- **Capítulo 8.** Requisitos identificados `RF-XX-nn`, con criterios de aceptación verificables. Nada de «el sistema debe ser rápido».
- **Capítulo 9.** Tabla que cruza requisito ↔ caso de uso ↔ módulo ↔ prueba.
- **Capítulo 12.** Las reglas que impiden algo, numeradas y enunciadas como invariantes.
- **Anexo A.** Estado real de cada módulo. Es el capítulo que evita malentendidos en la entrega, y el único donde puedes decir «esto todavía no está».

## Diagramas

Genera los diagramas con Mermaid y renderízalos a PNG:

```
mmdc -i diagrama.mmd -o diagrama.png -b white -s 3 --quiet
```

Catálogo mínimo, adaptado al dominio:

| Tipo | Cuántos | Para qué |
|---|---|---|
| Mapa funcional | 1 | Dominios, módulos y dependencias |
| Casos de uso | 2-3 | Uno por perfil o por grupo de casos |
| Secuencia | 2-3 | Los flujos críticos de extremo a extremo |
| Actividad | 1 | Un proceso con decisiones del usuario |
| Entidad-relación funcional | 1 | Entidades y relaciones, sin detalle físico |
| Recorrido de usuario | 1 por perfil | La jornada tipo |
| Diagrama de estados | 1 por entidad con ciclo de vida | Estados y transiciones |
| Mapa de pantallas | 1 | Navegación por rol |

### Trampas de Mermaid que te ahorrarán tiempo

- **`stateDiagram-v2` recorta los nombres largos.** Declara `state "Etiqueta larga" as ID`.
- **La tipografía se aplica en la raíz del bloque `init`**, no dentro de `themeVariables`.
  Si solo la pones ahí, los diagramas de estados la ignoran.
- **`direction TB` dentro de un `subgraph` se ignora** si hay aristas que cruzan la frontera.
  No sirve para maquetar columnas.
- **Vigila la legibilidad al ajustar a página.** El tamaño impreso aproximado es
  `font_px × ancho_final_cm ÷ ancho_natural_px ÷ 2,54 × 72`. Por debajo de 7 pt no se lee.
  Los diagramas anchos pierden legibilidad: prefiere cadenas verticales estrechas a rejillas.
- Comprueba ese cálculo con un guion antes de dar los diagramas por buenos.

Cada figura lleva pie numerado: `Figura N. Descripción de lo que muestra.`

## Verificación específica

Además de la verificación común del [formato de los entregables](../../harness/entregables-formato.md),
comprueba que todo lo descrito como existente esté realmente construido, y que el anexo de
estado de implementación diga lo mismo que el cuerpo.

## Cómo informar al usuario

Al terminar, resume qué has documentado, **qué has tenido que dejar como supuesto** y qué
contradicciones encontraste entre el código y la documentación previa. Los huecos declarados
valen más que los rellenos a ojo.


---

Contexto adicional del usuario: $ARGUMENTS
