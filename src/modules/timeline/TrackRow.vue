<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import ClipBlock from './ClipBlock.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useProjectStore } from '@/stores/project'
import type { Track } from '@/types'

const props = defineProps<{ track: Track }>()
const timeline = useTimelineStore()
const project = useProjectStore()
const { pixelsPerSecond } = storeToRefs(timeline)
const dragOver = ref(false)

function onDrop(e: DragEvent) {
  e.stopPropagation()
  dragOver.value = false
  const assetId = e.dataTransfer?.getData('application/x-asset-id')
  if (!assetId) return
  const asset = project.assets.find((a) => a.id === assetId)
  if (!asset) return
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
    :class="{ 'drag-over': dragOver, locked: track.locked, hidden: track.hidden }"
    :data-type="track.type"
    :style="{ height: `${track.height}px` }"
    @click.self="timeline.selectClip(null)"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <ClipBlock
      v-for="clip in timeline.clipsByTrack(track.id)"
      :key="clip.id"
      :clip="clip"
      :locked="track.locked"
    />
  </div>
</template>

<style scoped>
.lane {
  position: relative;
  /* A lane deve preencher toda a coluna do grid para ser um alvo de drop válido.
     O conteúdo absoluto (clips) extravasa visualmente se necessário. */
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
