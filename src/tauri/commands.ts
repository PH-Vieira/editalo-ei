/* ============================================================
   Ponte tipada Frontend ⇄ Backend (Tauri/Rust + FFmpeg sidecar).

   No app desktop (Tauri) usa diálogos nativos, ffprobe e ffmpeg.
   No navegador (vite dev) cai em fallbacks mock para a UI continuar viva.
   ============================================================ */
import type { Asset, ProjectFile } from '@/types'
import { uid } from '@/utils/id'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_IPC__' in window
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const api = await import('@tauri-apps/api/tauri')
  return api.invoke<T>(cmd, args)
}

/** Converte um caminho do sistema em URL utilizável por <video>/<img>. */
export async function toMediaSrc(path?: string): Promise<string | undefined> {
  if (!path) return undefined
  if (!isTauri()) return path
  const api = await import('@tauri-apps/api/tauri')
  return api.convertFileSrc(path)
}

/* ---------- Probe ---------- */

export interface MediaProbe {
  path: string
  kind: 'video' | 'audio' | 'image'
  duration: number
  width: number
  height: number
  fps: number
}

export async function probeMedia(path: string): Promise<MediaProbe> {
  if (isTauri()) return invoke<MediaProbe>('probe_media', { path })
  return { path, kind: 'video', duration: 0, width: 1920, height: 1080, fps: 30 }
}

/** Inspeciona e prepara mídia para a biblioteca (GIF animado → MP4 em cache). */
export async function prepareImportMedia(path: string): Promise<MediaProbe> {
  if (isTauri()) return invoke<MediaProbe>('prepare_import_media', { path })
  return probeMedia(path)
}

/* ---------- Importação ---------- */

const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v']
const AUDIO_EXT = ['wav', 'mp3', 'aac', 'm4a', 'ogg', 'flac']
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function isGifPath(path: string): boolean {
  return path.toLowerCase().endsWith('.gif')
}

export type ImportProgress =
  | { phase: 'converting-gif'; name: string }
  | { phase: 'importing'; name: string }

/** Abre o diálogo nativo, inspeciona cada arquivo e devolve os assets. */
export async function importMedia(
  onProgress?: (progress: ImportProgress) => void,
): Promise<Asset[]> {
  if (!isTauri()) {
    // No navegador (vite dev) não há acesso a arquivos: importação real só no desktop.
    return []
  }

  const { open } = await import('@tauri-apps/api/dialog')
  const selected = await open({
    multiple: true,
    filters: [{ name: 'Mídia', extensions: [...VIDEO_EXT, ...AUDIO_EXT, ...IMAGE_EXT] }],
  })
  if (!selected) return []
  const paths = Array.isArray(selected) ? selected : [selected]

  const assets: Asset[] = []
  for (const path of paths) {
    const name = basename(path)
    if (isGifPath(path)) {
      onProgress?.({ phase: 'converting-gif', name })
    } else {
      onProgress?.({ phase: 'importing', name })
    }
    const probe = await prepareImportMedia(path)
    assets.push({
      id: uid('as'),
      name,
      kind: probe.kind,
      duration: probe.duration,
      width: probe.width || undefined,
      height: probe.height || undefined,
      src: probe.path,
      createdAt: Date.now(),
    } as Asset)
  }
  return assets
}

/* ---------- Projeto (persistência .elei) ---------- */

/** Abre o diálogo nativo para escolher onde salvar o projeto. */
export async function pickProjectSavePath(suggested: string): Promise<string | null> {
  if (!isTauri()) return suggested
  const { save } = await import('@tauri-apps/api/dialog')
  return (await save({
    defaultPath: suggested.endsWith('.elei') ? suggested : `${suggested}.elei`,
    filters: [{ name: 'Projeto Editá-lo-ei', extensions: ['elei'] }],
  })) as string | null
}

function ensureEleiExtension(path: string): string {
  return path.toLowerCase().endsWith('.elei') ? path : `${path}.elei`
}

function downloadProjectFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Grava o projeto completo em um arquivo .elei. */
export async function writeProjectFile(path: string, data: ProjectFile): Promise<string> {
  const normalized = ensureEleiExtension(path)
  const content = JSON.stringify(data, null, 2)

  if (isTauri()) {
    await invoke('save_project_file', { path: normalized, content })
    return normalized
  }

  const name = normalized.split(/[/\\]/).pop() ?? 'projeto.elei'
  downloadProjectFile(content, name)
  return normalized
}

function parseProjectFile(raw: unknown): ProjectFile {
  if (!raw || typeof raw !== 'object') throw new Error('Arquivo .elei inválido')
  const data = raw as Partial<ProjectFile>
  if (data.version !== 1 || !data.project) throw new Error('Formato .elei não reconhecido')
  return {
    version: 1,
    project: data.project,
    assets: Array.isArray(data.assets) ? data.assets : [],
    tracks: Array.isArray(data.tracks) ? data.tracks : [],
    clips: Array.isArray(data.clips) ? data.clips : [],
  }
}

/** Abre o diálogo nativo para escolher um projeto .elei. */
export async function pickProjectOpenPath(): Promise<string | null> {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/api/dialog')
  return (await open({
    multiple: false,
    filters: [{ name: 'Projeto Editá-lo-ei', extensions: ['elei'] }],
  })) as string | null
}

