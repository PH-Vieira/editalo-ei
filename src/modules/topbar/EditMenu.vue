<script setup lang="ts">
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import ToolbarMenu from './ToolbarMenu.vue'
import { useTimelineStore } from '@/stores/timeline'

const timeline = useTimelineStore()
const { selectedClipId, canUndo, canRedo, currentTime } = storeToRefs(timeline)
</script>

<template>
  <ToolbarMenu label="Editar" menu-id="edit">
    <button
      type="button"
      class="menu-item"
      role="menuitem"
      :disabled="!canUndo"
      @click="timeline.undo()"
    >
      <BaseIcon name="undo" :size="15" />
      <span class="item-label">Desfazer</span>
      <kbd>Ctrl+Z</kbd>
    </button>
    <button
      type="button"
      class="menu-item"
      role="menuitem"
      :disabled="!canRedo"
      @click="timeline.redo()"
    >
      <BaseIcon name="redo" :size="15" />
      <span class="item-label">Refazer</span>
      <kbd>Ctrl+Y</kbd>
    </button>

    <div class="menu-divider" role="separator" />

    <button
      type="button"
      class="menu-item"
      role="menuitem"
      :disabled="!selectedClipId"
      @click="timeline.splitClipAt(currentTime)"
    >
      <BaseIcon name="blade" :size="15" />
      <span class="item-label">Dividir no playhead</span>
      <kbd>S</kbd>
    </button>
    <button
      type="button"
      class="menu-item"
      role="menuitem"
      :disabled="!selectedClipId"
      @click="selectedClipId && timeline.removeClip(selectedClipId)"
    >
      <BaseIcon name="trash" :size="15" />
      <span class="item-label">Remover clipe</span>
      <kbd>Del</kbd>
    </button>
  </ToolbarMenu>
</template>
