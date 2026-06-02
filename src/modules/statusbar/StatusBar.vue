<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { formatResolution } from '@/utils/format'

const timeline = useTimelineStore()
const project = useProjectStore()
const ui = useUiStore()
const { pixelsPerSecond } = storeToRefs(timeline)
const { renderStatus, renderProgress } = storeToRefs(ui)

const zoomPct = computed(() => Math.round((pixelsPerSecond.value / 64) * 100))
const renderLabel = computed(
  () =>
    ({ idle: 'Ocioso', ready: 'Pronto', exporting: 'Exportando', error: 'Erro' })[renderStatus.value],
)
</script>

<template>
  <footer class="statusbar">
    <div class="left">
      <span class="stat">
        <BaseIcon name="resolution" :size="12" />
        <span class="mono">{{ formatResolution(project.project.width, project.project.height) }}</span>
      </span>
      <span class="stat">
        <BaseIcon name="fps" :size="12" />
        <span class="mono">{{ project.project.fps }} fps</span>
      </span>
      <span class="stat">
        <BaseIcon name="layers" :size="12" />
        <span class="mono">{{ timeline.clips.length }} clipes · {{ timeline.tracks.length }} trilhas</span>
      </span>
    </div>

    <div class="right">
      <span class="render" :class="`s-${renderStatus}`">
        <span class="render-dot" />
        {{ renderLabel }}
        <span v-if="renderStatus === 'exporting'" class="mono">{{ renderProgress }}%</span>
      </span>
      <span class="stat zoom">
        <BaseIcon name="zoom-in" :size="12" />
        <span class="mono">{{ zoomPct }}%</span>
      </span>
    </div>
  </footer>
</template>

<style scoped>
.statusbar {
  flex: 0 0 var(--statusbar-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--sp-3);
  background: var(--bg-0);
  border-top: 1px solid var(--border);
  font-size: var(--fs-xs);
  color: var(--text-lo);
}
.left,
.right {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.render {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: var(--bg-2);
}
.render-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--r-full);
  background: var(--text-lo);
}
.s-ready .render-dot {
  background: var(--success);
}
.s-exporting .render-dot {
  background: var(--accent);
  animation: pulse 1s var(--ease-in-out) infinite;
}
.s-error .render-dot {
  background: var(--danger);
}
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}
</style>
