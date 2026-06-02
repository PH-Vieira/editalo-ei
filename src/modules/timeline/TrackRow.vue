<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import ClipBlock from './ClipBlock.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { canPlaceOnTrack } from '@/utils/trackCompat'
import type { Track } from '@/types'

const props = defineProps<{ track: Track }>()
const timeline = useTimelineStore()
const project = useProjectStore()
const ui = useUiStore()
const { pixelsPerSecond } = storeToRefs(timeline)
const dragOver = ref(false)
const dragInvalid = ref(false)

function assetFromDrag(e: DragEvent) {
  const assetId =
    e.dataTransfer?.getData('application/x-asset-id') || e.dataTransfer?.getData('text/plain')
  if (!assetId) return null
  return project.assets.find((a) => a.id === assetId) ?? null
}

function onDragOver(e: DragEvent) {
  const asset = assetFromDrag(e)
  if (!asset) return
  e.preventDefault()
  if (!canPlaceOnTrack(asset.kind, props.track)) {
    dragOver.value = false
    dragInvalid.value = true
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    return
  }
  dragInvalid.value = false
  dragOver.value = true
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDragLeave() {
  dragOver.value = false
  dragInvalid.value = false
}

function onDrop(e: DragEvent) {
  e.stopPropagation()
  dragOver.value = false
  dragInvalid.value = false
  const asset = assetFromDrag(e)
  if (!asset) return
  if (!canPlaceOnTrack(asset.kind, props.track)) {
    ui.notify(`Use uma trilha de ${asset.kind === 'audio' ? 'áudio' : 'vídeo'} para este arquivo.`, 'warning')
    return
  }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const rawStart = Math.max(0, (e.clientX - rect.left) / pixelsPerSecond.value)
  const duration = asset.duration > 0 ? asset.duration : 5
  const start = timeline.snapStart(rawStart, '__new__', props.track.id, duration, pixelsPerSecond.value)
  timeline.addClipFromAsset(asset, props.track.id, start)
}
</script>

<template>
  <div
    class="lane"
    :class="{
      'drag-over': dragOver,
      'drag-invalid': dragInvalid,
      locked: track.locked,
      hidden: track.hidden,
    }"
    :data-type="track.type"
    :data-track-id="track.id"
    :style="{ height: `${track.height}px` }"
    @click.self="timeline.selectClip(null)"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <ClipBlock
      v-for="clip in timeline.clipsByTrack(track.id)"
      :key="clip.id"
      :clip="clip"
      :track="track"
      :locked="track.locked"
    />
  </div>
</template>

<style scoped>
.lane {
  position: relative;
  width: 100%;
  min-width: 100%;
  border-bottom: 1px solid var(--border);
  background-image: linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
  background-size: 80px 100%;
  background-position: 0 0;
  transition: background-color var(--dur-fast);
}
.lane[data-type='audio'] {
  background-color: rgba(63, 200, 180, 0.025);
}
.lane.drag-over {
  background-color: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent-ring);
}
.lane.drag-invalid {
  background-color: rgba(220, 80, 80, 0.08);
  box-shadow: inset 0 0 0 1px rgba(220, 80, 80, 0.45);
}
.lane.clip-drag-over {
  background-color: var(--accent-soft);
  box-shadow: inset 0 0 0 2px var(--accent-ring);
}
.lane.clip-drag-invalid {
  background-color: rgba(220, 80, 80, 0.08);
  box-shadow: inset 0 0 0 1px rgba(220, 80, 80, 0.45);
}
.lane.locked {
  background-image:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 6px,
      rgba(255, 255, 255, 0.02) 6px,
      rgba(255, 255, 255, 0.02) 12px
    );
}
.lane.hidden {
  opacity: 0.45;
}
</style>
