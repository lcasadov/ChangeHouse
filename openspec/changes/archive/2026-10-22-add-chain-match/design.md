# Design

## Context

`add-direct-match` detecta ciclos de 2 en la transacción del «Me gusta» con el
puerto `CycleCandidates`, valida en `domain/matching/cycle.ts` (ya preparado
para ciclos de n) y crea el match con `cycle_key` única y bloqueo del par.
Algoritmo de referencia en README §11. Motivación en `proposal.md`.

## Decisions

- **Consulta de ciclos de 3** en el adaptador: desde el nuevo like X→Y, buscar
  `Y→Z` y `Z→X` con `likes` (índices por origen y por destino), con X, Y y Z
  publicadas y de tres propietarios distintos (un usuario no puede ocupar dos
  eslabones). Devuelve listas ordenadas `[X, Y, Z]`; el dominio valida y
  calcula compensaciones sin cambios. Longitud máxima 3: no hay recursión.
- **Prioridad cuando un like cierra varios ciclos**: primero el directo (si es
  aceptable); si no, el primer ciclo de 3 aceptable por orden de antigüedad
  del like más reciente del ciclo. Se crea como mucho un match por like; los
  demás ciclos se detectarán con likes posteriores. Un like que crea un
  directo no crea además una cadena con las mismas viviendas.
- **Concurrencia**: además del bloqueo del par, se bloquean (advisory, en
  orden canónico) las tres aristas del ciclo antes de insertar el match, y
  `ON CONFLICT (cycle_key) DO NOTHING` evita duplicados. Prueba con tres likes
  simultáneos con barrera, repetida.
- **Rendimiento**: prueba de integración con 50.000 viviendas y un grafo de
  likes sintético denso alrededor de la vivienda probada; el caso de uso
  completo del like (con detección) < 1 s en el entorno de integración.
- **App**: la celebración muestra tres casas en triángulo con flechas de quién
  entrega a quién (fundido con «reducir movimiento»); la lista y el detalle
  muestran «Cadena de 3» y las tres viviendas en el orden del ciclo.

## Risks / Trade-offs

- [Varias cadenas posibles con un like] → se elige una de forma determinista;
  las otras siguen disponibles para likes futuros.
- [Grafo denso degenera la consulta] → límite de candidatos Z por consulta y
  prueba de volumen.
