/* ============================================================
   Modelo de dados do Editá-lo-ei
   Project → Track[] → Clip[]  ↔  Asset[]
   ============================================================ */

export type AssetKind = 'video' | 'audio' | 'image' | 'text'
export type TrackType = 'video' | 'audio'

/** Mídia importada para a biblioteca (fonte). */
export interface Asset {
  id: string
  name: string
  kind: AssetKind
  /** Duração da fonte em segundos (0 para imagem/texto). */
  duration: number
  /** Caminho/URL da fonte — preenchido pelo backend Tauri. */
  src?: string
  /** Dimensões nativas (vídeo/imagem). */
  width?: number
  height?: number
  /** Tamanho do arquivo em bytes. */
  fileSize?: number
  createdAt: number
}

/** Instância de uma mídia posicionada na timeline. */
export interface Clip {
  id: string
  assetId: string | null
  name: string
  kind: AssetKind
  trackId: string
  /** Posição na timeline, em segundos. */
  start: number
  /** Duração na timeline, em segundos. */
  duration: number
  /** Recorte da fonte (in/out), em segundos. */
  inPoint: number
  outPoint: number
  /* Transform */
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  /* Áudio */
  volume: number
  /** Cor do bloco na timeline. */
  color: string
}

export interface Track {
  id: string
  name: string
  type: TrackType
  /** Ordem de empilhamento (0 = topo). */
  index: number
  muted: boolean
  locked: boolean
  hidden: boolean
  height: number
  /** Trilha criada manualmente (+); não é removida automaticamente quando vazia. */
  userCreated?: boolean
}

export interface Project {
  id: string
  name: string
  fps: number
  width: number
  height: number
  sampleRate: number
  createdAt: number
  modifiedAt: number
}

/** Arquivo .elei — projeto completo serializado. */
export interface ProjectFile {
  version: 1
  project: Project
  assets: Asset[]
  tracks: Track[]
  clips: Clip[]
}

export type RenderStatus = 'idle' | 'ready' | 'exporting' | 'error'

export type UnsavedAction = 'save' | 'discard' | 'cancel'

export interface UnsavedDialogState {
  title: string
  message: string
}

export interface SystemMessage {
  id: string
  text: string
  tone: 'info' | 'success' | 'warning' | 'danger'
}
