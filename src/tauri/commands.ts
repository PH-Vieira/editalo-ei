/* ============================================================
   Ponte tipada Frontend ⇄ Backend (Tauri/Rust + FFmpeg sidecar).

   No app desktop (Tauri) usa diálogos nativos, ffprobe e ffmpeg.
   No navegador (vite dev) cai em fallbacks mock para a UI continuar viva.
   ============================================================ */
import type { Asset, Project } from '@/types'
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

/* ---------- Importação ---------- */

const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v']
const AUDIO_EXT = ['wav', 'mp3', 'aac', 'm4a', 'ogg', 'flac']
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']

/** Abre o diálogo nativo, inspeciona cada arquivo e devolve os assets. */
export async function importMedia(): Promise<Asset[]> {
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

  return Promise.all(
    paths.map(async (path) => {
      const probe = await probeMedia(path)
      const name = path.split(/[\\/]/).pop() ?? path
      return {
        id: uid('as'),
        name,
        kind: probe.kind,
        duration: probe.duration,
        width: probe.width || undefined,
        height: probe.height || undefined,
        src: path,
        createdAt: Date.now(),
      } as Asset
    }),
  )
}

/* ---------- Projeto (persistência leve) ---------- */

export async function saveProject(project: Project, path = 'projeto.elei'): Promise<string> {
  // Persistência completa fica para depois; aqui só confirmamos o caminho.
  void JSON.stringify(project)
  if (!isTauri()) await new Promise((r) => setTimeout(r, 200))
  return path
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

/** Renderiza a timeline para um arquivo .mp4 via FFmpeg. */
export async function exportVideo(req: ExportRequest): Promise<string> {
  if (isTauri()) return invoke<string>('export_video', { request: req })
  // Fallback: simula a render no navegador.
  await new Promise((r) => setTimeout(r, 1200))
  return req.outputPath
}
