# Showcase con MiniMax/Wizard y tres canciones reales

Encargo del usuario: 2026-09-06, después de P00-C2 y P00D/primer selector.
Estado: preparación; no se han generado todavía las nuevas imágenes/videoclips.

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
- [ ] Obtener metadata completa, duración y audio original; verificar que son
  canciones completas, no simulaciones, stems, speech ni versiones duplicadas.
- [ ] Inspeccionar interfaz/API real de Wizard y MiniMax. Guardar conversación
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
