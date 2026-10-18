---
description: "Entregable · Genera el documento de arquitectura del sistema en Word, con la plantilla de ChangeHouse: C4, datos, seguridad, ejecución, despliegue y decisiones."
argument-hint: "[contexto opcional]"
---

# Entregable · Documento de arquitectura

Redacta el **documento de arquitectura** del sistema: cómo está construido, por qué así, sobre
qué se despliega y qué garantiza. Incluye vistas C4, modelo de datos, arquitectura de
seguridad, vistas de ejecución, despliegue y decisiones registradas.

Salida: `docs/entregables/{{SISTEMA}}-Documento-Arquitectura.docx`, generado sobre la
plantilla `.claude/harness/profile/entregables/documento-arquitectura.docx`, con
diagramas renderizados y anexos.

**Antes de empezar**, lee:

- `docs/project.md` — el contrato del proyecto: `$PROJECT_NAME`, `$PROJECT_DESCRIPTION`,
  `$ARCH_STYLE`, `$LANGUAGE`, `$FRAMEWORK`, `$DB`, `$AUTH_MECHANISM`, `$DEPLOY_TARGET`,
  `$ENVIRONMENTS`, `$CI_PROVIDER` y `$QUALITY_GATE`, entre otros. Si falta un dato, para y
  pregunta.
- `docs/architecture.md`, si existe: es la documentación de trabajo del proyecto. Úsala como
  punto de partida, pero contrástala con el código.
- [Formato común de los entregables](../../harness/entregables-formato.md) — plantilla, marcadores,
  generación del Word y verificación. Es obligatorio.

## Reglas que no puedes saltarte

### 1. Verifica cada afirmación técnica contra el código

Esta es la regla que más veces se incumple y la que más daño hace. **Antes de escribir que el
sistema hace algo, localiza el código que lo hace.** En el proyecto que originó este prompt, un
borrador afirmaba cosas que resultaron falsas al comprobarlas:

| Se afirmaba | Realidad al mirar el código |
|---|---|
| «Exige token antifalsificación» | La protección estaba **desactivada** deliberadamente; el control real era otro |
| «Análisis de dependencias en la integración continua» | **No existía** ningún paso |
| «La puerta de calidad bloquea la integración» | Se publicaba sin esperar el veredicto: no bloqueaba |
| «Auditoría transversal por aspectos, en la misma transacción» | Puerto explícito, transacción propia, a mejor esfuerzo |
| «El proxy añade estas cinco cabeceras» | Solo añadía dos |

Cada una de esas frases habría llegado firmada al cliente. **Si no encuentras el código que lo
respalda, no lo escribas**: pregunta, o decláralo como pendiente.

### 2. No supongas la infraestructura

Es el segundo error caro. No des por hecho que hay contenedores, orquestador, servidor web
concreto o servicio gestionado en la nube. **Pregunta cómo se despliega realmente.** Un
capítulo de despliegue inventado obliga a reescribirlo entero.

### 3. Separa lo aprovisionado de lo previsto

En las tablas de infraestructura, una columna que diga si cada elemento **existe hoy** o está
planificado. Un sistema que aún no está en producción no puede documentarse como si lo
estuviera.

### 4. «Contenedor» en C4 no significa Docker

Si el sistema no usa contenedores, dilo expresamente en el capítulo de nivel 2 para evitar el
malentendido.

## Fase 0 — Cuestionario previo

**No empieces a redactar hasta tener estas respuestas.** Explora primero el repositorio y
responde tú mismo lo que puedas; después **presenta lo deducido y pregunta solo lo que falta**,
distinguiendo lo que no consta de lo que necesitas confirmar.

### Identificación

- Nombre del sistema, organización, clasificación, revisión y fecha.
- Roles que firman: autor, revisor técnico, arquitectura, aprobador.

### Pila tecnológica

