import { lazy, Suspense } from 'react'
import type { Scene } from '../../types'
import { PENDING_SCENE_KEY } from '../../lib/sceneOutput'
import { serializeSceneFile } from '../../lib/sceneFile'
import { SceneTemplateGallery } from './SceneTemplateGallery'

const Editor = lazy(() => import('../../components/Sidebar/SceneAnimatorPanel').then(module => ({ default: module.SceneAnimatorPanel })))

/** A real application route, also usable by the provider-free local gallery
 * harness. The scene snapshot is handed to the existing editor, not rebuilt
 * from a movie or rendered by a special gallery-only implementation. */
export default function SceneTemplateReviewPage() {
  const editor = new URLSearchParams(window.location.search).get('editor') === '1'
  const open = (scene: Scene) => {
    try {
      sessionStorage.setItem(PENDING_SCENE_KEY, serializeSceneFile(scene))
      window.location.assign('/scene-template-review?editor=1')
    } catch {
      window.alert('No se ha podido transferir la escena al editor: almacenamiento de sesión no disponible. No se ha abierto otra escena.')
    }
  }
  return <main className="h-screen overflow-auto bg-bg-primary text-text-primary">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
      <a href="/scene-template-review" className="font-semibold text-cyan-200">HocusPocus · Laboratorio de escenas candidatas</a>
      <span className="text-xs text-text-muted">Sin vídeo IA · no son plantillas aprobadas · guarda tus ajustes antes de salir</span>
      <a href="/" className="text-sm underline">Volver a HocusPocus</a>
    </header>
    {editor
      ? <Suspense fallback={<p className="p-6">Abriendo el editor de la escena…</p>}><section className="h-[calc(100vh-70px)]"><Editor /></section></Suspense>
      : <SceneTemplateGallery onOpenScene={open} />}
  </main>
}
