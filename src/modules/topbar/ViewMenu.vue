<script setup lang="ts">
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import ToolbarMenu from './ToolbarMenu.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { sidebarVisible, inspectorVisible } = storeToRefs(ui)
</script>

<template>
  <ToolbarMenu label="Exibir" menu-id="view">
    <button
      type="button"
      class="menu-item"
      :class="{ active: sidebarVisible }"
      role="menuitem"
      @click="ui.toggleSidebar()"
    >
      <BaseIcon name="layers" :size="15" />
      <span class="item-label">Biblioteca de mídia</span>
    </button>
    <button
      type="button"
      class="menu-item"
      :class="{ active: inspectorVisible }"
      role="menuitem"
      @click="ui.toggleInspector()"
    >
      <BaseIcon name="sliders" :size="15" />
      <span class="item-label">Inspetor</span>
    </button>
  </ToolbarMenu>
</template>