/** Lê um projeto .elei do disco. */
export async function readProjectFile(path: string): Promise<ProjectFile> {
  const content = isTauri()
    ? await invoke<string>('load_project_file', { path })
    : await fetch(path).then((r) => r.text())
  return parseProjectFile(JSON.parse(content))
}

/** No navegador: seleciona um .elei e devolve conteúdo + nome do arquivo. */
export async function pickProjectFileBrowser(): Promise<{ path: string; data: ProjectFile } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.elei,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      try {
        const data = parseProjectFile(JSON.parse(await file.text()))
        resolve({ path: file.name, data })
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}

/** Abre diálogo/seletor e carrega um projeto. */
export async function openProjectFile(): Promise<{ path: string; data: ProjectFile } | null> {
  if (isTauri()) {
    const path = await pickProjectOpenPath()
    if (!path) return null
    try {
      const data = await readProjectFile(path)
      return { path, data }
    } catch {
      return null
    }
  }
  return pickProjectFileBrowser()
}

/* ---------- Exportação ---------- */

export type ExportFormat = 'mp4' | 'mp3' | 'gif'

export interface ExportSegment {
  path: string
  inPoint: number
  duration: number
}

export interface ExportRequest {
  segments: ExportSegment[]
  outputPath: string
  width: number
  height: number
  fps: number
  format: ExportFormat
}

export interface ExportProgress {
  progress: number
  done: boolean
  output?: string
}

/** Pede o destino do arquivo ao usuário, filtrando pelo formato escolhido. */
export async function pickExportPath(
  suggested: string,
  format: ExportFormat = 'mp4',
): Promise<string | null> {
  if (!isTauri()) return suggested
  const { save } = await import('@tauri-apps/api/dialog')
  const filters: Record<ExportFormat, { name: string; extensions: string[] }> = {
    mp4: { name: 'Vídeo MP4',    extensions: ['mp4'] },
    mp3: { name: 'Áudio MP3',    extensions: ['mp3'] },
    gif: { name: 'GIF Animado',  extensions: ['gif'] },
  }
  return (await save({
    defaultPath: suggested,
    filters: [filters[format]],
  })) as string | null
}

/** Escuta o progresso da exportação; retorna função para parar de escutar. */
export async function onExportProgress(cb: (p: ExportProgress) => void): Promise<() => void> {
  if (!isTauri()) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen<ExportProgress>('export://progress', (e) => cb(e.payload))
}

export interface ThumbnailRequest {
  path: string
  inPoint: number
  duration: number
  count: number
  width?: number
}

const filmstripCache = new Map<string, string[]>()

/** Frames JPEG do trecho visível do clipe (cache em disco via FFmpeg). */
export async function extractClipThumbnails(req: ThumbnailRequest): Promise<string[]> {
  const count = Math.min(16, Math.max(1, Math.round(req.count)))
  const width = req.width ?? 96
  const key = `${req.path}|${req.inPoint}|${req.duration}|${count}|${width}`
  const hit = filmstripCache.get(key)
  if (hit) return hit

  if (!isTauri()) return []

  const paths = await invoke<string[]>('extract_thumbnails', {
    request: { path: req.path, inPoint: req.inPoint, duration: req.duration, count, width },
  })
  const urls = await Promise.all(
    paths.map(async (p) => (await toMediaSrc(p)) ?? p),
  )
  if (urls.length) filmstripCache.set(key, urls)
  return urls
}

/** Limpa cache de miniaturas (ex.: após trim do clipe). */
export function invalidateFilmstripCache(src?: string) {
  if (!src) {
    filmstripCache.clear()
    return
  }
  for (const key of [...filmstripCache.keys()]) {
    if (key.startsWith(`${src}|`)) filmstripCache.delete(key)
  }
}

export interface WaveformRequest {
  path: string
  inPoint: number
  duration: number
  bins: number
}

const waveformCache = new Map<string, number[]>()

export async function extractClipWaveform(req: WaveformRequest): Promise<number[]> {
  const bins = Math.min(512, Math.max(48, Math.round(req.bins)))
  const key = `${req.path}|${req.inPoint}|${req.duration}|${bins}`
  const hit = waveformCache.get(key)
  if (hit) return hit

  if (!isTauri()) return []

  const peaks = await invoke<number[]>('extract_waveform', {
    request: { path: req.path, inPoint: req.inPoint, duration: req.duration, bins },
  })
  if (peaks.length) waveformCache.set(key, peaks)
  return peaks
}

export function invalidateWaveformCache(src?: string) {
  if (!src) {
    waveformCache.clear()
    return
  }
  for (const key of [...waveformCache.keys()]) {
    if (key.startsWith(`${src}|`)) waveformCache.delete(key)
  }
}

/** Renderiza a timeline para um arquivo .mp4 via FFmpeg. */
export async function exportVideo(req: ExportRequest): Promise<string> {
  if (isTauri()) return invoke<string>('export_video', { request: req })
  // Fallback: simula a render no navegador.
  await new Promise((r) => setTimeout(r, 1200))
  return req.outputPath
}
