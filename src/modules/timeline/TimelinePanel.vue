<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import TimelineToolbar from './TimelineToolbar.vue'
import TimeRuler from './TimeRuler.vue'
import TrackHeader from './TrackHeader.vue'
import TrackRow from './TrackRow.vue'
import Playhead from './Playhead.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'

const timeline = useTimelineStore()
const project = useProjectStore()
const ui = useUiStore()
const { orderedTracks, pixelsPerSecond, currentTime, isPlaying, hasClips } = storeToRefs(timeline)
const { activeTool } = storeToRefs(ui)

const scrollEl = ref<HTMLElement | null>(null)
const HEADER_W = 168

/* ---- Drop de mídia fora de uma trilha específica (fallback) ---- */
const globalDragOver = ref(false)

const ASSET_DRAG_TYPES = ['application/x-asset-id', 'text/plain'] as const

function isAssetDrag(e: DragEvent): boolean {
  const types = e.dataTransfer?.types
  if (!types) return false
  return ASSET_DRAG_TYPES.some((t) => types.includes(t))
}

function onGlobalDragOver(e: DragEvent) {
  if (!isAssetDrag(e)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  globalDragOver.value = true
}

function onGlobalDrop(e: DragEvent) {
  globalDragOver.value = false
  // stopPropagation no TrackRow previne que cheguemos aqui se a lane recebeu
  const assetId =
    e.dataTransfer?.getData('application/x-asset-id') || e.dataTransfer?.getData('text/plain')
  if (!assetId || !project.assets.some((a) => a.id === assetId)) return
  const asset = project.assets.find((a) => a.id === assetId)
  if (!asset) return
  // Calcula o tempo a partir da posição X, respeitando scroll
  const el = scrollEl.value
  const rect = el?.getBoundingClientRect()
  const scrollLeft = el?.scrollLeft ?? 0
  const rawStart = rect ? Math.max(0, (e.clientX - rect.left - HEADER_W + scrollLeft) / pixelsPerSecond.value) : 0
  const duration = asset.duration > 0 ? asset.duration : 5
  // Determina a trilha alvo pelo tipo do asset (para calcular o snap correto)
  const start = timeline.snapStart(
    rawStart,
    '__new__',
    '',
    duration,
    pixelsPerSecond.value,
  )
  timeline.addClipFromAsset(asset, undefined, start)
}

/* ---- Seek na régua ---- */
function seekFromRuler(e: PointerEvent) {
  if (!hasClips.value) return
  timeline.beginUserSeek()
  const ruler = e.currentTarget as HTMLElement
  const scroll = scrollEl.value

  const move = (ev: PointerEvent) => {
    const rect = scroll ? scroll.getBoundingClientRect() : ruler.getBoundingClientRect()
    const scrollLeft = scroll?.scrollLeft ?? 0
    const x = ev.clientX - rect.left - HEADER_W + scrollLeft
    timeline.setCurrentTime(x / pixelsPerSecond.value)
  }
  move(e)
  const up = () => {
    timeline.endUserSeek()
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/* ---- Roda: Ctrl = zoom | Shift / horizontal = pan no tempo ---- */
function onWheel(e: WheelEvent) {
  const el = scrollEl.value
  if (!el) return

  if (e.ctrlKey) {
    e.preventDefault()
    let timeCursor = 0
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left - HEADER_W + el.scrollLeft
    timeCursor = x / pixelsPerSecond.value

    const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14
    timeline.zoomBy(factor)

    const newX = timeCursor * pixelsPerSecond.value
    el.scrollLeft = newX - (e.clientX - rect.left - HEADER_W)
    return
  }

  const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
  if (horizontal) {
    e.preventDefault()
    el.scrollLeft += e.deltaX !== 0 ? e.deltaX : e.deltaY
  }
}

/* ---- Ferramenta mão: arrastar para mover a visão ---- */
function onHandPanStart(e: PointerEvent) {
  if (activeTool.value !== 'hand' || e.button !== 0) return
  const el = scrollEl.value
  if (!el) return
  e.preventDefault()
  const startX = e.clientX
  const startY = e.clientY
  const sl = el.scrollLeft
  const st = el.scrollTop

  const move = (ev: PointerEvent) => {
    el.scrollLeft = sl - (ev.clientX - startX)
    el.scrollTop = st - (ev.clientY - startY)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

onMounted(() => {
  scrollEl.value?.addEventListener('wheel', onWheel, { passive: false })
})
onBeforeUnmount(() => {
  scrollEl.value?.removeEventListener('wheel', onWheel)
})

/* ---- Auto-scroll durante play ---- */
watch(currentTime, (t) => {
  if (!isPlaying.value || !scrollEl.value) return
  const el = scrollEl.value
  const x = t * pixelsPerSecond.value
  const viewLeft = el.scrollLeft
  const viewRight = viewLeft + el.clientWidth - HEADER_W
  if (x < viewLeft || x > viewRight) el.scrollLeft = x - 60
})
</script>

<template>
  <div class="timeline">
    <TimelineToolbar />

    <div
      ref="scrollEl"
      class="tl-scroll"
      :class="{
        'global-drag-over': globalDragOver,
        'tool-hand': activeTool === 'hand',
      }"
      @pointerdown="onHandPanStart"
      @dragover="onGlobalDragOver"
      @dragleave="globalDragOver = false"
      @drop.prevent="onGlobalDrop"
    >
      <div class="tl-grid" :style="{ '--content-w': `${Math.max(800, timeline.duration * pixelsPerSecond)}px` }">
        <!-- Linha 0: canto sticky + régua -->
        <div class="corner">
          <span class="corner-label">Trilhas</span>
        </div>
        <div
          class="ruler-cell"
          :class="{ 'ruler-cell--empty': !hasClips }"
          @pointerdown="seekFromRuler"
        >
          <TimeRuler />
        </div>

        <!-- Linhas de trilhas -->
        <template v-for="track in orderedTracks" :key="track.id">
          <div class="header-cell"><TrackHeader :track="track" /></div>
          <div class="lane-cell"><TrackRow :track="track" /></div>
        </template>

        <div class="header-cell add-row">
          <div class="add-tracks">
            <button
              type="button"
              class="add-btn video"
              title="Adicionar trilha de vídeo"
              @click="timeline.addTrack('video')"
            >
              <BaseIcon name="plus" :size="12" />
              <span>Vídeo</span>
            </button>
            <button
              type="button"
              class="add-btn audio"
              title="Adicionar trilha de áudio"
              @click="timeline.addTrack('audio')"
            >
              <BaseIcon name="plus" :size="12" />
              <span>Áudio</span>
            </button>
          </div>
        </div>
        <div class="lane-cell add-row-spacer" />

        <Playhead />
      </div>

      <EmptyState
        v-if="!timeline.clips.length"
        class="tl-empty"
        icon="film"
        title="Timeline vazia"
        hint="Arraste mídia da biblioteca para criar uma trilha, ou use + Vídeo / + Áudio abaixo."
      />
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-1);
}
.tl-scroll {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.tl-scroll.global-drag-over {
  box-shadow: inset 0 0 0 2px var(--accent-ring);
}
.tl-scroll.tool-hand {
  cursor: grab;
}
.tl-scroll.tool-hand:active {
  cursor: grabbing;
}
.tl-grid {
  position: relative;
  display: grid;
  grid-template-columns: var(--track-header-w) var(--content-w);
  min-width: max-content;
}

.corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 25;
  display: flex;
  align-items: flex-end;
  height: 30px;
  padding: 0 var(--sp-3) 5px;
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.corner-label {
  font-size: var(--fs-2xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-lo);
}
.ruler-cell {
  position: sticky;
  top: 0;
  z-index: 15;
  height: 30px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  cursor: col-resize;
}
.ruler-cell--empty {
  cursor: default;
}
.header-cell {
  position: sticky;
  left: 0;
  z-index: 20;
  border-right: 1px solid var(--border);
  background: var(--bg-2);
}
.lane-cell {
  background: var(--bg-inset);
}
.add-row {
  position: sticky;
  left: 0;
  z-index: 20;
  padding: var(--sp-2);
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  border-top: 1px solid var(--border);
}
.add-tracks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 5px 6px;
  border-radius: var(--r-sm);
  font-size: var(--fs-2xs);
  font-weight: 600;
  color: var(--text-mid);
  background: var(--bg-inset);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
  transition:
    color var(--dur-fast),
    background var(--dur-fast),
    box-shadow var(--dur-fast);
}
.add-btn:hover {
  color: var(--text-hi);
  background: var(--bg-3);
}
.add-btn.video:hover {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--media-video) 50%, transparent);
  color: var(--media-video);
}
.add-btn.audio:hover {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--media-audio) 50%, transparent);
  color: var(--media-audio);
}
.add-row-spacer {
  height: 44px;
  border-top: 1px solid var(--border);
  background: var(--bg-inset);
}
.tl-empty {
  position: absolute;
  inset: 30px 0 0 var(--track-header-w);
  background: var(--bg-inset);
  /* Não interceptar drag/drop — as trilhas por baixo precisam receber o soltar. */
  pointer-events: none;
}
</style>
