# Paquete de movimientos musicales v3

Este documento acompaña a `ui/src/features/sceneTemplates/musicMotionCatalog.ts`.
Define 24 movimientos musicales candidatos para escenas procedurales, no 24
transiciones de montaje. El catálogo y los compiladores puros ya existen en el
worktree de desarrollo; todavía faltan tests del bloque, PR, revisión, merge y
validación visual/renderizada.

## Contrato común

- Todos los movimientos tienen `version: 1`, `status: "candidate"` y
  `family: "music"`.
- Todos usan únicamente recursos de imagen (`kind: "image"`). No aceptan GLB,
  vídeo generado, rig, modelos de talking-head ni generación automática.
- `subject_1` y `background` son obligatorios en los 24 movimientos.
- `subject_1`, `subject_2` y `prop_1` representan assets distintos. No se debe
  rellenar un slot obligatorio repitiendo el protagonista.
- Los sujetos y props deben llegar como recortes con alpha limpio. El fondo es
  una placa durable, normalmente 16:9, con contraste suficiente para leer la
  trayectoria.
- Las coreografías son rutas de keyframes deterministas, guardables y
  reabribles. No son simulaciones de física, colisiones, gravedad, caminata,
  iluminación 3D u oclusión global.
- No generan audio ni sustituyen la canción. Estas definiciones no dependen de
  BPM ni de beats; el futuro compilador sólo debe usar su duración declarada.
- No se permiten flashes blancos deliberados ni estroboscopio. Algunos
  movimientos tienen giros o desplazamientos fuertes: evita la repetición densa
  y revisa el resultado para detectar mareo; el catálogo no afirma que sea
  accesible para todos los espectadores.
- El alpha limpio es un requisito visual de entrada, no una propiedad verificada
  por este catálogo. La validación debe inspeccionar el asset seleccionado.
- Las duraciones por defecto son cuatro segundos. Seis segundos se reservan a
  movimientos que necesitan mostrar una secuencia completa o un bucle legible.

## Componentes

| Slot | Obligatorio | Tipo | Papel | Requisito visual |
| --- | --- | --- | --- | --- |
| `subject_1` | Sí | Imagen | Foco principal | Recorte alpha, identidad estable y pose legible |
| `subject_2` | Sólo en cinco movimientos | Imagen | Segunda presencia distinta | Recorte alpha; no sustituirlo por `subject_1` |
| `background` | Sí | Imagen | Placa de entorno | Fuente durable, contraste y espacio para la trayectoria |
| `prop_1` | Sólo en tres movimientos | Imagen | Accesorio u objeto de interacción | Recorte alpha y escala independiente |

## Catálogo de movimientos

