# Showcase con MiniMax/Wizard y tres canciones reales

Encargo del usuario: 2026-09-06, después de P00-C2 y P00D/primer selector.
Estado: tres audios preservados y analizados por CPU; primeros retratos MiniMax
reales generados mediante Wizard y primer matte con Tools. Galería nueva y
videoclips finales todavía pendientes; originales coral siguen intactos.

## Alcance y límites

- Rehacer la galería de sesión en la URL solicitada (puerto 43873), conservando
  los 24 originales coral aprobados y su publicación de referencias v1.
- Personajes elaborados generados por HocusPocus + Ask to the Wizard con MiniMax.
  El usuario autoriza gasto de tokens. No sustituir por imágenes de otro proveedor
  silenciosamente; verificar qué MiniMax es LLM y qué modelo produce las imágenes.
- Tres videoclips completos con las tres canciones reales más recientes de Library.
  Sólo composición procedural, imágenes fijas y efectos implementados; nunca
  inferencia de vídeo H3/MiniMax/LTX ni regeneración de las canciones.
- No reiniciar apps 42003/42004, descargar modelos, cambiar settings globales de
  otros agentes, subir pesos/outputs al historial Git ni hacer release a main.
- Render y montaje seriales. Preservar letra, idioma, audio e identidades fuente.
  Los 30 AN están diseñados, no declarar que todos se han implementado.

## Pasos verificables

- [x] C2 #175 mezclado; plan/anime #176 mezclado; selector #177 mezclado
  por IAnMove en development (2beb1c88), con CI required verde.
- [x] Pinokio confirma HocusPocus activo: Maestro-next.git, listo. No arrancar
  otra instancia del backend ni usar el benchmark de H3.
- [x] Library devuelve las tres últimas canciones canónicas/reales en default:
  - asset_6912759921f746c6bf73b7bd24a80f74 — “Atardecer sobre la colina…”, ACE-Step.
  - asset_f5e0d1789b384ab6831a4b1e4693264c — “I crossed the Shire…”, MiniMax-Music3.
  - asset_f85ef3d27fa845928151dfffe369a6cc — “The screen says zero…”, ACE-Step.
  Son identificadores de fuente, no títulos nuevos ni renombrados.
- [x] Obtener metadata completa, duración y audio original; verificar que son
  canciones completas, no simulaciones, stems, speech ni versiones duplicadas.
  Duraciones observadas: 90 s, 104.083447 s y 120 s. WAV originales con hashes
  y manifests en el directorio de evidencia, fuera de Git. Las letras mixtas
  de los dos últimos ya estaban en las fuentes; se conservan literalmente.
- [x] Inspeccionar interfaz/API real de Wizard y MiniMax. Guardar conversación
  y decisiones auténticas, sin fabricar mensajes como si procedieran del Wizard.
- [ ] Brief del Wizard por canción: ritmo, secciones, narrativa visual, personaje,
  fondos, encuadres y efectos compatibles. Prompts técnicos pueden estar en inglés;
  letras/texto citado no cambian de idioma ni se corrigen silenciosamente.
- [ ] Probar primero un personaje y un fondo mediante HocusPocus/MiniMax; evaluar
  calidad, resolución, padding, rostro y alpha. Si no hay transparencia real,
  declarar el límite y usar una extracción explícita compatible con la carga actual.
- [ ] Generar assets restantes con referencias coherentes. Límite operativo:
  máximo dos reintentos razonados por asset, no bucles de gasto por fallo repetido.
- [ ] Conservar assetId/provider/model/task/prompt/reference/hash de cada salida.
  El cliente reutilizable recibe URL/workspace/IDs como argumentos, nunca claves.
- [ ] Crear escenas editables con encuadres de cintura hacia arriba o close-ups,
  sin pies deslizándose ni labios/ojos añadidos sobre rasgos ya pintados.
- [ ] Rehacer galería con nueva variante identificada y acceso a originales.
  Snapshot exacto por clip, no recompilar la versión actual y llamarla original.
- [ ] Renderizar piloto corto antes de escalar; verificar ffprobe y frames.
- [ ] Montar tres videoclips de duración completa respetando las canciones fuente,
  ritmo y legibilidad. Repartir los efectos con intención, no apilarlos todos a la vez.