- Lenguaje, marco y versión de cada componente.
- Gestor de dependencias y de construcción.
- Motor de base de datos y versión. ¿Es un servicio gestionado o una instalación propia?
- Bibliotecas relevantes para la arquitectura: acceso a datos, seguridad, migraciones,
  documentación de API, mensajería.

### Enfoque arquitectónico

- Estilo adoptado y **por qué**: qué alternativas se descartaron y con qué argumento.
- Organización interna del código: por capas, por módulo funcional, hexagonal.
- Reglas de dependencia entre capas o módulos.
- Atributos de calidad prioritarios y los condicionantes que los imponen.

### Despliegue — pregunta siempre, no deduzcas

- Topología real: qué nodos hay, dónde están y qué corre en cada uno.
- Servidor web o de aplicaciones concreto, con versión.
- ¿Contenedores? ¿Orquestador? ¿O despliegue directo sobre máquina?
- Cómo se publica: DNS, cortafuegos de aplicación, terminación TLS, origen de los certificados.
- Entornos existentes, dónde reside cada uno y si son accesibles desde el exterior.
- Formato del artefacto desplegado.
- ¿Está ya en producción? Si no, qué falta.

### Datos

- Estrategia de gobierno del esquema y herramienta de migraciones.
- Política de borrado: físico o lógico.
- Retención y purga: qué se borra, cuándo y qué **no** se borra.
- Copias de seguridad: quién las hace, con qué frecuencia y qué ventana de recuperación.
- Volumen esperado y crecimiento.

### Seguridad

- Mecanismo de autenticación y de gestión de sesión.
- Dónde se decide la autorización y con qué granularidad.
- Gestión de secretos: dónde viven y cómo llegan a la aplicación.
- Cabeceras de seguridad: **cuáles se aplican realmente y quién las añade**, la aplicación o
  el proxy. Verifícalo midiendo, no preguntando solo.
- Qué se audita, con qué mecanismo y si es transaccional.

### Entrega

- Herramienta de integración y entrega continua, y ramas implicadas.
- Puertas de calidad y si **bloquean** de verdad.
- Versionado de artefactos y procedimiento de reversión.

### Operación

- Observabilidad disponible: registros, métricas, alertas.
- Objetivos de disponibilidad y de tiempo de respuesta.
- Tareas programadas.

### Integraciones

- Sistemas externos, protocolo y sentido de la comunicación.
- Cuáles están activas y cuáles previstas.

### Contexto del entregable

- ¿Hay documentación de arquitectura previa que pueda estar obsoleta y deba marcarse?

## Fuentes que debes explorar

| Fuente | Qué extraer |
|---|---|
| Ficheros de construcción | Versiones reales, empaquetado, ámbitos de dependencia |
| Configuración de seguridad | Rutas protegidas, roles, sesión, cabeceras, CSRF, CORS |
| Migraciones de esquema | Tablas, claves, índices únicos, restricciones |
| Servicios de aplicación | Reglas de negocio, transacciones, invariantes |
| Especificación de la API | Recursos, códigos de error, contrato de paginación |
| Ficheros de configuración por entorno | Parámetros, perfiles, secretos referenciados |
| Definiciones de la canalización | Pasos reales, puertas, si esperan veredicto |
| Estructura de paquetes | Organización modular y dependencias entre capas |

## Estructura del documento — reprodúcela

La plantilla ya trae esta estructura montada, con el índice. Adapta los nombres, pero conserva
la numeración y el propósito de cada capítulo. Los apartados marcados como repetibles se
duplican tantas veces como haga falta, renumerando los siguientes.

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
Revisor de arquitectura
Revisor de seguridad
Revisor de operaciones
Aprobador
```

```indice
1. Visión general y decisiones arquitectónicas
   1.1 Resumen
   1.2 Alcance, supuestos y restricciones
   1.3 Drivers arquitectónicos
   1.4 Atributos de calidad prioritarios
   1.5 Enfoque arquitectónico
   1.6 Decisiones estructurales
2. Contexto del sistema (C4 — Nivel 1)
   2.1 Actores
   2.2 Sistemas externos
   2.3 Flujos de información con el exterior
