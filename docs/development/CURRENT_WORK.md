# Estado de desarrollo y punto de entrada

Verificado el 6 de septiembre de 2026 contra `origin/development` **`ebed43fd`**.
Es una fotografía con evidencia, no un sustituto de Git. Antes de reservar trabajo:
`git fetch origin development`, consultar PR abiertos y comprobar sus archivos.

## Lectura mínima

Lee este documento y el contrato del dominio que vas a modificar. Para contribuir,
consulta [BRANCHING](BRANCHING.md) y [AGENT_QA_POLICY](AGENT_QA_POLICY.md).
La [cola](SLICE_QUEUE.md) contiene solo pendientes. No leas todo `docs/` ni el
[archivo histórico](../archive/README.md) al iniciar una sesión. Los planes antiguos
no autorizan acciones ni representan el estado actual.

## Integrado: no volver a implementar

| Trabajo | Evidencia de integración | Límite de la afirmación |
|---|---|---|
| Contrato de idioma de letras | #139, #141 | No garantiza fidelidad de toda canción generada |
| GenerationRecord con CAS y autoridad de proyección | #138, #142 | No es un segundo scheduler ni prueba cobertura de todos los productores |
| Reserva musical idempotente | #143 | Distinguir reserva, ejecución y publicación |
| Finalización musical en servidor | #158 | Revisar su contrato antes de proponer otra implementación |
| Catálogo/spec musical y rehidratación | #159, #160, #162; fake worker #163 | Fake worker no acredita calidad de audio real |
| Extracción I/O de estado Director | #167 | Locks, reconciliación, borrado y ejecución siguen en el pipeline |
| Adopción H3, guías y finalización de prompts | #170, #172, #174, #178, #179 | Mantener diálogos literales y fixtures; no rehacer refactor |
| Policy/idioma/Creative H3 | #185 | Pruebas de contrato no demuestran éxito audiovisual universal |
| Labs/Wizard L0–L12 | #182, #183, #186–#189, #192, #194, #196 | Entregas integradas; quedan límites de validación indicados abajo |
| Vídeo procedural y galería/plantillas | #168, #169, #173, #175, #177, #180, #181, #184 | No equivale a completar toda la hoja de ruta procedural |
| Inspección GLB y parches faciales | #190, #193, #195 | Router de inspección de #195 todavía sin montar; parches tienen límites de piloto |

La integración es en **development**. No implica que el servidor local esté usando
esa revisión ni que exista una publicación de aplicación en main.

## En curso al comprobarlo

En la primera consulta había cambios locales sin PR. Al cerrar esta revisión,
escenas 3D ya tiene el PR #198 abierto; no está integrado. Estado por dominio:

- **Taller de habla/personajes**: rama `feat/character-speech-workshop`, documentos
  `CHARACTER_SPEECH_RASTER_PLAN.md` y `CHARACTER_SPEECH_WORKSHOP.md` (este último aún
  local en la inspección). Cambios en CharacterCreator/FaceRig, biblioteca y tests.
  El test del panel recibió una corrección local por agotamiento de RAM: 13 tests
  dirigidos pasaron con ~260 MiB de RSS máximo. Eso no equivale a merge ni CI.