- [ ] Guardar configuración de planos/montaje y lineage hacia audio e imágenes;
  ofrecer abrir/ajustar los planos y preservar outputs fuera de Git.
- [ ] Validar duración/FPS/dimensiones/audio, cortes, frames negros, encuadre,
  clipping, repetición excesiva y consistencia del personaje a lo largo de cada clip.
- [ ] Entregar URLs de galería + tres MP4, listado de límites observados y
  evidencia; aprobación visual de nuevos resultados pendiente del usuario.

## Reanudación de esta sesión

Worktree aislado: /tmp/hocus-minimax-showcase.z35rpR, rama
work/procedural-minimax-showcase. Estas rutas son evidencia de sesión, no scripts
portables. Leer primero AGENTS y el roadmap. La herramienta de app existente está
en pinokio_agent/skills/api/Maestro-next.git; su cliente CDP es genérico.
Usar Pinokio para descubrir base URL actual antes de API, no asumir puertos.

Originales intactos: /tmp/hocus-template-review.o8H5is/previews/ y publicación
procedural-style-reference-v1. Nuevos outputs serán versiones hermanas fuera de Git.

## Concurrencia y límites detectados durante la ejecución

Se creó `procedural-showcase-v2` mediante API sin activarlo globalmente; el servidor
sigue en `default`. La UI stock cambia un singleton al seleccionar workspace.
La UI de prueba de esta sesión usa componentes reales desde este worktree, con
contexto Zustand explícito sólo en ese navegador. Su guard bloquea mutaciones de
settings/workspace global, inferencia local y vídeo IA; sólo permite peticiones
del Wizard y Story Lab dirigidas al workspace nuevo y MiniMax Image-01 remoto.
No es una nueva función de aislamiento ya publicada en producto.

MiniMax chat está configurado y hay clave de Image-01 (sólo booleanos comprobados).
Image-01 produce JPG opaco; su manifiesto no guarda actualmente la identidad de
la referencia como parent. Mantener evidencia externa de requests/references.
El capturador público de escenas admite MP4/WebM; el sandbox C2 es más restrictivo
y no debe emplearse como si fuese el backend de montaje de canciones completas.

Evidencia de sesión: `/tmp/hocus-minimax-media.CF3dwI`. El cliente de descarga
portable está en `pinokio_agent/skills/api/Maestro-next.git/clients/asset_snapshot.mjs`.

### Hallazgos y decisiones verificadas durante el piloto

- El reconciliador convertía una petición explícita de Story/MiniMax en
  Studio/Flux o la anulaba por una prohibición de otro medio. El navegador
  bloqueó el intento local; no se ejecutó Flux. Corrección local y regresiones
  acotadas en revisión, todavía no mezcladas.
- Las respuestas antiguas de MiniMax omiten workspace en source/thumbnail.
  La corrección local utiliza el workspace del job, también al recuperar.
- Las referencias de personajes de Story Lab fuerzan un retrato de identidad;
  no equivale a un recorte de cintura ni a un personaje articulado.
- Un estilo demasiado largo puede truncar el contenido técnico, y el estilo de
  personaje puede contaminar fondos. Los dos fondos piloto con personas se
  conservan como evidencia rechazada, no como plates válidos. Para los fondos
  finales el Wizard redacta prompts separados en inglés y el operador los envía
  literalmente a la API pública de HocusPocus, con 16:9 explícito. Distinguir esta
  ejecución del operador de una acción ejecutada por el Wizard.
- El tercer inventario contenía nombres duplicados. La guarda de ambigüedad
  impidió generar. El operador renombró los duplicados del borrador propio como
  variantes sin eliminar entidades y volvió a pedir el personaje al Wizard.
- El exportador actual no admite soundtrack de otro workspace. Se crearon
  copias byte a byte mediante Upload; los tres SHA coinciden con los originales.
  No se movió ningún audio. Análisis público con transcribe=false y
  extract_vocals=false: 117.5, 86.1 y 99.4 BPM estimados. Downbeats heurísticos,
  no compases garantizados ni alineación fonética.
