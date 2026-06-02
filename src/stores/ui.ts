/* Estado de UI: nada aqui pertence ao "projeto" — só à interface. */
import { defineStore } from 'pinia'
import { uid } from '@/utils/id'
import type { RenderStatus, SystemMessage } from '@/types'

export type TimelineTool = 'select' | 'blade' | 'hand'

interface UiState {
  activeTool: TimelineTool
  inspectorVisible: boolean
  sidebarVisible: boolean
  isImporting: boolean
  renderStatus: RenderStatus
  renderProgress: number
  messages: SystemMessage[]
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    activeTool: 'select',
    inspectorVisible: true,
    sidebarVisible: true,
    isImporting: false,
    renderStatus: 'ready',
    renderProgress: 0,
    messages: [],
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
    /** Empilha uma mensagem de sistema que some sozinha. */
    notify(text: string, tone: SystemMessage['tone'] = 'info') {
      const msg: SystemMessage = { id: uid('msg'), text, tone }
      this.messages.push(msg)
      setTimeout(() => this.dismiss(msg.id), 3200)
    },
    dismiss(id: string) {
      this.messages = this.messages.filter((m) => m.id !== id)
    },
    setRenderStatus(status: RenderStatus, progress = 0) {
      this.renderStatus = status
      this.renderProgress = progress
    },
  },
})
