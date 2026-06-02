import { onMounted, onUnmounted, ref, watch } from 'vue'
import { isTauri } from '@/tauri/commands'

function syncWindowFrameClass(maximized: boolean) {
  const root = document.documentElement
  if (!isTauri()) {
    root.classList.remove('window-desktop', 'window-maximized')
    return
  }
  root.classList.add('window-desktop')
  root.classList.toggle('window-maximized', maximized)
}

export function useWindowControls() {
  const maximized = ref(false)
  let unlisten: (() => void) | undefined

  async function syncMaximized() {
    if (!isTauri()) return
    const { appWindow } = await import('@tauri-apps/api/window')
    maximized.value = await appWindow.isMaximized()
    syncWindowFrameClass(maximized.value)
  }

  async function minimize() {
    if (!isTauri()) return
    const { appWindow } = await import('@tauri-apps/api/window')
    await appWindow.minimize()
  }

  async function toggleMaximize() {
    if (!isTauri()) return
    const { appWindow } = await import('@tauri-apps/api/window')
    await appWindow.toggleMaximize()
    await syncMaximized()
  }

  async function close() {
    if (!isTauri()) return
    const { appWindow } = await import('@tauri-apps/api/window')
    await appWindow.close()
  }

  watch(maximized, (value) => syncWindowFrameClass(value))

  onMounted(async () => {
    if (!isTauri()) return
    await syncMaximized()
    const { appWindow } = await import('@tauri-apps/api/window')
    unlisten = await appWindow.onResized(() => {
      void syncMaximized()
    })
  })

  onUnmounted(() => {
    unlisten?.()
    document.documentElement.classList.remove('window-desktop', 'window-maximized')
  })

  return { maximized, minimize, toggleMaximize, close, isDesktop: isTauri() }
}
