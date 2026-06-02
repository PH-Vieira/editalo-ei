/** Formatação de tamanhos e rótulos diversos. */

export function formatBytes(bytes?: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export function formatResolution(w?: number, h?: number): string {
  if (!w || !h) return '—'
  return `${w}×${h}`
}

export function kindLabel(kind: string): string {
  return (
    {
      video: 'Vídeo',
      audio: 'Áudio',
      image: 'Imagem',
      text: 'Texto',
    } as Record<string, string>
  )[kind] ?? kind
}
