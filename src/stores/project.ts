/* Estado do PROJETO: metadados + biblioteca de mídia (assets). */
import { defineStore } from 'pinia'
import type { Asset, AssetKind, Project, ProjectFile } from '@/types'
import { defaultProject } from '@/data/defaults'
import { importMedia, pickProjectSavePath, writeProjectFile, openProjectFile, readProjectFile, isTauri } from '@/tauri/commands'
import { basename } from '@/utils/format'
import { addRecentProject, removeRecentProject } from '@/utils/recentProjects'
import { useUiStore } from './ui'
import { useTimelineStore } from './timeline'

export type MediaFilter = 'all' | AssetKind

interface ProjectState {
  project: Project
  assets: Asset[]
  selectedAssetId: string | null
  filter: MediaFilter
  search: string
  filePath: string | null
  isDirty: boolean
  lastSavedAt: number | null
  isSaving: boolean
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    project: { ...defaultProject },
    assets: [],
    selectedAssetId: null,
    filter: 'all',
    search: '',
    filePath: null,
    isDirty: false,
    lastSavedAt: null,
    isSaving: false,
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
    fileName(state): string | null {
      return state.filePath ? basename(state.filePath) : null
    },
    saveStatusLabel(state): string {
      if (state.isSaving) return 'Salvando…'
      if (state.filePath && !state.isDirty) return `Salvo · ${basename(state.filePath)}`
      if (state.filePath && state.isDirty) return `Alterado · ${basename(state.filePath)}`
      if (state.isDirty) return 'Alterações não salvas'
      return 'Projeto novo'
    },
    saveMenuHint(state): string {
      if (state.isSaving) return 'Gravando arquivo…'
      if (state.filePath) {
        return state.isDirty
          ? `Salvar em ${basename(state.filePath)}`
          : `Já salvo em ${basename(state.filePath)}`
      }
      return 'Escolher onde salvar (.regua)'
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
      this.isDirty = true
    },
    markSaved(at = Date.now()) {
      this.isDirty = false
      this.lastSavedAt = at
      this.project.modifiedAt = at
    },
    renameProject(name: string) {
      const trimmed = name.trim()
      if (trimmed) { this.project.name = trimmed; this.touch() }
    },

    buildProjectFile(): ProjectFile {
      const timeline = useTimelineStore()
      return {
        version: 1,
        project: { ...this.project },
        assets: this.assets.map((a) => ({ ...a })),
        tracks: timeline.tracks.map((t) => ({ ...t })),
        clips: timeline.clips.map((c) => ({ ...c })),
      }
    },

    /** Importa mídia via Tauri (ou fallback mock no navegador). */
    async importMedia() {
      const ui = useUiStore()
      ui.setImporting(true, 'Importando mídia…')
      try {
        const imported = await importMedia((progress) => {
          if (progress.phase === 'converting-gif') {
            ui.setImporting(true, `Convertendo GIF: ${progress.name}…`)
          } else {
            ui.setImporting(true, `Importando: ${progress.name}…`)
          }
        })
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
      } catch (e) {
        const detail =
          typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)
        ui.notify(`Falha ao importar mídia: ${detail}`, 'danger')
      } finally {
        ui.setImporting(false)
      }
    },

    /** Adiciona um asset "solto" (ex.: via drag-and-drop visual). */
    addAsset(asset: Asset) {
      this.assets = [asset, ...this.assets]
      this.touch()
    },

    removeAsset(id: string) {
      const timeline = useTimelineStore()
      const ui = useUiStore()
      const asset = this.assets.find((a) => a.id === id)
      timeline.removeClipsForAsset(id)
      this.assets = this.assets.filter((a) => a.id !== id)
      if (this.selectedAssetId === id) this.selectedAssetId = null
      this.touch()
      if (asset) ui.notify(`"${asset.name}" removido da biblioteca`, 'info')
    },

    /** Salva o projeto. Sem caminho definido, abre o diálogo (Salvar como). */
    async save(saveAs = false) {
      const ui = useUiStore()
      this.isSaving = true
      try {
        let path = this.filePath
        if (!path || saveAs) {
          const safeName = this.project.name.replace(/[^\w\sÀ-ú-]/g, '').trim() || 'projeto'
          path = await pickProjectSavePath(`${safeName}.regua`)
          if (!path) return false
        }

        const savedPath = await writeProjectFile(path, this.buildProjectFile())
        this.filePath = savedPath
        this.markSaved()
        addRecentProject(savedPath, this.project.name)
        const name = basename(savedPath)
        ui.notify(
          isTauri()
            ? `Projeto salvo em ${savedPath}`
            : `Download iniciado: ${name}`,
          'success',
        )
        return true
      } catch (e) {
        ui.notify(`Falha ao salvar: ${String(e).slice(0, 120)}`, 'danger')
        return false
      } finally {
        this.isSaving = false
      }
    },

    saveAs() {
      return this.save(true)
    },

    applyProjectFile(data: ProjectFile, path: string) {
      const timeline = useTimelineStore()
      this.project = { ...data.project }
      this.assets = data.assets.map((a) => ({ ...a }))
      this.selectedAssetId = null
      this.filter = 'all'
      this.search = ''
      this.filePath = path
      this.markSaved()
      timeline.loadState(data.tracks, data.clips)
      addRecentProject(path, data.project.name)
    },

    /** Pergunta o que fazer se houver alterações pendentes. */
    async guardUnsavedChanges(message?: string): Promise<boolean> {
      if (!this.isDirty) return true
      const ui = useUiStore()
      const action = await ui.promptUnsavedChanges(message)
      if (action === 'cancel') return false
      if (action === 'save') {
        const saved = await this.save()
        if (!saved || this.isDirty) return false
      }
      return true
    },

    async openPath(path: string): Promise<boolean> {
      const ui = useUiStore()
      const canProceed = await this.guardUnsavedChanges(
        'Abrir outro projeto descartará as alterações não salvas do projeto atual.',
      )
      if (!canProceed) return false

      try {
        const data = await readProjectFile(path)
        this.applyProjectFile(data, path)
        ui.notify(`Projeto aberto: ${basename(path)}`, 'success')
        return true
      } catch (e) {
        removeRecentProject(path)
        ui.notify(`Não foi possível abrir: ${String(e).slice(0, 100)}`, 'danger')
        return false
      }
    },

    async open(): Promise<boolean> {
      const ui = useUiStore()
      const canProceed = await this.guardUnsavedChanges(
        'Abrir outro projeto descartará as alterações não salvas do projeto atual.',
      )
      if (!canProceed) return false

      const picked = await openProjectFile()
      if (!picked) return false

      try {
        this.applyProjectFile(picked.data, picked.path)
        ui.notify(`Projeto aberto: ${basename(picked.path)}`, 'success')
        return true
      } catch {
        ui.notify('Arquivo .regua inválido ou corrompido', 'danger')
        return false
      }
    },

    async requestNewProject(): Promise<boolean> {
      const canProceed = await this.guardUnsavedChanges(
        'Criar um novo projeto descartará as alterações não salvas do projeto atual.',
      )
      if (!canProceed) return false
      this.newProject()
      useUiStore().notify('Novo projeto criado', 'info')
      return true
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
      this.filePath = null
      this.isDirty = false
      this.lastSavedAt = null
      const timeline = useTimelineStore()
      timeline.reset()
    },
  },
})
