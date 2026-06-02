<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import TimelineToolbar from './TimelineToolbar.vue'
import TimeRuler from './TimeRuler.vue'
import TrackHeader from './TrackHeader.vue'
import TrackRow from './TrackRow.vue'
import Playhead from './Playhead.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useProjectStore } from '@/stores/project'

const timeline = useTimelineStore()
const project = useProjectStore()
const { orderedTracks, pixelsPerSecond, currentTime, isPlaying } = storeToRefs(timeline)

const scrollEl = ref<HTMLElement | null>(null)
const HEADER_W = 168

/* ---- Drop de mídia fora de uma trilha específica (fallback) ---- */
const globalDragOver = ref(false)

function onGlobalDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('application/x-asset-id')) {
    e.preventDefault()
    globalDragOver.value = true
  }
}

function onGlobalDrop(e: DragEvent) {
  globalDragOver.value = false
  // stopPropagation no TrackRow previne que cheguemos aqui se a lane recebeu
  const assetId = e.dataTransfer?.getData('application/x-asset-id')
  if (!assetId) return
  const asset = project.assets.find((a) => a.id === assetId)
  if (!asset) return
  // Calcula o tempo a partir da posição X, respeitando scroll
  const el = scrollEl.value
  const rect = el?.getBoundingClientRect()
  const scrollLeft = el?.scrollLeft ?? 0
  const rawStart = rect ? Math.max(0, (e.clientX - rect.left - HEADER_W + scrollLeft) / pixelsPerSecond.value) : 0
  const duration = asset.duration > 0 ? asset.duration : 5
  // Determina a trilha alvo pelo tipo do asset (para calcular o snap correto)
  const type = asset.kind === 'audio' ? 'audio' : 'video'
  const targetTrack = timeline.tracks.find((t) => t.type === type && !t.locked)
  const snapTrackId = targetTrack?.id ?? ''
  const start = timeline.snapStart(rawStart, '__new__', snapTrackId, duration, pixelsPerSecond.value)
  // addClipFromAsset sem trackId explícito encontra/cria a trilha certa
  timeline.addClipFromAsset(asset, undefined, start)
}

/* ---- Seek na régua ---- */
function seekFromRuler(e: PointerEvent) {
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
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/* ---- Ctrl + roda do mouse → zoom ---- */
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey) return
  e.preventDefault()
  const el = scrollEl.value

  // Guarda o tempo sob o cursor ANTES de alterar o zoom.
  let timeCursor = 0
  if (el) {
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left - HEADER_W + el.scrollLeft
    timeCursor = x / pixelsPerSecond.value
  }

  const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14
  timeline.zoomBy(factor)

  // Reposiciona o scroll para manter o tempo sob o cursor no mesmo pixel.
  if (el) {
    const newX = timeCursor * pixelsPerSecond.value
    const rect = el.getBoundingClientRect()
    el.scrollLeft = newX - (e.clientX - rect.left - HEADER_W)
  }
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
      :class="{ 'global-drag-over': globalDragOver }"
      @dragover="onGlobalDragOver"
      @dragleave="globalDragOver = false"
      @drop.prevent="onGlobalDrop"
    >
      <div class="tl-grid" :style="{ '--content-w': `${Math.max(800, timeline.duration * pixelsPerSecond)}px` }">
        <!-- Linha 0: canto sticky + régua -->
        <div class="corner">
          <span class="corner-label">Trilhas</span>
        </div>
        <div class="ruler-cell" @pointerdown="seekFromRuler">
          <TimeRuler />
        </div>

        <!-- Linhas de trilhas -->
        <template v-for="track in orderedTracks" :key="track.id">
          <div class="header-cell"><TrackHeader :track="track" /></div>
          <div class="lane-cell"><TrackRow :track="track" /></div>
        </template>

        <Playhead />
      </div>

      <EmptyState
        v-if="!timeline.clips.length"
        class="tl-empty"
        icon="film"
        title="Timeline vazia"
        hint="Arraste mídia da biblioteca para uma trilha, ou use o + nos itens."
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
.tl-empty {
  position: absolute;
  inset: 30px 0 0 var(--track-header-w);
  background: var(--bg-inset);
}
</style>
