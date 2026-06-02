import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { extractClipThumbnails, isTauri, toMediaSrc } from '@/tauri/commands'
import { useProjectStore } from '@/stores/project'
import type { Clip } from '@/types'

/** Largura de cada célula na timeline (só visual — o zoom estica via repetição, não re-gera). */
export const THUMB_DISPLAY_PX = 72
/** Resolução na extração (~2× a célula para ficar nítido). */
const THUMB_EXTRACT_W = 144
/** Máximo de frames extraídos por clipe (independente do zoom). */
const MAX_SOURCE_THUMBS = 12

const sessionCache = new Map<string, string[]>()

/** Limpa cache em memória após trim / split. */
export function invalidateFilmstripSession(src: string) {
  for (const key of [...sessionCache.keys()]) {
    if (key.startsWith(`${src}|`)) sessionCache.delete(key)
  }
}

/** Fila global: um clipe por vez no FFmpeg para não travar a UI. */
let extractChain = Promise.resolve()

function enqueueExtract<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => extractChain.then(fn, fn)
  extractChain = run().then(
    () => undefined,
    () => undefined,
  )
  return run()
}

function cacheKey(src: string, inPoint: number, duration: number, count: number): string {
  return `${src}|${inPoint.toFixed(3)}|${duration.toFixed(3)}|${count}`
}

/** Quantidade de frames a extrair — só depende da duração do clipe, não do zoom. */
export function sourceThumbCount(duration: number): number {
  return Math.min(MAX_SOURCE_THUMBS, Math.max(4, Math.ceil(duration / 1.5)))
}

/** Repete o conjunto de miniaturas para preencher a largura do clipe ao dar zoom. */
export function expandThumbsForWidth(sources: string[], clipWidthPx: number): string[] {
  if (!sources.length) return []
  const slots = Math.max(1, Math.ceil(clipWidthPx / THUMB_DISPLAY_PX))
  if (slots <= sources.length) return sources.slice(0, slots)
  return Array.from({ length: slots }, (_, i) => sources[i % sources.length]!)
}

async function captureViaVideo(
  src: string,
  inPoint: number,
  duration: number,
  count: number,
): Promise<string[]> {
  const url = (await toMediaSrc(src)) ?? src
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error('vídeo indisponível para miniaturas'))
    }
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('error', onErr)
    }
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('error', onErr)
    video.load()
  })

  const canvas = document.createElement('canvas')
  canvas.width = THUMB_EXTRACT_W
  canvas.height = Math.round(
    (THUMB_EXTRACT_W * (video.videoHeight || 9)) / (video.videoWidth || 16),
  )
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const step = duration / count
  const urls: string[] = []

  for (let i = 0; i < count; i++) {
    const t = inPoint + (i + 0.5) * step
    video.currentTime = Math.min(t, Math.max(0, video.duration - 0.05))
    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener('seeked', done)
        resolve()
      }
      video.addEventListener('seeked', done)
    })
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    urls.push(canvas.toDataURL('image/jpeg', 0.82))
  }

  video.removeAttribute('src')
  video.load()
  return urls
}

export function useClipFilmstrip(clip: () => Clip, clipWidthPx: () => number) {
  const project = useProjectStore()
  const sourceThumbs = ref<string[]>([])
  const loading = ref(false)
  const failed = ref(false)

  const asset = computed(() => {
    const id = clip().assetId
    return id ? project.assets.find((a) => a.id === id) : undefined
  })

  const showFilmstrip = computed(() => {
    const k = clip().kind
    return (k === 'video' || k === 'image') && !!asset.value?.src
  })

  const extractCount = computed(() => {
    if (!showFilmstrip.value) return 0
    return sourceThumbCount(clip().duration)
  })

  const displayThumbs = computed(() =>
    expandThumbsForWidth(sourceThumbs.value, clipWidthPx()),
  )

  let loadGen = 0

  async function load() {
    const c = clip()
    const a = asset.value
    const count = extractCount.value
    failed.value = false

    if (!showFilmstrip.value || !a?.src || count < 1) {
      sourceThumbs.value = []
      loading.value = false
      return
    }

    const key = cacheKey(a.src, c.inPoint, c.duration, count)
    const cached = sessionCache.get(key)
    if (cached?.length) {
      sourceThumbs.value = cached
      loading.value = false
      return
    }

    const gen = ++loadGen
    loading.value = true
    try {
      const urls = await enqueueExtract(async () => {
        let result = isTauri()
          ? await extractClipThumbnails({
              path: a.src!,
              inPoint: c.inPoint,
              duration: c.duration,
              count,
              width: THUMB_EXTRACT_W,
            })
          : []

        if (!result.length && c.kind === 'video') {
          result = await captureViaVideo(a.src!, c.inPoint, c.duration, count)
        }
        return result
      })

      if (gen !== loadGen) return
      sourceThumbs.value = urls
      if (urls.length) sessionCache.set(key, urls)
      else failed.value = true
    } catch (err) {
      console.warn('[filmstrip]', err)
      if (gen !== loadGen) return
      try {
        if (c.kind === 'video' && a.src) {
          const urls = await captureViaVideo(a.src, c.inPoint, c.duration, count)
          if (gen !== loadGen) return
          sourceThumbs.value = urls
          if (urls.length) {
            sessionCache.set(key, urls)
            return
          }
        }
      } catch (fallbackErr) {
        console.warn('[filmstrip] fallback', fallbackErr)
      }
      sourceThumbs.value = []
      failed.value = true
    } finally {
      if (gen === loadGen) loading.value = false
    }
  }

  watch(
    () => ({
      id: clip().id,
      assetId: clip().assetId,
      inPoint: clip().inPoint,
      duration: clip().duration,
      outPoint: clip().outPoint,
      kind: clip().kind,
      src: asset.value?.src,
    }),
    () => void load(),
    { immediate: true },
  )

  onBeforeUnmount(() => {
    loadGen++
  })

  return { displayThumbs, sourceThumbs, loading, failed, showFilmstrip }
}
