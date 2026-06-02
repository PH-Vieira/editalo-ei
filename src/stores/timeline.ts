import { defineStore } from 'pinia'
import type { Asset, AssetKind, Clip, Track, TrackType } from '@/types'
import { clamp } from '@/utils/time'
import { uid } from '@/utils/id'
import {
  canPlaceClipOnTrack,
  canPlaceOnTrack,
  incompatibleTrackMessage,
  trackTypeForKind,
} from '@/utils/trackCompat'
import { useUiStore } from './ui'
import { invalidateClipMediaCaches } from '@/utils/clipMediaCache'

export const MIN_PPS = 14
export const MAX_PPS = 320
const DEFAULT_PPS = 64
const MAX_HISTORY = 60

interface HistorySnap {
  clips: Clip[]
  tracks: Track[]
}

interface TimelineState {
  tracks: Track[]
  clips: Clip[]
  selectedClipId: string | null
  currentTime: number
  isPlaying: boolean
  /** Enquanto o usuário arrasta o playhead / régua / scrubber — o preview não sobrescreve o tempo. */
  isUserSeeking: boolean
  pixelsPerSecond: number
  tailPadding: number
  _clipboard: Clip | null
  _undo: HistorySnap[]
  _redo: HistorySnap[]
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export const useTimelineStore = defineStore('timeline', {
  state: (): TimelineState => ({
    tracks: [],
    clips: [],
    selectedClipId: null,
    currentTime: 0,
    isPlaying: false,
    isUserSeeking: false,
    pixelsPerSecond: DEFAULT_PPS,
    tailPadding: 4,
    _clipboard: null,
    _undo: [],
    _redo: [],
  }),

  getters: {
    /** Vídeos no topo (index menor), áudios abaixo; dentro do tipo: por index. */
    orderedTracks(state): Track[] {
      return [...state.tracks].sort((a, b) => {
        const tp = (t: Track) => (t.type === 'video' ? 0 : 1)
        if (tp(a) !== tp(b)) return tp(a) - tp(b)
        return a.index - b.index
      })
    },
    clipsByTrack(state) {
      return (trackId: string): Clip[] =>
        state.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start)
    },
    selectedClip(state): Clip | null {
      return state.clips.find((c) => c.id === state.selectedClipId) ?? null
    },
    contentEnd(state): number {
      return state.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0)
    },
    hasClips(state): boolean {
      return state.clips.length > 0
    },
    /** Duração visível: 0 sem clipes; com mídia, fim do conteúdo + margem para editar. */
    duration(): number {
      if (!this.hasClips) return 0
      return this.contentEnd + this.tailPadding
    },
    secondsToPx(state) {
      return (s: number) => s * state.pixelsPerSecond
    },
    pxToSeconds(state) {
      return (px: number) => px / state.pixelsPerSecond
    },
    canUndo(state): boolean {
      return state._undo.length > 0
    },
    canRedo(state): boolean {
      return state._redo.length > 0
    },
  },

