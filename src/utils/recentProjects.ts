import { basename } from '@/utils/format'

const STORAGE_KEY = 'naregua:recent-projects'
const MAX_RECENT = 8

export interface RecentProject {
  path: string
  name: string
  openedAt: number
}

export function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentProject[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

export function addRecentProject(path: string, name?: string) {
  const label = name?.trim() || basename(path)
  const entry: RecentProject = { path, name: label, openedAt: Date.now() }
  const next = [entry, ...getRecentProjects().filter((r) => r.path !== path)].slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function removeRecentProject(path: string) {
  const next = getRecentProjects().filter((r) => r.path !== path)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
