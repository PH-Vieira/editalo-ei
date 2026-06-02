import { invalidateFilmstripCache, invalidateWaveformCache } from '@/tauri/commands'
import { invalidateFilmstripSession } from '@/composables/useClipFilmstrip'
import { invalidateWaveformSession } from '@/composables/useClipWaveform'

/** Invalida caches de filmstrip e waveform para um arquivo de mídia. */
export function invalidateClipMediaCaches(src: string) {
  invalidateFilmstripCache(src)
  invalidateWaveformCache(src)
  invalidateFilmstripSession(src)
  invalidateWaveformSession(src)
}
