/* Estado de UI: nada aqui pertence ao "projeto" — só à interface. */
import { defineStore } from 'pinia'
import { uid } from '@/utils/id'
import type { RenderStatus, SystemMessage, UnsavedAction, UnsavedDialogState } from '@/types'

export type TimelineTool = 'select' | 'blade' | 'hand'

interface UiState {
  activeTool: TimelineTool
  inspectorVisible: boolean
  sidebarVisible: boolean
  isImporting: boolean
  importMessage: string | null
  renderStatus: RenderStatus
  renderProgress: number
  messages: SystemMessage[]
  unsavedDialog: (UnsavedDialogState & {
    resolve: (action: UnsavedAction) => void
  }) | null
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    activeTool: 'select',
    inspectorVisible: true,
    sidebarVisible: true,
    isImporting: false,
    importMessage: null,
    renderStatus: 'ready',
    renderProgress: 0,
    messages: [],
    unsavedDialog: null,
  }),

  actions: {
    setTool(tool: TimelineTool) {
      this.activeTool = tool
    },
    toggleInspector() {
      this.inspectorVisible = !this.inspectorVisible
    },
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible
    },
    setImporting(active: boolean, message: string | null = null) {
      this.isImporting = active
      this.importMessage = active ? message : null
    },
    /** Empilha uma mensagem de sistema. Erros (`danger`) ficam até o usuário copiar/fechar. */
    notify(text: string, tone: SystemMessage['tone'] = 'info') {
      const msg: SystemMessage = { id: uid('msg'), text, tone }
      this.messages.push(msg)
      if (tone !== 'danger') {
        setTimeout(() => this.dismiss(msg.id), 3200)
      }
    },
    dismiss(id: string) {
      this.messages = this.messages.filter((m) => m.id !== id)
    },
    setRenderStatus(status: RenderStatus, progress = 0) {
      this.renderStatus = status
      this.renderProgress = progress
    },
    promptUnsavedChanges(message = 'Salve o projeto para não perder clipes, timeline e biblioteca.'): Promise<UnsavedAction> {
      if (this.unsavedDialog) {
        return Promise.resolve('cancel')
      }
      return new Promise((resolve) => {
        this.unsavedDialog = {
          title: 'Alterações não salvas',
          message,
          resolve,
        }
      })
    },
    resolveUnsaved(action: UnsavedAction) {
      const dialog = this.unsavedDialog
      if (!dialog) return
      this.unsavedDialog = null
      dialog.resolve(action)
    },
  },
})
