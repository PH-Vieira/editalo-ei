<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useUiStore } from '@/stores/ui'
import { toClock } from '@/utils/time'
import type { Clip } from '@/types'

const props = defineProps<{ clip: Clip; locked: boolean }>()

const timeline = useTimelineStore()
const ui = useUiStore()
const { pixelsPerSecond, selectedClipId, currentTime } = storeToRefs(timeline)

const selected = computed(() => selectedClipId.value === props.clip.id)
const left = computed(() => props.clip.start * pixelsPerSecond.value)
const width = computed(() => Math.max(8, props.clip.duration * pixelsPerSecond.value))
const isAudio = computed(() => props.clip.kind === 'audio')

// "Waveform" determinística (mock) a partir do id do clipe.
const bars = computed(() => {
  let seed = 0
  for (const ch of props.clip.id) seed = (seed * 31 + ch.charCodeAt(0)) % 9973
  const count = Math.max(8, Math.floor(width.value / 4))
  return Array.from({ length: count }, (_, i) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return 24 + ((seed >> (i % 7)) % 64)
  })
})

function onPointerDown(e: PointerEvent) {
  if (props.locked) return
  // Ferramenta lâmina: clique divide o clipe na posição.
  if (ui.activeTool === 'blade') {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const t = props.clip.start + (e.clientX - rect.left) / pixelsPerSecond.value
    timeline.splitClipAt(t, props.clip.id)
    return
  }
  timeline.selectClip(props.clip.id)
  beginDrag(e, 'move')
}

function beginDrag(e: PointerEvent, mode: 'move' | 'trim-l' | 'trim-r') {
  e.stopPropagation()
  // Snapshot uma única vez, antes de qualquer mudança.
  timeline.snapshot()
  const startX = e.clientX
  const origStart = props.clip.start
  const origDur = props.clip.duration
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)

  const move = (ev: PointerEvent) => {
    const ds = (ev.clientX - startX) / pixelsPerSecond.value
    const pps = pixelsPerSecond.value

    if (mode === 'move') {
      const s = timeline.snapStart(Math.max(0, origStart + ds), props.clip.id, props.clip.trackId, origDur, pps)
      timeline.moveClip(props.clip.id, s)

    } else if (mode === 'trim-l') {
      const rawNs = Math.min(origStart + origDur - 0.2, Math.max(0, origStart + ds))
      const snapped = timeline.snapTime(rawNs, props.clip.id, pps)
      // Não pode avançar para dentro do clipe anterior na mesma trilha
      const prev = timeline.clipsByTrack(props.clip.trackId)
        .filter((c) => c.id !== props.clip.id && c.start + c.duration <= origStart + 0.01)
        .sort((a, b) => b.start - a.start)[0]
      const minStart = prev ? prev.start + prev.duration : 0
      const ns = Math.max(minStart, Math.min(snapped, origStart + origDur - 0.2))
      timeline.updateClip(props.clip.id, { start: ns, duration: origDur - (ns - origStart) })

    } else {
      const rawEnd = origStart + Math.max(0.2, origDur + ds)
      const snappedEnd = timeline.snapTime(rawEnd, props.clip.id, pps)
      // Não pode avançar para dentro do clipe seguinte na mesma trilha
      const next = timeline.clipsByTrack(props.clip.trackId)
        .filter((c) => c.id !== props.clip.id && c.start >= origStart + origDur - 0.01)
        .sort((a, b) => a.start - b.start)[0]
      const maxEnd = next ? next.start : Infinity
      const newDur = Math.max(0.2, Math.min(snappedEnd, maxEnd) - origStart)
      timeline.updateClip(props.clip.id, { duration: newDur })
    }
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

const playing = computed(
  () => currentTime.value >= props.clip.start && currentTime.value < props.clip.start + props.clip.duration,
)
</script>

<template>
  <div
    class="clip"
    :class="{ selected, locked, playing, blade: ui.activeTool === 'blade', audio: isAudio }"
    :style="{
      left: `${left}px`,
      width: `${width}px`,
      '--clip-color': clip.color,
    }"
    role="button"
    :aria-label="`${clip.name}, ${toClock(clip.duration)}`"
    :aria-pressed="selected"
    tabindex="0"
    @pointerdown="onPointerDown"
    @keydown.enter="timeline.selectClip(clip.id)"
  >
    <span class="trim left" @pointerdown.stop="beginDrag($event, 'trim-l')" />

    <div class="body">
      <div class="head">
        <BaseIcon
          :name="clip.kind === 'audio' ? 'audio' : clip.kind === 'image' ? 'image' : clip.kind === 'text' ? 'text' : 'video'"
          :size="12"
          class="k-icon"
        />
        <span class="name">{{ clip.name }}</span>
        <span class="dur mono">{{ toClock(clip.duration) }}</span>
      </div>

      <div v-if="isAudio" class="wave" aria-hidden="true">
        <span v-for="(b, i) in bars" :key="i" class="bar" :style="{ height: `${b}%` }" />
      </div>
      <div v-else class="thumbstrip" aria-hidden="true">
        <span v-for="n in 4" :key="n" class="cell" />
      </div>
    </div>

    <span class="trim right" @pointerdown.stop="beginDrag($event, 'trim-r')" />
  </div>
</template>

<style scoped>
.clip {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--clip-color) 22%, var(--bg-3));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--clip-color) 40%, transparent);
  overflow: hidden;
  cursor: grab;
  transition:
    box-shadow var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out),
    filter var(--dur-fast) var(--ease-out);
}
.clip::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--clip-color);
}
.clip:hover {
  filter: brightness(1.08);
}
.clip:active {
  cursor: grabbing;
}
.clip.selected {
  box-shadow:
    inset 0 0 0 1.5px var(--accent),
    0 0 0 1px var(--accent-soft-strong),
    var(--shadow-md);
  transform: translateY(-1px);
  z-index: 5;
}
.clip.playing::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.05);
  pointer-events: none;
}
.clip.locked {
  cursor: not-allowed;
  opacity: 0.7;
}
.clip.blade {
  cursor: crosshair;
}
.body {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 4px 6px 0 9px;
  pointer-events: none;
}
.head {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.k-icon {
  color: var(--clip-color);
  flex: none;
}
.name {
  flex: 1;
  font-size: var(--fs-2xs);
  font-weight: 600;
  color: var(--text-hi);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dur {
  font-size: 9px;
  color: var(--text-mid);
  flex: none;
}
.wave {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 4px 0 6px;
  overflow: hidden;
}
.bar {
  flex: 1;
  min-width: 1px;
  background: color-mix(in srgb, var(--clip-color) 70%, transparent);
  border-radius: 1px;
}
.thumbstrip {
  flex: 1;
  display: flex;
  gap: 1px;
  margin: 4px 0 6px;
}
.cell {
  flex: 1;
  border-radius: 2px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--clip-color) 26%, var(--bg-inset)),
    var(--bg-inset)
  );
}
.trim {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  z-index: 6;
  cursor: ew-resize;
}
.trim.left {
  left: 0;
}
.trim.right {
  right: 0;
}
.clip.selected .trim::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 40%;
  border-radius: var(--r-full);
  background: var(--accent);
}
.trim.left::after {
  left: 2px;
}
.trim.right::after {
  right: 2px;
}
</style>
