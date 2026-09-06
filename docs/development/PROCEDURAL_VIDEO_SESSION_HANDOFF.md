# Reanudar vídeo procedural sin depender del historial del chat

2026-09-06. Leer primero AGENTS.md, VIDEO3D_TEMPLATE_REVIEW_PLAN.md y
[PROCEDURAL_VIDEO_ROADMAP.md](PROCEDURAL_VIDEO_ROADMAP.md).

## Estado exacto

No todos los pasos están terminados. El Wizard tiene un PR abierto; el catálogo,
galería, tooling y plan tienen commits de checkpoint. No se han mezclado ni
publicado main. P01 y posteriores están diseñadas, **no implementadas**.

- PR #168: `feat/wizard-programmatic-video`, base development, HEAD
  `3aaa65cb5b3e5c74e62f99a3856a81279bf12a41`.
- CI required de ese HEAD: verde. Revisión Cursor previa encontró dos problemas,
  corregidos con tests. La revisión actual no se ejecutó por límite de uso/gasto.
- No considerar `Cursor Automation: Untitled` como revisión Bugbot completada.
- Esperar restablecimiento de cuota o autorización expresa de otro revisor.
  No aumentar gasto ni cambiar el procedimiento unilateralmente.

Branch de conservación: `work/procedural-video-pilot-checkpoint`.
Es un checkpoint, no una rama para mezclar de golpe contra development.

| Futuro PR | Commit preparado | Contenido | Dependencia |
|---|---|---|---|
| Piloto B | `5f6dc88e` | 24 candidatos/compiladores, SVG/GLB originales, tests | #168 mezclado |
| Piloto C1 | `72e5cdd8` | Galería, abrir editor, decisiones, 3 E2E | B mezclado |
| Piloto C2 | `246cb5f8` | Build estático temporal, renderer de revisión, API cerrada y tests | C1 mezclado |
| Plan | commit de documentación posterior a C2 | Roadmap + cámaras + 3 inventarios de 50 | no activar P01 hasta P00 |

La primera vez que se sube el checkpoint, comprobar con `git ls-remote` que su
HEAD coincide; la existencia de este documento no prueba que el push haya terminado.
Los cuatro commits se preparan como PRs independientes desde development actualizado,
no se abre una cadena de PRs que incluya repetidamente los commits anteriores.

## Reanudación operativa

1. Inspeccionar `git status`, worktrees, PRs y HEAD remotos. No cambiar el checkout
   compartido. Fetch sólo necesario, no force/reset/stash del trabajo ajeno.
2. Verificar estado de #168 y cuota de revisión. Si sigue bloqueada, informar y
   no mezclar ni pedir reintentos en bucle.
3. Con revisión obtenida, leer hallazgos de HEAD actual y CI; corregir si procede.
   Mezclar normalmente usando comprobación del SHA esperado, nunca admin bypass.
4. Crear otro worktree temporal/branch desde nuevo origin/development. Cherry-pick
   sólo `5f6dc88e`, inspeccionar compatibilidad con cambios recientes y probar.
5. PR B → pedir Cursor → esperar revisión/CI actuales → arreglar → mezclar.
6. Repetir con `72e5cdd8`, después `246cb5f8`, cada uno desde development mezclado.
7. Incorporar documentación, actualizar estados reales e iniciar P01 del roadmap.
8. Continuar fases sólo con dependencias mezcladas y aceptación cumplida. Ante
   dudas complejas, principal; Luna sólo tarea delimitada y resultados revisados.

No ejecutar inferencia de vídeo, descargar modelos ni tocar las apps 42003/42004.
No hacer release a main sin autorización de esa operación.

## Evidencia local de esta sesión

- PR A: 120 tests UI enfocados y build de un checkout separado en HEAD exacto.
- B/C1/C2: 35 tests de catálogo, arte, GLB, compilación, decisiones y contrato HTTP.
- C1: 3 Playwright E2E, worker único/API simulada/puerto aislado 42005, todos pasan.
- Lint global con cero warnings y build: pasan. Warning de chunks grandes
  permanece; no se elevó el límite para ocultarlo.
- Ratchet contra origin/development: pasa, **con warnings** de LOC/hotspots
  existentes. No afirmar que añadir este piloto resuelve la deuda arquitectónica.
- 24 MP4 reales con compositor existente: 4 s, 1280×720, 30fps, sin audio. Assets
  SVG y GLB de código original, sin modelos IA o proveedores de generación.
- Galería: 24 tarjetas y 72 archivos de preview comprobados; reproducción y seek.
- Guardar nombre editado/policy/procedencia probado con API sandbox real.
- Tooling reproducible: 2/2 renders (cinema-establishing, space-cruise) con UI
  construida; ffprobe confirma duración/FPS/dimensiones. El MP4 de space-cruise
  se reabrió con SceneLibraryDialog y conservó template, policy y capa GLB.
- Los tests HTTP usan cabecera MP4 sintética para contrato, no un vídeo válido.
  La evidencia de render real anterior es un conjunto distinto.

La primera versión del tooling falló por websocket de desarrollo; se sustituyó
por build estático temporal y se repitió el smoke con éxito. No borrar ni
renombrar el fallo anterior como éxito. Los artefactos de QA no entran en git.

## Dónde ver y recuperar archivos (rutas sólo de esta sesión)

Worktree de implementación: `/tmp/hocus-video3d-production.DJRluS`.
Checkout de prueba A: `/tmp/hocus-pr-a-validation.lZnmbu`.
No son rutas portables para scripts del producto.

Galería piloto, mientras su servidor siga activo:
`http://192.168.1.87:43873/scene-template-review`.
Loopback: `http://127.0.0.1:43873/scene-template-review`.

Archivos: `/tmp/hocus-template-review.o8H5is/previews/` contiene MP4/PNG/JSON por ID.
El snapshot de cada JSON permite recuperar la configuración; los votos de la
galería viven en localStorage del navegador y se exportan con «Exportar revisión JSON».
Servidor local de sesión no es persistencia de producción; el puerto puede dejar
de existir al apagar el proceso/equipo. No prometemos continuidad de esa URL.

Reproducible en otra sesión después de instalar las dependencias normales:
`npm --prefix ui run scene:review -- --render`. Lee SCENE_TEMPLATE_REVIEW.md para
prerrequisitos y LAN. Usa puerto efímero por defecto, no reserves 42003/42004.

Demo previamente aprobada «La noche es nuestra»: servidor `192.168.1.87:43872`,
fuentes/medios en `/tmp/hocus-video3d-neon.Kz8d82`. No modificar o borrar.

Logs fuera de git: `/tmp/hocus-template-review.o8H5is/{render.log,final-tests.log,
final-build.log,final-lint.log,final-health.log,repro-smoke.log,repro-static-smoke.log}`.
No copiar clips/pesos al repositorio para conservar evidencia: guardar un archivo
externo o volver a ejecutar las recetas de prueba.

## Exit checklist

- [x] AGENTS snapshot y límites de tarea revisados; no se editaron launchers.
- [x] Destino/ejemplos/captura URL de Pinokio no aplican a estos cambios de lógica/UI.
- [x] Apps 42003/42004 y cambios de otros agentes preservados.
- [x] Artefactos generados fuera de git; ninguna descarga/modelo de IA ejecutado.
- [x] CI, revisión, merge y render real distinguidos; no aprobar candidatas por PR.
- [ ] Completar revisión pendiente y merges secuenciales antes de nuevas fases.
