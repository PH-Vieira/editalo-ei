<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useUiStore } from '@/stores/ui'
import { useClipFilmstrip } from '@/composables/useClipFilmstrip'
import { useClipWaveform } from '@/composables/useClipWaveform'
import { useProjectStore } from '@/stores/project'
import { invalidateClipMediaCaches } from '@/utils/clipMediaCache'
import { toClock } from '@/utils/time'
import type { Clip, Track } from '@/types'
import { canPlaceClipOnTrack } from '@/utils/trackCompat'

const props = defineProps<{ clip: Clip; track: Track; locked: boolean }>()

const timeline = useTimelineStore()
const ui = useUiStore()
const project = useProjectStore()
const { pixelsPerSecond, selectedClipId, currentTime } = storeToRefs(timeline)

const selected = computed(() => selectedClipId.value === props.clip.id)
const left = computed(() => props.clip.start * pixelsPerSecond.value)
const width = computed(() => Math.max(8, props.clip.duration * pixelsPerSecond.value))
const isAudio = computed(() => props.clip.kind === 'audio')

const { displayThumbs, loading, failed, showFilmstrip } = useClipFilmstrip(
  () => props.clip,
  () => width.value,
)

const { displayBars, loading: waveLoading, showWaveform } = useClipWaveform(
  () => props.clip,
  () => width.value,
)

