import type { Project } from '@/types'

export const defaultProject: Project = {
  id: 'proj_untitled',
  name: 'Projeto sem título',
  fps: 30,
  width: 1920,
  height: 1080,
  sampleRate: 48000,
  createdAt: Date.now(),
  modifiedAt: Date.now(),
}
