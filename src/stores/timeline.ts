import { defineStore } from 'pinia'
import type { Asset, Clip, Track, TrackType } from '@/types'
import { clamp } from '@/utils/time'
import { uid } from '@/utils/id'
import { useUiStore } from './ui'

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
  pixelsPerSecond: number
  tailPadding: number
  _undo: HistorySnap[]
  _redo: HistorySnap[]
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export const useTimelineStore = defineStore('timeline', {
  state: (): TimelineState => ({
    tracks: [
      { id: 'tr_v1_init', name: 'Vídeo 1', type: 'video', index: 0,    muted: false, locked: false, hidden: false, height: 64 },
      { id: 'tr_a1_init', name: 'Áudio 1', type: 'audio', index: 1000, muted: false, locked: false, hidden: false, height: 56 },
    ],
    clips: [],
    selectedClipId: null,
    currentTime: 0,
    isPlaying: false,
    pixelsPerSecond: DEFAULT_PPS,
    tailPadding: 4,
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
    duration(): number {
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
    },

    undo() {
      const snap = this._undo.pop()
      if (!snap) { useUiStore().notify('Nada para desfazer', 'info'); return }
      this._redo.push({ clips: deepClone(this.clips), tracks: deepClone(this.tracks) })
      this.clips = snap.clips
      this.tracks = snap.tracks
      if (!this.clips.find((c) => c.id === this.selectedClipId)) this.selectedClipId = null
      useUiStore().notify('Desfeito', 'info')
    },

    redo() {
      const snap = this._redo.pop()
      if (!snap) { useUiStore().notify('Nada para refazer', 'info'); return }
      this._undo.push({ clips: deepClone(this.clips), tracks: deepClone(this.tracks) })
      this.clips = snap.clips
      this.tracks = snap.tracks
      if (!this.clips.find((c) => c.id === this.selectedClipId)) this.selectedClipId = null
      useUiStore().notify('Refeito', 'info')
    },

    /* ------------------------------------------------------------------ */
    /* Seleção                                                             */
    /* ------------------------------------------------------------------ */

    selectClip(id: string | null) {
      this.selectedClipId = id
    },

    /* ------------------------------------------------------------------ */
    /* Playhead / reprodução                                              */
    /* ------------------------------------------------------------------ */

    setCurrentTime(t: number) {
      this.currentTime = clamp(t, 0, this.duration)
    },
    play() {
      if (this.currentTime >= this.contentEnd) this.currentTime = 0
      this.isPlaying = true
    },
    pause() { this.isPlaying = false },
    togglePlay() { this.isPlaying ? this.pause() : this.play() },
    stop() { this.isPlaying = false; this.currentTime = 0 },

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

    _createTrack(type: TrackType): Track {
      const count = this.tracks.filter((t) => t.type === type).length + 1
      // index: vídeos recebem índices pares baixos, áudios altos — orderedTracks reordena pelo tipo.
      const index = type === 'video'
        ? this.tracks.filter((t) => t.type === 'video').length
        : 1000 + this.tracks.filter((t) => t.type === 'audio').length
      const track: Track = {
        id: uid('tr'),
        name: `${type === 'video' ? 'Vídeo' : 'Áudio'} ${count}`,
        type,
        index,
        muted: false,
        locked: false,
        hidden: false,
        height: type === 'video' ? 64 : 56,
      }
      this.tracks.push(track)
      return track
    },

    /** Adiciona clipe a partir de um asset; cria trilha automaticamente se necessário. */
    addClipFromAsset(asset: Asset, trackId?: string, start?: number): Clip {
      this.snapshot()
      const ui = useUiStore()
      const type: TrackType = asset.kind === 'audio' ? 'audio' : 'video'
      const duration = asset.duration > 0 ? asset.duration : 5

      let track: Track | undefined
      if (trackId) {
        track = this.tracks.find((t) => t.id === trackId)
      }

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
      // Remove trilhas que ficaram vazias (exceto se só há 1 de cada tipo).
      this._pruneEmptyTracks()
    },

    /** Remove trilhas vazias além do mínimo de 1 por tipo. */
    _pruneEmptyTracks() {
      const occupied = new Set(this.clips.map((c) => c.trackId))
      for (const type of ['video', 'audio'] as TrackType[]) {
        const byType = this.tracks.filter((t) => t.type === type).sort((a, b) => a.index - b.index)
        const emptyTracks = byType.filter((t) => !occupied.has(t.id))
        // Mantém pelo menos 1 vazia como ponto de queda; remove o restante
        const occupiedCount = byType.length - emptyTracks.length
        const keepEmpty = Math.max(0, 1 - occupiedCount)
        const toRemove = new Set(emptyTracks.slice(keepEmpty).map((t) => t.id))
        this.tracks = this.tracks.filter((t) => !toRemove.has(t.id))
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
      ui.notify('Clipe dividido', 'info')
    },

    /** Chamado pelo drag — o snapshot deve ter sido tirado ANTES no componente. */
    moveClip(id: string, start: number, trackId?: string) {
      const clip = this.clips.find((c) => c.id === id)
      if (!clip) return
      clip.start = Math.max(0, start)
      if (trackId) clip.trackId = trackId
    },

    updateClip(id: string, patch: Partial<Clip>) {
      const clip = this.clips.find((c) => c.id === id)
      if (clip) Object.assign(clip, patch)
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
      this.tracks = [
        { id: uid('tr'), name: 'Vídeo 1', type: 'video', index: 0,    muted: false, locked: false, hidden: false, height: 64 },
        { id: uid('tr'), name: 'Áudio 1', type: 'audio', index: 1000, muted: false, locked: false, hidden: false, height: 56 },
      ]
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