  actions: {
    /* ------------------------------------------------------------------ */
    /* Histórico                                                           */
    /* ------------------------------------------------------------------ */

    /** Salva o estado atual antes de uma operação destrutiva. */
    snapshot() {
      const snap: HistorySnap = {
        clips: deepClone(this.clips),
        tracks: deepClone(this.tracks),
      }
      this._undo.push(snap)
      if (this._undo.length > MAX_HISTORY) this._undo.shift()
      this._redo = []
      void import('@/stores/project').then(({ useProjectStore }) => useProjectStore().touch())
    },

    undo() {
      const snap = this._undo.pop()
      if (!snap) { useUiStore().notify('Nada para desfazer', 'info'); return }
      this._redo.push({ clips: deepClone(this.clips), tracks: deepClone(this.tracks) })
      this.clips = snap.clips
      this.tracks = snap.tracks
      if (!this.clips.find((c) => c.id === this.selectedClipId)) this.selectedClipId = null
      void import('@/stores/project').then(({ useProjectStore }) => useProjectStore().touch())
      useUiStore().notify('Desfeito', 'info')
    },

    redo() {
      const snap = this._redo.pop()
      if (!snap) { useUiStore().notify('Nada para refazer', 'info'); return }
      this._undo.push({ clips: deepClone(this.clips), tracks: deepClone(this.tracks) })
      this.clips = snap.clips
      this.tracks = snap.tracks
      if (!this.clips.find((c) => c.id === this.selectedClipId)) this.selectedClipId = null
      void import('@/stores/project').then(({ useProjectStore }) => useProjectStore().touch())
      useUiStore().notify('Refeito', 'info')
    },

    /* ------------------------------------------------------------------ */
    /* Seleção                                                             */
    /* ------------------------------------------------------------------ */

    selectClip(id: string | null) {
      this.selectedClipId = id
    },

    /* ------------------------------------------------------------------ */
    /* Área de transferência (clipes)                                     */
    /* ------------------------------------------------------------------ */

    copySelectedClip() {
      const clip = this.selectedClip
      if (!clip) {
        useUiStore().notify('Selecione um clipe para copiar', 'info')
        return false
      }
      this._clipboard = deepClone(clip)
      return true
    },

    pasteClipboard() {
      if (!this._clipboard) {
        useUiStore().notify('Nada na área de transferência', 'info')
        return
      }
      const src = this._clipboard
      const ui = useUiStore()
      this.snapshot()

      const type: TrackType = src.kind === 'audio' ? 'audio' : 'video'
      let track = this.tracks.find((t) => t.id === src.trackId && !t.locked)
      if (track && !canPlaceClipOnTrack(src, track)) track = undefined
      if (!track) {
        track =
          this.tracks.find((t) => t.type === type && !t.locked)
          ?? this._createTrack(type)
      }

      let start = this.snapStart(
        this.currentTime,
        '__new__',
        track.id,
        src.duration,
        this.pixelsPerSecond,
      )
      const others = this.clipsByTrack(track.id)
      const overlap = others.some(
        (c) => start < c.start + c.duration - 0.01 && start + src.duration > c.start + 0.01,
      )
      if (overlap) {
        start = others.reduce((max, c) => Math.max(max, c.start + c.duration), 0)
      }

      const clip: Clip = {
        ...deepClone(src),
        id: uid('cl'),
        trackId: track.id,
        start,
        outPoint: src.inPoint + src.duration,
      }
      this.clips.push(clip)
      this.selectClip(clip.id)
      ui.notify(`"${clip.name}" colado`, 'info')
    },

    duplicateSelectedClip() {
      const src = this.selectedClip
      if (!src) {
        useUiStore().notify('Selecione um clipe para duplicar', 'info')
        return
      }
      this.snapshot()
      const ui = useUiStore()
      const clipType: TrackType = src.kind === 'audio' ? 'audio' : 'video'
      const track =
        this.tracks.find((t) => t.id === src.trackId && !t.locked)
        ?? this.tracks.find((t) => t.type === clipType && !t.locked)
        ?? this._createTrack(clipType)

      let start = this.snapStart(
        src.start + src.duration,
        '__new__',
        track.id,
        src.duration,
        this.pixelsPerSecond,
      )

      const clip: Clip = {
        ...deepClone(src),
        id: uid('cl'),
        trackId: track.id,
        start,
      }
      this.clips.push(clip)
      this.selectClip(clip.id)
      ui.notify(`"${clip.name}" duplicado`, 'info')
    },

    /* ------------------------------------------------------------------ */
    /* Playhead / reprodução                                              */
    /* ------------------------------------------------------------------ */

    setCurrentTime(t: number) {
      if (!this.hasClips) {
        this.currentTime = 0
        return
      }
      this.currentTime = clamp(t, 0, this.duration)
    },
    beginUserSeek() {
      this.isUserSeeking = true
    },
    endUserSeek() {
      this.isUserSeeking = false
    },
    /** Busca pontual (teclado etc.) durante reprodução sem travar o playhead. */
    userSeekTo(t: number) {
      if (!this.hasClips) return
      this.beginUserSeek()
      this.setCurrentTime(t)
      requestAnimationFrame(() => this.endUserSeek())
    },
    play() {
      if (!this.hasClips) return
      if (this.currentTime >= this.contentEnd) this.currentTime = 0
      this.isPlaying = true
    },
    pause() { this.isPlaying = false },
    togglePlay() { this.isPlaying ? this.pause() : this.play() },
    stop() {
      this.isPlaying = false
      this.isUserSeeking = false
      this.currentTime = 0
    },

    /* ------------------------------------------------------------------ */
    /* Zoom                                                                */
    /* ------------------------------------------------------------------ */

    setZoom(pps: number) { this.pixelsPerSecond = clamp(pps, MIN_PPS, MAX_PPS) },
    zoomBy(factor: number) { this.setZoom(this.pixelsPerSecond * factor) },
    zoomToFit(viewportPx: number) {
      if (this.duration > 0) this.setZoom(viewportPx / this.duration)
    },

    /* ------------------------------------------------------------------ */
    /* Trilhas dinâmicas                                                  */
    /* ------------------------------------------------------------------ */

    /** Encontra ou cria a trilha ideal para um tipo/posição/duração. */
    _findOrCreateTrack(type: TrackType, start: number, duration: number): Track {
      const compatible = this.tracks.filter((t) => t.type === type && !t.locked)

      // Procura trilha sem sobreposição no intervalo pedido.
      for (const track of compatible) {
        const hasOverlap = this.clipsByTrack(track.id).some(
          (c) => start < c.start + c.duration && start + duration > c.start,
        )
        if (!hasOverlap) return track
      }

      // Nenhuma livre → cria nova trilha.
      return this._createTrack(type)
    },

    /** Cria uma trilha vazia manualmente (com undo). */
    addTrack(type: TrackType): Track {
      this.snapshot()
      const track = this._createTrack(type, { userCreated: true })
      useUiStore().notify(`${track.name} adicionada`, 'info')
      return track
    },

    renameTrack(id: string, name: string) {
      const trimmed = name.trim()
      if (!trimmed) return
      const track = this.tracks.find((t) => t.id === id)
      if (!track || track.name === trimmed) return
      this.snapshot()
      track.name = trimmed
    },

    /** Remove trilha e todos os clipes nela. */
    removeTrack(id: string) {
      const track = this.tracks.find((t) => t.id === id)
      if (!track) return
      const ui = useUiStore()
      if (track.locked) {
        ui.notify('Destrave a trilha antes de remover', 'warning')
        return
      }
      this.snapshot()
      this.clips = this.clips.filter((c) => c.trackId !== id)
      if (this.selectedClipId && !this.clips.some((c) => c.id === this.selectedClipId)) {
        this.selectedClipId = null
      }
      this.tracks = this.tracks.filter((t) => t.id !== id)
      this._reindexTracks(track.type)
      this._syncTimeAfterClipsChange()
      ui.notify(`"${track.name}" removida`, 'info')
    },

    /** Sobe a trilha na pilha do mesmo tipo (índice menor = mais acima). */
    moveTrackUp(id: string) {
      this._moveTrackBy(id, -1)
    },

    /** Desce a trilha na pilha do mesmo tipo. */
    moveTrackDown(id: string) {
      this._moveTrackBy(id, 1)
    },

    _moveTrackBy(id: string, delta: -1 | 1) {
      const track = this.tracks.find((t) => t.id === id)
      if (!track) return
      const ordered = this.tracks
        .filter((t) => t.type === track.type)
        .sort((a, b) => a.index - b.index)
      const idx = ordered.findIndex((t) => t.id === id)
      const target = ordered[idx + delta]
      if (!track || !target) return
      this.snapshot()
      const tmp = track.index
      track.index = target.index
      target.index = tmp
    },

    _createTrack(type: TrackType, opts?: { userCreated?: boolean }): Track {
      const count = this.tracks.filter((t) => t.type === type).length + 1
      const sameType = this.tracks.filter((t) => t.type === type)
      const index = sameType.length > 0 ? Math.max(...sameType.map((t) => t.index)) + 1 : 0
      const track: Track = {
        id: uid('tr'),
        name: `${type === 'video' ? 'Vídeo' : 'Áudio'} ${count}`,
        type,
        index,
        muted: false,
        locked: false,
        hidden: false,
        height: type === 'video' ? 64 : 56,
        userCreated: opts?.userCreated ?? false,
      }
      this.tracks.push(track)
      return track
    },

    _reindexTracks(type: TrackType) {
      const list = this.tracks
        .filter((t) => t.type === type)
        .sort((a, b) => a.index - b.index)
      list.forEach((t, i) => {
        t.index = i
      })
    },

    canPlaceClipOnTrack(kind: AssetKind, track: Track): boolean {
      return canPlaceOnTrack(kind, track)
    },

    /** Adiciona clipe a partir de um asset; cria trilha automaticamente se necessário. */
    addClipFromAsset(asset: Asset, trackId?: string, start?: number): Clip | null {
      const ui = useUiStore()
      const type = trackTypeForKind(asset.kind)
      const duration = asset.duration > 0 ? asset.duration : 5

      let track: Track | undefined
      if (trackId) {
        track = this.tracks.find((t) => t.id === trackId)
        if (track && !canPlaceOnTrack(asset.kind, track)) {
          ui.notify(incompatibleTrackMessage(asset.kind, track.name), 'warning')
          return null
        }
      }

      this.snapshot()

      if (!track) {
        if (start !== undefined) {
          // Posição explícita: busca trilha sem sobreposição ou cria.
          track = this._findOrCreateTrack(type, start, duration)
        } else {
          // Sem posição: usa primeira trilha do tipo (append), cria se necessário.
          track = this.tracks.find((t) => t.type === type && !t.locked)
            ?? this._createTrack(type)
        }
      }

      // Posição padrão = fim da última trilha.
      if (start === undefined) {
        const trackClips = this.clipsByTrack(track.id)
        const last = trackClips[trackClips.length - 1]
        start = last ? last.start + last.duration : 0
      }

      const clip: Clip = {
        id: uid('cl'),
        assetId: asset.id,
        name: asset.name.replace(/\.[^.]+$/, ''),
        kind: asset.kind,
        trackId: track.id,
        start: start as number,
        duration,
        inPoint: 0,
        outPoint: duration,
        x: 0, y: 0, scale: 100, rotation: 0, opacity: 1,
        volume: asset.kind === 'audio' ? 0.8 : 1,
        color:
          asset.kind === 'video' ? 'var(--media-video)'
          : asset.kind === 'audio' ? 'var(--media-audio)'
          : asset.kind === 'image' ? 'var(--media-image)'
          : 'var(--media-text)',
      }
      this.clips.push(clip)
      this.selectClip(clip.id)
      ui.notify(`"${clip.name}" adicionado — ${track.name}`, 'info')
      return clip
    },

    removeClip(id: string) {
      this.snapshot()
      this.clips = this.clips.filter((c) => c.id !== id)
      if (this.selectedClipId === id) this.selectedClipId = null
      this._pruneEmptyTracks()
      this._syncTimeAfterClipsChange()
    },

    /** Remove todos os clipes que usam um asset da biblioteca. */
    removeClipsForAsset(assetId: string) {
      if (!this.clips.some((c) => c.assetId === assetId)) return
      this.snapshot()
      this.clips = this.clips.filter((c) => c.assetId !== assetId)
      if (this.selectedClipId && !this.clips.find((c) => c.id === this.selectedClipId)) {
        this.selectedClipId = null
      }
      this._pruneEmptyTracks()
      this._syncTimeAfterClipsChange()
    },

    _syncTimeAfterClipsChange() {
      if (!this.hasClips) {
        this.currentTime = 0
        this.isPlaying = false
        return
      }
      if (this.currentTime > this.contentEnd) this.currentTime = this.contentEnd
    },

    /** Remove trilhas vazias criadas automaticamente ao importar mídia. */
    _pruneEmptyTracks() {
      const occupied = new Set(this.clips.map((c) => c.trackId))
      for (const type of ['video', 'audio'] as TrackType[]) {
        this.tracks = this.tracks.filter(
          (t) => t.type !== type || t.userCreated || occupied.has(t.id),
        )
        this._reindexTracks(type)
      }
    },

    splitClipAt(time: number, clipId?: string) {
      const ui = useUiStore()
      const id = clipId ?? this.selectedClipId
      const clip = this.clips.find((c) => c.id === id)
      if (!clip) return
      const local = time - clip.start
      if (local <= 0.05 || local >= clip.duration - 0.05) {
        ui.notify('Posicione o playhead sobre o clipe para dividir', 'warning')
        return
      }
      this.snapshot()
      const right: Clip = {
        ...clip,
        id: uid('cl'),
        start: clip.start + local,
        duration: clip.duration - local,
        inPoint: clip.inPoint + local,
        outPoint: clip.outPoint,
      }
      clip.duration = local
      clip.outPoint = clip.inPoint + local
      this.clips.push(right)
      this.selectClip(right.id)
      this._invalidateClipMediaCache(clip)
      this._invalidateClipMediaCache(right)
      ui.notify('Clipe dividido', 'info')
    },

    _invalidateClipMediaCache(clip: Clip) {
      if (!clip.assetId) return
      void import('@/stores/project').then(({ useProjectStore }) => {
        const asset = useProjectStore().assets.find((a) => a.id === clip.assetId)
        if (asset?.src) invalidateClipMediaCaches(asset.src)
      })
    },

    /** Chamado pelo drag — o snapshot deve ter sido tirado ANTES no componente. */
    moveClip(id: string, start: number, trackId?: string) {
      const clip = this.clips.find((c) => c.id === id)
      if (!clip) return

      const targetId = trackId ?? clip.trackId
      const track = this.tracks.find((t) => t.id === targetId)
      if (!track || !canPlaceClipOnTrack(clip, track)) return

      const s = this.snapStart(
        Math.max(0, start),
        id,
        targetId,
        clip.duration,
        this.pixelsPerSecond,
      )
      clip.start = s
      clip.trackId = targetId
    },

    updateClip(id: string, patch: Partial<Clip>) {
      const clip = this.clips.find((c) => c.id === id)
      if (!clip) return
      Object.assign(clip, patch)
      void import('@/stores/project').then(({ useProjectStore }) => useProjectStore().touch())
    },

    toggleTrackFlag(id: string, flag: 'muted' | 'locked' | 'hidden') {
      const track = this.tracks.find((t) => t.id === id)
      if (track) track[flag] = !track[flag]
    },

    reset() {
      this.clips = []
      this.selectedClipId = null
      this.currentTime = 0
      this.isPlaying = false
      this._undo = []
      this._redo = []
      this.tracks = []
    },

    /** Restaura timeline a partir de um arquivo .regua. */
    loadState(tracks: Track[], clips: Clip[]) {
      this.tracks = deepClone(tracks)
      this.clips = deepClone(clips)
      this.selectedClipId = null
      this.currentTime = 0
      this.isPlaying = false
      this._undo = []
      this._redo = []
    },

    /* ------------------------------------------------------------------ */
    /* Snap + prevenção de sobreposição                                   */
    /* ------------------------------------------------------------------ */

    /**
     * Calcula a posição final de um clipe sendo arrastado:
     *   1. Snap: encaixa em bordas de qualquer clipe (todas as trilhas) + playhead + t=0
     *   2. No-overlap: empurra para a borda livre mais próxima (só trilha atual)
     */
    snapStart(rawStart: number, clipId: string, trackId: string, duration: number, pxPerSec: number): number {
      const SNAP_S = 9 / pxPerSec   // ~9 px de threshold

      // --- 1. Snap de bordas (todos os clipes + playhead + t=0) ---
      const pts: number[] = [0, this.currentTime]
      for (const c of this.clips) {
        if (c.id !== clipId) pts.push(c.start, c.start + c.duration)
      }

      let s = Math.max(0, rawStart)
      let snapped = false
      for (const p of pts) {
        if (Math.abs(s - p) < SNAP_S) { s = p; snapped = true; break }
      }
      if (!snapped) {
        for (const p of pts) {
          if (Math.abs(s + duration - p) < SNAP_S) { s = Math.max(0, p - duration); break }
        }
      }

      // --- 2. Prevenção de sobreposição (só trilha atual) ---
      const others = this.clipsByTrack(trackId).filter((c) => c.id !== clipId)
      if (others.length === 0) return s

      // Verifica se a posição atual já é válida (sem sobreposição)
      const overlaps = (pos: number) =>
        others.some((c) => pos < c.start + c.duration - 0.01 && pos + duration > c.start + 0.01)

      if (!overlaps(s)) return s

      // Monta candidatos: início da timeline + borda direita e esquerda de cada clipe
      const candidates: number[] = [0]
      for (const c of others) {
        candidates.push(c.start + c.duration)               // logo após este clipe
        const left = c.start - duration
        if (left >= 0) candidates.push(left)               // logo antes deste clipe
      }

      // Mantém apenas candidatos sem sobreposição
      const valid = candidates.filter((p) => p >= 0 && !overlaps(p))

      if (valid.length > 0) {
        // Escolhe o candidato mais próximo de onde o usuário arrastou
        return valid.reduce((best, p) =>
          Math.abs(p - rawStart) < Math.abs(best - rawStart) ? p : best,
        )
      }

      // Track totalmente ocupada — coloca depois de tudo
      return others.reduce((max, c) => Math.max(max, c.start + c.duration), 0)
    },

    /** Snap simples (sem resolução de sobreposição) — para handles de trim. */
    snapTime(rawTime: number, clipId: string, pxPerSec: number): number {
      const SNAP_S = 9 / pxPerSec
      const pts: number[] = [0, this.currentTime]
      for (const c of this.clips) {
        if (c.id !== clipId) { pts.push(c.start, c.start + c.duration) }
      }
      for (const p of pts) {
        if (Math.abs(rawTime - p) < SNAP_S) return p
      }
      return rawTime
    },
  },
})