3. Contenedores (C4 — Nivel 2)
   3.1 Inventario de contenedores
   3.2 Comunicación entre contenedores
   3.3 Fronteras de confianza
4. Vista lógica consolidada
5. Componentes (C4 — Nivel 3)
   5.1 Organización modular
   5.2 Anatomía de un módulo
   5.3 Reglas de dependencia
   5.4 Estructura del frontend
6. Catálogo de servicios de aplicación
7. Stack tecnológico
   7.1 Backend
   7.2 Frontend (app Expo y landing)
   7.3 Persistencia
   7.4 Entornos
   7.5 Servicios gestionados (Google Cloud y Firebase)
8. Modelo de datos
   8.1 Diagrama entidad-relación físico
   8.2 Tablas y responsabilidad
   8.3 Agregados y cardinalidades
   8.4 Modelo especial — (polimorfismo, herencia u otros; elimínalo si no hay)
   8.5 Índices, claves únicas e índices filtrados
   8.6 Estrategia de borrado lógico y retención
   8.7 Volumen, copias de seguridad y rendimiento
   8.8 Gobierno del esquema
9. Rendimiento y capacidad
   9.1 Objetivos y volumen
   9.2 Cálculo costoso — (uno por cálculo que concentre coste: detección de ciclos de emparejamiento, simulador fiscal)
   9.3 Paginación, filtrado y proyecciones
   9.4 Caché
   9.5 Limitación de frecuencia
   9.6 Riesgos de crecimiento
10. Arquitectura de seguridad
    10.1 Autenticación
    10.2 Autenticación delegada
    10.3 Gestión de la sesión
    10.4 Autorización
    10.5 Modelo de amenazas y controles OWASP Top 10 (2021)
    10.6 OWASP API Security Top 10 (2023)
    10.7 Protección frente a peticiones entre sitios, orígenes y cabeceras
    10.8 Gestión de secretos
    10.9 Trazabilidad y minimización en los registros
    10.10 Matriz de permisos técnica
    10.11 Mapeo de requisitos de seguridad a implementación
11. API REST
    11.1 Principios de diseño
    11.2 Catálogo por módulo
    11.3 Contrato de paginación
    11.4 Gestión de errores
12. Vista de runtime — flujos de ejecución
    12.1 Flujo — (una secuencia por flujo relevante)
13. Máquinas de estado del sistema
    13.1 Máquina de estados — (una por entidad con ciclo de vida)
    13.n Invariantes del sistema
14. Auditoría y trazabilidad
    14.1 Mecanismo de registro
    14.2 Contenido del registro
    14.3 Registro de accesos
    14.4 Explotación y purga
15. Observabilidad, resiliencia y continuidad
16. Arquitectura de integración
17. Gobierno de configuración
    17.1 Catálogo de parámetros
    17.2 Separación por entorno y perfiles
    17.3 Principios
18. Arquitectura de despliegue
    18.1 Topología física
    18.2 Nodos y dimensionamiento
    18.3 Artefactos desplegados
    18.4 Red, publicación y control de acceso
    18.5 Integración y entrega continua
    18.6 Umbrales de la puerta de calidad
    18.7 Artefactos, versionado y reversión
    18.8 Puesta en marcha y operación
    18.9 Comprobaciones de puesta en producción
    18.10 Publicación en las tiendas de aplicaciones
19. Calidad y verificación
    19.1 Estrategia de pruebas
    19.2 Umbrales de cobertura
    19.3 Método de desarrollo
