import { onBeforeUnmount, onMounted } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'

export function useKeyboardShortcuts() {
  const timeline = useTimelineStore()
  const ui = useUiStore()
  const project = useProjectStore()

  function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  }

  function onKey(e: KeyboardEvent) {
    if (isTyping(e.target)) return
    const fps = project.project.fps
    const frame = 1 / fps
    const ctrl = e.ctrlKey || e.metaKey

    switch (e.key) {
      /* ---- Reprodução ---- */
      case ' ':
        e.preventDefault()
        timeline.togglePlay()
        break
      case 'ArrowRight':
        e.preventDefault()
        timeline.setCurrentTime(timeline.currentTime + (e.shiftKey ? 1 : frame))
        break
      case 'ArrowLeft':
        e.preventDefault()
        timeline.setCurrentTime(timeline.currentTime - (e.shiftKey ? 1 : frame))
        break
      case 'Home':
        timeline.setCurrentTime(0)
        break
      case 'End':
        timeline.setCurrentTime(timeline.contentEnd)
        break

      /* ---- Histórico ---- */
      case 'z':
      case 'Z':
        if (ctrl) {
          e.preventDefault()
          if (e.shiftKey) timeline.redo()   // Ctrl+Shift+Z = redo
          else timeline.undo()
        }
        break
      case 'y':
      case 'Y':
        if (ctrl) {
          e.preventDefault()
          timeline.redo()
        }
        break

      /* ---- Edição ---- */
      case 's':
      case 'S':
        if (ctrl) {
          e.preventDefault()
          project.save()
        } else {
          timeline.splitClipAt(timeline.currentTime)
        }
        break

      /* ---- Ferramentas ---- */
      case 'v':
      case 'V':
        if (!ctrl) ui.setTool('select')
        break
      case 'b':
      case 'B':
        if (!ctrl) ui.setTool('blade')
        break
      case 'h':
      case 'H':
        if (!ctrl) ui.setTool('hand')
        break

      /* ---- Zoom ---- */
      case '+':
      case '=':
        timeline.zoomBy(1.25)
        break
      case '-':
      case '_':
        timeline.zoomBy(0.8)
        break

      /* ---- Remoção ---- */
      case 'Delete':
      case 'Backspace':
        if (timeline.selectedClipId) {
          e.preventDefault()
          timeline.removeClip(timeline.selectedClipId)
        }
        break

      case 'Escape':
        timeline.selectClip(null)
        project.selectAsset(null)
        break
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
