/**
 * Bloqueia atalhos de navegador que não fazem sentido num app desktop (reload, abas, histórico, etc.).
 * No Windows, o WebView2 também é configurado em Rust (`browser_shortcuts.rs`);
 * este módulo garante o mesmo comportamento no `tauri dev` e no preview Vite.
 */

function hasCtrlOrMeta(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey
}

function keyIs(e: KeyboardEvent, letter: string): boolean {
  return e.key.toLowerCase() === letter.toLowerCase()
}

/** Retorna true se o evento corresponde a um atalho de navegador que deve ser bloqueado. */
export function isBrowserNavigationShortcut(e: KeyboardEvent): boolean {
  const ctrl = hasCtrlOrMeta(e)
  const key = e.key

  // Recarregar página
  if (key === 'F5') return true
  if (ctrl && keyIs(e, 'r')) return true

  // Voltar / avançar
  if (e.altKey && (key === 'ArrowLeft' || key === 'ArrowRight')) return true
  if (ctrl && (key === '[' || key === ']')) return true

  // Abas e janelas
  if (ctrl && keyIs(e, 'w')) return true
  if (ctrl && keyIs(e, 't')) return true
  if (ctrl && e.shiftKey && keyIs(e, 't')) return true
  if (ctrl && key === 'Tab') return true

  // Barra de endereço, favoritos, histórico, downloads
  if (ctrl && keyIs(e, 'l')) return true
  if (ctrl && keyIs(e, 'd')) return true
  if (ctrl && keyIs(e, 'h')) return true
  if (ctrl && keyIs(e, 'j')) return true
  if (ctrl && keyIs(e, 'g')) return true
  if (ctrl && keyIs(e, 'k')) return true

  // Imprimir e ver código-fonte
  if (ctrl && keyIs(e, 'p')) return true
  if (ctrl && keyIs(e, 'u')) return true

  // DevTools (só em build de produção; no Vite dev o F12 ainda pode ser útil)
  if (import.meta.env.PROD) {
    if (key === 'F12') return true
    if (ctrl && e.shiftKey && keyIs(e, 'i')) return true
    if (ctrl && e.shiftKey && keyIs(e, 'c')) return true
    if (ctrl && e.shiftKey && keyIs(e, 'j')) return true
  }

  // Busca na página (F3 / Ctrl+F)
  if (key === 'F3') return true
  if (ctrl && keyIs(e, 'f')) return true

  // Zoom do navegador (o app tem zoom próprio na timeline)
  if (ctrl && (key === '+' || key === '=' || key === '-' || key === '0')) return true

  return false
}

function onKeyDown(e: KeyboardEvent) {
  if (!isBrowserNavigationShortcut(e)) return
  e.preventDefault()
  e.stopImmediatePropagation()
}

function onWheel(e: WheelEvent) {
  if (e.ctrlKey) e.preventDefault()
}

let installed = false

/** Registra listeners globais (idempotente). */
export function installBrowserNavigationGuard(): void {
  if (installed) return
  installed = true

  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('wheel', onWheel, { capture: true, passive: false })
}
