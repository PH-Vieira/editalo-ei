/** Utilitários de tempo / timecode. */

/** Formata segundos como timecode HH:MM:SS:FF (frames). */
export function toTimecode(seconds: number, fps = 30): string {
  const s = Math.max(0, seconds)
  const totalFrames = Math.round(s * fps)
  const f = totalFrames % fps
  const totalSeconds = Math.floor(totalFrames / fps)
  const ss = totalSeconds % 60
  const mm = Math.floor(totalSeconds / 60) % 60
  const hh = Math.floor(totalSeconds / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(f)}`
}

/** Formata segundos como relógio compacto MM:SS ou H:MM:SS. */
export function toClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const ss = s % 60
  const mm = Math.floor(s / 60) % 60
  const hh = Math.floor(s / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`
}

/** Intervalo "bonito" para os ticks da régua, dado o zoom (px por segundo). */
export function rulerStep(pxPerSecond: number): number {
  const targetPx = 92 // espaçamento alvo entre rótulos
  const raw = targetPx / pxPerSecond
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  return steps.find((st) => st >= raw) ?? 600
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function snap(value: number, increment: number): number {
  return Math.round(value / increment) * increment
}