| ID | Nombre | Objetivo y mecanismo visual | Componentes requeridos | Duración / intensidad |
| --- | --- | --- | --- | --- |
| `music-spiral-exit` | Salida en espiral | El foco se encoge y desvanece en el centro mientras gira dos vueltas; ruta 2D, sin órbita física. | `subject_1`, `background` | 4 s / high |
| `music-speed-flight` | Vuelo de velocidad | El foco cruza de izquierda a derecha; el fondo puede desplazarse a la izquierda a 95 unidades/s, sin sincronización al compás. | `subject_1`, `background` | 4 s / high |
| `music-infinite-fall` | Caída infinita | Entrada desde arriba, descenso finito y reducción hasta salir por abajo; no hay bucle limpio ni mundo infinito. | `subject_1`, `background` | 6 s / high |
| `music-pinball` | Rebote de pinball | Trayectoria zigzag con puntos de rebote escritos; no hay colisiones ni solver de pinball. | `subject_1`, `background` | 4 s / high |
| `music-boomerang` | Bumerán | El foco se aleja por un arco y vuelve a su origen; no simula aerodinámica. | `subject_1`, `background` | 4 s / moderate |
| `music-cannon-launch` | Lanzamiento de cañón | El foco sale disparado y abandona el cuadro por arriba a la derecha siguiendo un arco; no aterriza ni hace pausa. | `subject_1`, `background` | 4 s / high |
| `music-orbit-duel` | Duelo orbital | Dos focos recorren arcos opuestos alrededor de un eje central; son rutas independientes. | `subject_1`, `subject_2`, `background` | 6 s / high |
| `music-high-five` | Choca esos cinco | Dos personajes convergen en un punto, marcan el encuentro y se separan; no detecta manos ni contacto. | `subject_1`, `subject_2`, `background` | 4 s / moderate |
| `music-magnet-pull` | Tirón magnético | `subject_1` permanece casi estable, atrae a `subject_2` y éste rebota hasta estabilizarse; no calcula campos ni masas. | `subject_1`, `subject_2`, `background` | 4 s / high |
| `music-ricochet-pass` | Pase de rebotes | `subject_1` permanece quieto y sólo `prop_1` atraviesa varios puntos de rebote; la ruta es explícita. | `subject_1`, `background`, `prop_1` | 4 s / high |
| `music-portal-swap` | Intercambio de portales | Dos focos desaparecen y reaparecen intercambiados mediante opacidad y posición; no es teletransporte 3D. | `subject_1`, `subject_2`, `background` | 6 s / high |
| `music-trampoline` | Salto de trampolín | Rebote vertical con escala uniforme y posición; no hay squash-and-stretch por ejes, deformación del bitmap ni fuerzas simuladas. | `subject_1`, `background` | 4 s / high |
| `music-pendulum` | Péndulo musical | Oscilación lateral alrededor de un eje visual; no resuelve gravedad ni cuerda. | `subject_1`, `background` | 4 s / moderate |
| `music-rubber-band` | Goma elástica | El foco se desplaza en X y rota para expresar tensión y regreso; no escala ni deforma la imagen. | `subject_1`, `background` | 4 s / moderate |
| `music-card-toss` | Lanzamiento de carta | El foco entra, mantiene una lectura breve y sale propulsado con giro; no requiere perspectiva 3D ni aterrizaje. | `subject_1`, `background` | 4 s / moderate |
| `music-staircase-pop` | Ascenso por escalones | Saltos discretos entre posiciones, como un sampler visual; no hay ciclo de caminar. | `subject_1`, `background` | 4 s / high |
| `music-accordion-clones` | Clones acordeón | Instancias limitadas del mismo foco se expanden y contraen; no crea personajes nuevos. | `subject_1`, `background` | 6 s / high |
| `music-domino-wave` | Ola de dominó | Copias limitadas se inclinan por turnos y recuperan su orientación; no entran ni salen como personajes nuevos ni hay dominós físicos. | `subject_1`, `background` | 6 s / high |
| `music-conveyor` | Cinta transportadora | Desplazamiento direccional con bucle opcional y fondo de cadena; no hay maquinaria simulada. | `subject_1`, `background` | 4 s / moderate |
| `music-spotlight-relay` | Relevo de focos | Dos presencias se alternan el centro mediante opacidad, escala y foco suave; no hay luz física. | `subject_1`, `subject_2`, `background` | 6 s / moderate |
| `music-corkscrew-rise` | Ascenso sacacorchos | Ascenso con deriva lateral y rotación 2D; no es una trayectoria 3D. | `subject_1`, `background` | 4 s / high |
| `music-shockwave` | Onda expansiva | El foco central recibe un zoom de movimiento; no cambia la opacidad ni representa presión o daño físico. | `subject_1`, `background` | 4 s / high |
| `music-satellite-swarm` | Enjambre de satélites | Un único `prop_1` se clona hasta cinco veces y recorre órbitas visuales alrededor del foco. | `subject_1`, `background`, `prop_1` | 6 s / high |
| `music-crowd-surf` | Surf entre multitudes | El protagonista avanza sobre copias de `prop_1`, una franja de público; no hay una onda de fondo ni personas generadas. | `subject_1`, `background`, `prop_1` | 6 s / high |

## Temporalidad

Las 24 definiciones omiten `rhythmic`: las coreografías se expresan con una
duración fija y keyframes deterministas, no con beats ni con BPM. El control de
intensidad sólo clasifica la energía visual esperada para el futuro compilador;
no autoriza flashes, física, deformaciones ni sincronización fonética.

## Estado y dependencias

El catálogo y los compiladores puros locales (`musicMotionSolo.ts`,
`musicMotionEnsemble.ts` y `musicMotionBuilders.ts`) son implementación del
candidato, pero no implican aprobación, preview renderizada ni existencia de
assets válidos. El estado actual sigue siendo pendiente de tests, PR, revisión
independiente, merge y validación visual/renderizada. El siguiente trabajo debe
completar, en módulos separados:

1. tests de los compiladores y de las 24 coreografías, incluyendo bounds,
   identidades y determinismo;
2. bindings y selector de Library para los cuatro slots;
3. validación de assets canónicos, workspace y alpha;
4. round-trip de escena, bounds y trayectorias distintas;
5. previews locales explícitamente pendientes y revisión visual del alpha.

No se deben añadir pesos de modelos, imágenes, audio o MP4 al repositorio.

## Alcance del Wizard y recuperación

«Copiar contrato para el Wizard» entrega JSON descriptivo; no es una acción
automática que rellene/ejecute el editor. La selección ejecutable de este PR
es el formulario Library con IDs canónicos y revalidación de workspace.
El compilador puro conserva la compatibilidad con fuentes inline/HTTP de los
demos: no es por sí solo un boundary de autorización de red.

Guardar/abrir `.scene.json` y el `params.scene` del MP4 mantiene componentes,
capas y provenance. El puente genérico Scene → Recipe pierde metadata narrativa
en la base actual; su reparación y la acción Wizard ejecutable pertenecen al
bloque D0/D6 de `PROCEDURAL_MUSIC_VIDEO_V3.md`, no se declaran resueltas aquí.
