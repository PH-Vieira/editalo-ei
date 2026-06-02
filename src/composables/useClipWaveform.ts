import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { extractClipWaveform, isTauri } from '@/tauri/commands'
import { useProjectStore } from '@/stores/project'
import type { Clip } from '@/types'

const MAX_BINS = 256
const BIN_SLOT_PX = 3

const sessionCache = new Map<string, number[]>()

let extractChain = Promise.resolve()

function enqueueExtract<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => extractChain.then(fn, fn)
  extractChain = run().then(
    () => undefined,
    () => undefined,
  )
  return run()
}

function cacheKey(src: string, inPoint: number, duration: number, bins: number): string {
  return `${src}|${inPoint.toFixed(3)}|${duration.toFixed(3)}|${bins}`
}

export function sourceWaveformBins(duration: number): number {
  return Math.min(MAX_BINS, Math.max(64, Math.ceil(duration * 24)))
}

export function expandPeaksForWidth(peaks: number[], widthPx: number): number[] {
  if (!peaks.length) return []
  const slots = Math.max(8, Math.floor(widthPx / BIN_SLOT_PX))
  if (slots <= peaks.length) return peaks.slice(0, slots)
  return Array.from({ length: slots }, (_, i) => peaks[Math.floor((i / slots) * peaks.length)] ?? 0.12)
}

export function invalidateWaveformSession(src: string) {
  for (const key of [...sessionCache.keys()]) {
    if (key.startsWith(`${src}|`)) sessionCache.delete(key)
  }
}

export function useClipWaveform(clip: () => Clip, clipWidthPx: () => number) {
  const project = useProjectStore()
  const sourcePeaks = ref<number[]>([])
  const loading = ref(false)

  const asset = computed(() => {
    const id = clip().assetId
    return id ? project.assets.find((a) => a.id === id) : undefined
  })

  const showWaveform = computed(() => clip().kind === 'audio' && !!asset.value?.src)

  const extractBins = computed(() => {
    if (!showWaveform.value) return 0
    return sourceWaveformBins(clip().duration)
  })

  const displayBars = computed(() => expandPeaksForWidth(sourcePeaks.value, clipWidthPx()))

  let loadGen = 0

  async function load() {
    const c = clip()
    const a = asset.value
    const bins = extractBins.value
    if (!showWaveform.value || !a?.src || bins < 1) {
      sourcePeaks.value = []
      loading.value = false
      return
    }

    const key = cacheKey(a.src, c.inPoint, c.duration, bins)
    const cached = sessionCache.get(key)
    if (cached?.length) {
      sourcePeaks.value = cached
      loading.value = false
      return
    }

    const gen = ++loadGen
    loading.value = true
    try {
      const peaks = await enqueueExtract(async () => {
        if (isTauri()) {
          return extractClipWaveform({
            path: a.src!,
            inPoint: c.inPoint,
            duration: c.duration,
            bins,
          })
        }
        return []
      })
      if (gen !== loadGen) return
      sourcePeaks.value = peaks.length ? peaks : Array.from({ length: bins }, () => 0.15)
      if (peaks.length) sessionCache.set(key, peaks)
    } catch {
      if (gen !== loadGen) return
      sourcePeaks.value = Array.from({ length: bins }, () => 0.15)
    } finally {
      if (gen === loadGen) loading.value = false
    }
  }

  watch(
    () => ({
      id: clip().id,
      inPoint: clip().inPoint,
      duration: clip().duration,
      src: asset.value?.src,
    }),
    () => void load(),
    { immediate: true },
  )

  onBeforeUnmount(() => {
    loadGen++
  })

  return { displayBars, loading, showWaveform }
}
