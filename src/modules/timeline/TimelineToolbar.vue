<script setup lang="ts">
import { storeToRefs } from 'pinia'
import IconButton from '@/components/ui/IconButton.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useTimelineStore, MIN_PPS, MAX_PPS } from '@/stores/timeline'
import { useUiStore, type TimelineTool } from '@/stores/ui'
import { toTimecode } from '@/utils/time'
import { useProjectStore } from '@/stores/project'

const timeline = useTimelineStore()
const ui = useUiStore()
const project = useProjectStore()
const { activeTool } = storeToRefs(ui)
const { pixelsPerSecond, currentTime, selectedClipId, canUndo, canRedo } = storeToRefs(timeline)

const tools: { key: TimelineTool; icon: string; label: string; key2: string }[] = [
  { key: 'select', icon: 'cursor', label: 'Selecionar', key2: 'V' },
  { key: 'blade', icon: 'blade', label: 'Lâmina / dividir', key2: 'B' },
  { key: 'hand', icon: 'hand', label: 'Mover visão', key2: 'H' },
]
</script>

<template>
  <div class="tl-toolbar">
    <div class="group tools">
      <IconButton
        v-for="t in tools"
        :key="t.key"
        :icon="t.icon"
        :label="`${t.label} (${t.key2})`"
        :active="activeTool === t.key"
        @click="ui.setTool(t.key)"
      />
    </div>

    <div class="sep" />

    <div class="group">
      <IconButton
        icon="undo"
        label="Desfazer (Ctrl+Z)"
        :disabled="!canUndo"
        @click="timeline.undo()"
      />
      <IconButton
        icon="redo"
        label="Refazer (Ctrl+Y)"
        :disabled="!canRedo"
        @click="timeline.redo()"
      />
    </div>

    <div class="sep" />

    <div class="group">
      <IconButton
        icon="blade"
        label="Dividir no playhead (S)"
        :disabled="!selectedClipId"
        @click="timeline.splitClipAt(currentTime)"
      />
      <IconButton
        icon="trash"
        label="Remover clipe (Delete)"
        :disabled="!selectedClipId"
        @click="selectedClipId && timeline.removeClip(selectedClipId)"
      />
    </div>

    <div class="spacer" />

    <div class="playhead-tc">
      <BaseIcon name="clock" :size="13" />
      <span class="mono">{{ toTimecode(currentTime, project.project.fps) }}</span>
    </div>

    <div class="sep" />

    <div class="group zoom">
      <IconButton icon="zoom-out" label="Reduzir zoom (-)" @click="timeline.zoomBy(0.8)" />
      <input
        class="zoom-range"
        type="range"
        :min="MIN_PPS"
        :max="MAX_PPS"
        :value="pixelsPerSecond"
        aria-label="Zoom da timeline"
        @input="timeline.setZoom(Number(($event.target as HTMLInputElement).value))"
      />
      <IconButton icon="zoom-in" label="Aumentar zoom (+)" @click="timeline.zoomBy(1.25)" />
    </div>
  </div>
</template>

<style scoped>
.tl-toolbar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  height: 42px;
  padding: 0 var(--sp-3);
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
}
.group {
  display: flex;
  align-items: center;
  gap: 2px;
}
.tools {
  padding: 2px;
  border-radius: var(--r-sm);
  background: var(--bg-inset);
}
.sep {
  width: 1px;
  height: 20px;
  background: var(--border);
}
.spacer {
  flex: 1;
}
.playhead-tc {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 4px var(--sp-3);
  border-radius: var(--r-sm);
  background: var(--bg-inset);
  color: var(--accent);
  font-size: var(--fs-sm);
}
.zoom {
  gap: var(--sp-2);
}
.zoom-range {
  width: 120px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-inset);
  border-radius: var(--r-full);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
}
.zoom-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: var(--r-full);
  background: var(--text-mid);
  cursor: pointer;
  transition: background var(--dur-fast);
}
.zoom-range::-webkit-slider-thumb:hover {
  background: var(--accent);
}
</style>
