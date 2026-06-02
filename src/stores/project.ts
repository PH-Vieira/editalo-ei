/* Estado do PROJETO: metadados + biblioteca de mídia (assets). */
import { defineStore } from 'pinia'
import type { Asset, AssetKind, Project } from '@/types'
import { defaultProject } from '@/data/defaults'
import { importMedia, saveProject, isTauri } from '@/tauri/commands'
import { useUiStore } from './ui'
import { useTimelineStore } from './timeline'

export type MediaFilter = 'all' | AssetKind

interface ProjectState {
  project: Project
  assets: Asset[]
  selectedAssetId: string | null
  filter: MediaFilter
  search: string
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    project: { ...defaultProject },
    assets: [],
    selectedAssetId: null,
    filter: 'all',
    search: '',
  }),

  getters: {
    filteredAssets(state): Asset[] {
      const q = state.search.trim().toLowerCase()
      return state.assets.filter((a) => {
        const byKind = state.filter === 'all' || a.kind === state.filter
        const byText = !q || a.name.toLowerCase().includes(q)
        return byKind && byText
      })
    },
    selectedAsset(state): Asset | null {
      return state.assets.find((a) => a.id === state.selectedAssetId) ?? null
    },
    countByKind(state) {
      return (kind: AssetKind) => state.assets.filter((a) => a.kind === kind).length
    },
  },

  actions: {
    selectAsset(id: string | null) {
      this.selectedAssetId = id
    },
    setFilter(filter: MediaFilter) {
      this.filter = filter
    },
    setSearch(q: string) {
      this.search = q
    },
    touch() {
      this.project.modifiedAt = Date.now()
    },
    renameProject(name: string) {
      const trimmed = name.trim()
      if (trimmed) { this.project.name = trimmed; this.touch() }
    },

    /** Importa mídia via Tauri (ou fallback mock no navegador). */
    async importMedia() {
      const ui = useUiStore()
      ui.isImporting = true
      try {
        const imported = await importMedia()
        if (imported.length) {
          this.assets = [...imported, ...this.assets]
          this.touch()
          ui.notify(
            `${imported.length} arquivo${imported.length > 1 ? 's' : ''} importado${imported.length > 1 ? 's' : ''}`,
            'success',
          )
        } else if (!isTauri()) {
          ui.notify('Importação de arquivos só no app desktop (npm run tauri:dev)', 'info')
        }
      } catch {
        ui.notify('Falha ao importar mídia', 'danger')
      } finally {
        ui.isImporting = false
      }
    },

    /** Adiciona um asset "solto" (ex.: via drag-and-drop visual). */
    addAsset(asset: Asset) {
      this.assets = [asset, ...this.assets]
      this.touch()
    },

    removeAsset(id: string) {
      this.assets = this.assets.filter((a) => a.id !== id)
      if (this.selectedAssetId === id) this.selectedAssetId = null
    },

    async save() {
      const ui = useUiStore()
      await saveProject(this.project)
      this.touch()
      ui.notify('Projeto salvo', 'success')
    },

    newProject() {
      this.project = {
        ...defaultProject,
        id: 'proj_' + Date.now(),
        name: 'Projeto sem título',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      }
      this.assets = []
      this.selectedAssetId = null
      const timeline = useTimelineStore()
      timeline.reset()
    },
  },
})