20. Trazabilidad arquitectura ↔ requisitos
Anexo A — Decisiones arquitectónicas
Anexo B — Matriz de permisos por familia de endpoints
Anexo C — Gobierno del esquema
Anexo D — Glosario técnico
```

### Cómo redactar los capítulos que más se revisan

- **Capítulo 10.2.** Solo si hay autenticación delegada (proveedor de identidad externo). Si no la hay, dilo en una frase; no elimines el apartado.
- **Capítulo 10.5 y 10.6.** Una fila por categoría OWASP, con columnas *Riesgo*, *Control implementado* y **Estado**. La columna de estado es la que da credibilidad: si un control no está, se dice.
- **Capítulo 10.7.** Mide las cabeceras reales contra el entorno publicado y recoge lo medido, no lo pretendido.
- **Capítulo 10.11.** Tabla que cruza cada requisito de seguridad con el punto concreto del sistema que lo implementa. Es la prueba de que el capítulo no es literatura.
- **Capítulo 14.** Indica si la auditoría es transaccional o a mejor esfuerzo, y qué ocurre si falla. Documenta la cobertura real: qué acciones se auditan y cuáles no.
- **Capítulo 18.** Columna que distinga lo aprovisionado de lo previsto, y un apartado final de comprobaciones de puesta en producción, con verificaciones concretas.
- **Anexo A.** Una decisión por apartado (`ADR-01`, `ADR-02`…), con contexto, alternativas consideradas, decisión y consecuencias, incluidas las negativas. Un ADR sin consecuencias negativas no es un ADR.
- **Anexo B.** Matriz endpoint × rol, agrupada por familia.

## Diagramas

Renderiza con Mermaid:

```
mmdc -i diagrama.mmd -o diagrama.png -b white -s 3 --quiet
```

| Tipo | Cuántos | Para qué |
|---|---|---|
| Contexto C4 | 1 | Sistema, usuarios y sistemas externos |
| Contenedores C4 | 1 | Unidades desplegables y su comunicación |
| Componentes C4 | 1 | Agrupaciones de módulos y servicios transversales |
| Vista lógica | 1 | Capas y sentido de las dependencias |
| Anatomía de módulo | 1 | Estructura interna y dependencias permitidas |
| Entidad-relación físico | 1 | Tablas, claves y relaciones |
| Secuencia | 4-6 | Los flujos de ejecución relevantes |
| Diagrama de estados | 1 por entidad | Estados y transiciones |
| Despliegue | 1 | Nodos, artefactos y protocolos |
| Integración y entrega | 2 | Del cambio a la integración, y de ahí a producción |
| Cadena de seguridad | 1 | Comprobaciones que atraviesa cada petición |

### Trampas de Mermaid que te ahorrarán tiempo

- **El C4 nativo solo funciona bien en el nivel 1.** En niveles 2 y 3 las etiquetas se
  solapan: usa `flowchart` conservando la semántica C4 (contenedor, tecnología, relación).
- **`stateDiagram-v2` recorta los nombres largos.** Declara `state "Etiqueta larga" as ID`.
- **La tipografía se aplica en la raíz del bloque `init`**, no dentro de `themeVariables`.
- **`direction TB` dentro de un `subgraph` se ignora** si hay aristas que cruzan la frontera.
- **Vigila la legibilidad al ajustar a página.** Tamaño impreso aproximado:
  `font_px × ancho_final_cm ÷ ancho_natural_px ÷ 2,54 × 72`. Por debajo de 7 pt no se lee.
  Prefiere cadenas verticales estrechas a rejillas anchas, y compruébalo con un guion.

Cada figura lleva pie numerado: `Figura N. Descripción de lo que muestra.`

## Verificación específica

Además de la verificación común del [formato de los entregables](../../harness/entregables-formato.md):

- Que **cada afirmación de seguridad tenga respaldo en el código**. Revísalas una a una.
- Que la documentación previa que haya quedado obsoleta esté marcada como tal.
- Las matrices de permisos son las que más sufren el límite de columnas: agrúpalas por
  familia en varias tablas.

## Cómo informar al usuario

Al terminar, resume qué has documentado, **qué afirmaciones tuviste que corregir** al
contrastarlas con el código y qué quedó como supuesto pendiente de confirmar. Ese resumen vale
más que el recuento de páginas.


---

Contexto adicional del usuario: $ARGUMENTS
