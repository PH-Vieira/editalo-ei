import { onMounted } from 'vue'
import { isTauri } from '@/tauri/commands'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'

/** Bloqueia fechar a janela enquanto houver alterações não salvas. */
export function useUnsavedGuard() {
  onMounted(async () => {
    if (!isTauri()) return

    const project = useProjectStore()
    const ui = useUiStore()
    const { appWindow } = await import('@tauri-apps/api/window')

    let closing = false

    await appWindow.onCloseRequested(async (event) => {
      if (closing || !project.isDirty) return

      event.preventDefault()

      const action = await ui.promptUnsavedChanges(
        'O projeto tem alterações não salvas. Deseja salvar antes de sair?',
      )
      if (action === 'cancel') return

      if (action === 'save') {
        const saved = await project.save()
        if (!saved || project.isDirty) return
      }

      closing = true
      await appWindow.close()
    })
  })
}