- **Escenas 3D reales**: PR [#198](https://github.com/IAnMove/hocuspocus/pull/198),
  rama `feat/video3d-real-scene-mode`, cambios en
  `PROCEDURAL_3D_SCENE_SPEC.md`, SceneAnimator, `features/scene3d`, dependencias e i18n.
- **Vídeo procedural**: conservar el checkpoint `work/procedural-video-pilot-checkpoint`;
  consultar [PROCEDURAL_VIDEO_ROADMAP](PROCEDURAL_VIDEO_ROADMAP.md) y el documento del
  subdominio asignado. No mezclar el checkpoint en bloque ni asumir que todo su
  historial está pendiente.

«En curso» se basa en rama y diff, no en inferir que un agente siga conectado.
No limpiar estos worktrees, stashes, archivos sin seguimiento ni outputs. El estado
local y sus rutas de máquina se mantienen fuera de Git en `ESTADO_LOCAL.md`.

## Pendiente: refactor y validación

1. **Director**: delimitar locks/reconcile/delete/observer y sus contratos antes de
   extraer; después cómic, H3, reparación/rerun y ciclo de vida. No existe todavía
   un `PipelineRuntime` tipado completo. No mover helpers enteros por nombre si
   mezclan I/O con generación o scheduler.
2. **Runtime HTTP**: las cuatro rutas Story Music siguen en `_launch_runtime.py`.
   Extraer un router de dominio con cableado mínimo y un único propietario del archivo.
3. **Estado UI**: falta la extracción cohesiva de sesión Story (carga, borradores,
   guardado/rehidratación) y continuar el slice musical de `useStore`.
4. **Wizard concurrente**: ya hay CAS de colección y recuperación 409; verificar
   exclusión de efectos/pasos entre dos clientes y compatibilidad de checkpoints.
   No volver a proponer CAS desde cero. La antigua F8 no está certificada completa.
5. **Trazabilidad**: comprobar cobertura real de productores→GenerationRecord→UI;
   conservar una proyección y la autoridad de TaskRegistry/asset-manifest. La
   antigua F12 no debe confundirse con Labs L12.
6. **H3 desde Studio**: comprobar propagación de policy desde cada petición UI;
   el contrato API acepta la policy, pero la inspección del store dejó caminos
   pendientes de comprobación. No inferir envío por existir el campo en el schema.
7. **Labs, cierre de validación**: seleccionar un `attemptId` concreto (la prueba
   L12 titulada «take 2» usa `shot_numbers: [2]` y `selected_latest`); comprobar
   navegación móvil real; prueba audiovisual acotada y equivalencia UI/Wizard.
   #196 no repitió GPU. Sus checks verdes no cubren esas ausencias.
8. **Producto separado del refactor**: fidelidad de letras/idioma y evaluación real
   de Creative/audio H3. Sin repetir matrices masivas ni inventar resultados.
9. **Entrega**: reconsultar estado de protecciones y preparar una release a main
   solo dentro de su autorización. Esta limpieza documental no publica ni cambia
   reglas de GitHub.

Orden recomendado: terminar los cambios locales ya empezados, cerrar lagunas de
validación y abordar un único contrato de refactor por PR. Detalle de ownership y
priorización en [SLICE_QUEUE](SLICE_QUEUE.md).

## Contratos: consultar por tarea

| Tarea | Referencia |
|---|---|
| Capas y dependencias | [ARCHITECTURE_FOUNDATION](ARCHITECTURE_FOUNDATION.md), [ARCHITECTURE_MAP](ARCHITECTURE_MAP.md) |
| Identidad y procedencia | [DOMAIN_MODEL_AND_ASSET_PROVENANCE](DOMAIN_MODEL_AND_ASSET_PROVENANCE.md), [GENERATION_RECORD](GENERATION_RECORD.md) |
| Música | [MUSIC_SUBMISSION](MUSIC_SUBMISSION.md), [MUSIC_FINALIZATION](MUSIC_FINALIZATION.md), [MUSIC_MODEL_CONTRACT](MUSIC_MODEL_CONTRACT.md) |
| Wizard | [WIZARD_ACTION_RUNNER](WIZARD_ACTION_RUNNER.md), [WIZARD_WORKFLOW_RUNTIME](WIZARD_WORKFLOW_RUNTIME.md) |
| Labs | [LABS_WIZARD_ACTION_MATRIX](LABS_WIZARD_ACTION_MATRIX.md): referencia detallada/fixture, no checklist de inicio |
| Calidad y textos | [CODE_HEALTH](CODE_HEALTH.md), [INTERNATIONALIZATION](INTERNATIONALIZATION.md), [LOCAL_VALIDATION](LOCAL_VALIDATION.md) |

## Cómo mantener este estado sin volver a crear una biblia

Al integrar un contrato, mueve su pendiente a «Integrado» con PR y límite de
validación. Retira la entrada temporal de «En curso». Si la tabla crece demasiado,
resume por dominio y deja el historial de commits en Git; no pegues conversaciones.
Los handoffs caducan al integrarse o ser sustituidos. Conserva decisiones y evidencia
en el archivo, pero no su autoridad operativa. Una fecha antigua por sí sola no
convierte un contrato técnico vigente en material descartable.