function onPointerDown(e: PointerEvent) {
  if (props.locked) return
  if (ui.activeTool === 'hand') return
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
  const origInPoint = props.clip.inPoint
  let trimmed = false
  let hoverLane: HTMLElement | null = null
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)

  function clearLaneHighlight() {
    if (hoverLane) {
      hoverLane.classList.remove('clip-drag-over', 'clip-drag-invalid')
      hoverLane = null
    }
  }

  function trackIdUnderPointer(x: number, y: number): string | undefined {
    const lane = document.elementFromPoint(x, y)?.closest('.lane[data-track-id]') as HTMLElement | null
    if (!lane?.dataset.trackId) return undefined
    const track = timeline.tracks.find((t) => t.id === lane.dataset.trackId)
    if (!track) return undefined

    if (hoverLane !== lane) {
      clearLaneHighlight()
      hoverLane = lane
      lane.classList.add(
        canPlaceClipOnTrack(props.clip, track) ? 'clip-drag-over' : 'clip-drag-invalid',
      )
    }
    return canPlaceClipOnTrack(props.clip, track) ? track.id : undefined
  }

  const move = (ev: PointerEvent) => {
    const ds = (ev.clientX - startX) / pixelsPerSecond.value
    const pps = pixelsPerSecond.value

    if (mode === 'move') {
      const targetTrackId = trackIdUnderPointer(ev.clientX, ev.clientY)
      timeline.moveClip(props.clip.id, origStart + ds, targetTrackId)

    } else if (mode === 'trim-l') {
      const rawNs = Math.min(origStart + origDur - 0.2, Math.max(0, origStart + ds))
      const snapped = timeline.snapTime(rawNs, props.clip.id, pps)
      // Não pode avançar para dentro do clipe anterior na mesma trilha
      const prev = timeline.clipsByTrack(props.clip.trackId)
        .filter((c) => c.id !== props.clip.id && c.start + c.duration <= origStart + 0.01)
        .sort((a, b) => b.start - a.start)[0]
      const minStart = prev ? prev.start + prev.duration : 0
      const delta = Math.max(minStart, Math.min(snapped, origStart + origDur - 0.2)) - origStart
      const ns = origStart + delta
      const newDur = origDur - delta
      timeline.updateClip(props.clip.id, {
        start: ns,
        duration: newDur,
        inPoint: origInPoint + delta,
        outPoint: origInPoint + newDur,
      })
      trimmed = true

    } else {
      const rawEnd = origStart + Math.max(0.2, origDur + ds)
      const snappedEnd = timeline.snapTime(rawEnd, props.clip.id, pps)
      // Não pode avançar para dentro do clipe seguinte na mesma trilha
      const next = timeline.clipsByTrack(props.clip.trackId)
        .filter((c) => c.id !== props.clip.id && c.start >= origStart + origDur - 0.01)
        .sort((a, b) => a.start - b.start)[0]
      const maxEnd = next ? next.start : Infinity
      const newDur = Math.max(0.2, Math.min(snappedEnd, maxEnd) - origStart)
      timeline.updateClip(props.clip.id, {
        duration: newDur,
        outPoint: origInPoint + newDur,
      })
      trimmed = true
    }
  }
  const up = () => {
    clearLaneHighlight()
    if (trimmed) {
      const asset = project.assets.find((a) => a.id === props.clip.assetId)
      if (asset?.src) invalidateClipMediaCaches(asset.src)
    }
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
    :class="{
      selected,
      locked,
      playing,
      blade: ui.activeTool === 'blade',
      hand: ui.activeTool === 'hand',
      audio: isAudio,
    }"
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

      <div
        v-if="isAudio && showWaveform"
        class="wave"
        :class="{ loading: waveLoading }"
        aria-hidden="true"
      >
        <span
          v-for="(b, i) in displayBars"
          :key="i"
          class="bar"
          :style="{ height: `${Math.round(b * 100)}%` }"
        />
      </div>
      <div v-else-if="isAudio" class="wave" aria-hidden="true">
        <span v-for="n in 12" :key="n" class="bar" style="height: 28%" />
      </div>
      <div
        v-else-if="showFilmstrip"
        class="filmstrip"
        :class="{ loading }"
        aria-hidden="true"
      >
        <img
          v-for="(src, i) in displayThumbs"
          :key="i"
          class="frame"
          :src="src"
          alt=""
          draggable="false"
        />
        <div v-if="loading && !displayThumbs.length" class="filmstrip-skeleton" />
        <div v-else-if="failed && !displayThumbs.length" class="filmstrip-fallback">
          <span v-for="n in Math.min(6, Math.max(2, Math.floor(width / 40)))" :key="n" class="cell" />
        </div>
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
.clip.hand {
  cursor: grab;
}
.body {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}
.filmstrip {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: hidden;
  opacity: 0.92;
}
.filmstrip.loading {
  opacity: 0.55;
}
.filmstrip .frame {
  flex: 0 0 72px;
  width: 72px;
  height: 100%;
  object-fit: cover;
  object-position: center;
  border-right: 1px solid rgba(0, 0, 0, 0.25);
  image-rendering: auto;
}
.filmstrip .frame:last-child {
  border-right: none;
}
.filmstrip-fallback {
  flex: 1;
  display: flex;
  gap: 1px;
  padding: 0 2px;
}
.filmstrip-fallback .cell {
  flex: 1;
  border-radius: 2px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--clip-color) 26%, var(--bg-inset)),
    var(--bg-inset)
  );
}
.filmstrip-skeleton {
  flex: 1;
  background: linear-gradient(
    100deg,
    color-mix(in srgb, var(--clip-color) 18%, var(--bg-inset)) 30%,
    color-mix(in srgb, var(--clip-color) 28%, var(--bg-3)) 50%,
    color-mix(in srgb, var(--clip-color) 18%, var(--bg-inset)) 70%
  );
  background-size: 200% 100%;
  animation: filmstrip-shimmer 1.2s ease-in-out infinite;
}
@keyframes filmstrip-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
.head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-top: 4px;
  padding: 2px 6px 0 9px;
  background: linear-gradient(
    180deg,
    rgba(11, 13, 16, 0.88) 0%,
    rgba(11, 13, 16, 0.55) 70%,
    transparent 100%
  );
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
  margin-top: auto;
  padding: 4px 6px 6px 9px;
  overflow: hidden;
}
.wave.loading {
  opacity: 0.5;
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
