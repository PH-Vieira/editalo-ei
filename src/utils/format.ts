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

/** Nome do arquivo a partir de um caminho Windows/Unix. */
export function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

/** Pasta pai de um caminho (para exibição resumida). */
export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i > 0 ? path.slice(0, i) : path
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
