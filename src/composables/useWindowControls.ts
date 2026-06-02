import { onMounted, onUnmounted, ref } from 'vue'
import { isTauri } from '@/tauri/commands'

export function useWindowControls() {
  const maximized = ref(false)
  let unlisten: (() => void) | undefined

  async function syncMaximized() {
    if (!isTauri()) return
    const { appWindow } = await import('@tauri-apps/api/window')
    maximized.value = await appWindow.isMaximized()
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
  })

  return { maximized, minimize, toggleMaximize, close, isDesktop: isTauri() }
}
