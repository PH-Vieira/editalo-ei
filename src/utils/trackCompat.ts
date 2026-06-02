import type { AssetKind, Clip, Track, TrackType } from '@/types'

/** Tipo de trilha padrão para uma mídia. */
export function trackTypeForKind(kind: AssetKind): TrackType {
  return kind === 'audio' ? 'audio' : 'video'
}

/** Vídeo/imagem/texto → trilha de vídeo; áudio → trilha de áudio. */
export function canPlaceOnTrack(kind: AssetKind, track: Pick<Track, 'type' | 'locked'>): boolean {
  if (track.locked) return false
  if (track.type === 'audio') return kind === 'audio'
  return kind === 'video' || kind === 'image' || kind === 'text'
}

export function canPlaceClipOnTrack(clip: Pick<Clip, 'kind'>, track: Pick<Track, 'type' | 'locked'>): boolean {
  return canPlaceOnTrack(clip.kind, track)
}

export function incompatibleTrackMessage(kind: AssetKind, trackName: string): string {
  if (kind === 'audio') return `Áudio não pode ir na trilha "${trackName}" (só trilhas de vídeo).`
  return `Vídeo/imagem não pode ir na trilha de áudio "${trackName}".`
}
