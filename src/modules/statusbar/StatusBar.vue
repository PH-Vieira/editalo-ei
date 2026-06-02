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
const { renderStatus, renderProgress, isImporting, importMessage } = storeToRefs(ui)
const { saveStatusLabel, isDirty, isSaving, filePath } = storeToRefs(project)

const zoomPct = computed(() => Math.round((pixelsPerSecond.value / 64) * 100))
const renderLabel = computed(
  () =>
    ({ idle: 'Ocioso', ready: 'Pronto', exporting: 'Exportando', error: 'Erro' })[renderStatus.value],
)
</script>

<template>
  <footer class="statusbar">
    <div class="left">
      <span
        class="stat save-stat"
        :class="{ dirty: isDirty, saving: isSaving, saved: filePath && !isDirty }"
        :title="filePath ?? 'Salvar grava timeline, clipes e biblioteca em um arquivo .regua'"
      >
        <BaseIcon name="save" :size="12" />
        <span class="mono save-label">{{ saveStatusLabel }}</span>
      </span>
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
      <span v-if="isImporting" class="stat importing-stat" :title="importMessage ?? 'Importando mídia'">
        <span class="importing-dot" aria-hidden="true" />
        <span class="mono import-label">{{ importMessage ?? 'Importando…' }}</span>
      </span>
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
.save-stat {
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: var(--bg-2);
  max-width: min(42vw, 320px);
}
.save-stat.dirty {
  color: var(--warning);
}
.save-stat.saving {
  color: var(--accent);
}
.save-stat.saved {
  color: var(--success);
}
.save-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.importing-stat {
  max-width: min(36vw, 280px);
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: var(--accent-soft);
  color: var(--text-hi);
}
.import-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.importing-dot {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  border-radius: var(--r-full);
  background: var(--accent);
  animation: pulse 1s var(--ease-in-out) infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}
</style>
