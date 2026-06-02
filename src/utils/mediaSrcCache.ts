import { toMediaSrc } from '@/tauri/commands'

const cache = new Map<string, string>()

/** Resolve caminho de asset para URL utilizável no DOM, com cache por sessão. */
export async function resolveMediaSrc(path: string): Promise<string | undefined> {
  const hit = cache.get(path)
  if (hit) return hit
  const src = await toMediaSrc(path)
  if (src) cache.set(path, src)
  return src
}

export function invalidateMediaSrc(path: string) {
  cache.delete(path)
}
