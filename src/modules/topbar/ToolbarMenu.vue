<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'

const props = defineProps<{ label: string; menuId: string }>()
const emit = defineEmits<{ open: [] }>()

const openMenuId = inject<Ref<string | null>>('toolbarOpenMenuId')
const setOpenMenuId = inject<(id: string | null) => void>('toolbarSetOpenMenuId')

const root = ref<HTMLElement | null>(null)
const isOpen = computed(() => openMenuId?.value === props.menuId)

function toggle() {
  setOpenMenuId?.(isOpen.value ? null : props.menuId)
}

function close() {
  if (isOpen.value) setOpenMenuId?.(null)
}

function onDocPointerDown(e: PointerEvent) {
  if (!isOpen.value || !root.value) return
  if (!root.value.contains(e.target as Node)) close()
}

onMounted(() => document.addEventListener('pointerdown', onDocPointerDown))
onUnmounted(() => document.removeEventListener('pointerdown', onDocPointerDown))

watch(isOpen, (open) => {
  if (open) emit('open')
})
</script>

<template>
  <div ref="root" class="toolbar-menu">
    <button
      type="button"
      class="menu-trigger"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <span>{{ label }}</span>
      <BaseIcon name="chevron-down" :size="14" class="chev" :class="{ open: isOpen }" />
    </button>

    <Transition name="fade">
      <div v-if="isOpen" class="menu-panel" role="menu" @click="close">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toolbar-menu {
  position: relative;
  flex: none;
}
.menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  height: 30px;
  padding: 0 var(--sp-2);
  border-radius: var(--r-sm);
  color: var(--text-mid);
  font-size: var(--fs-sm);
  font-weight: 500;
  white-space: nowrap;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}
.menu-trigger:hover,
.menu-trigger[aria-expanded='true'] {
  background: var(--bg-4);
  color: var(--text-hi);
}
.chev {
  opacity: 0.65;
  transition: transform var(--dur-fast) var(--ease-out);
}
.chev.open {
  transform: rotate(180deg);
}
.menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 240px;
  max-width: 320px;
  padding: var(--sp-1);
  border-radius: var(--r-md);
  background: var(--bg-3);
  box-shadow: var(--shadow-pop);
  outline: 1px solid var(--border-strong);
}

/* Itens do slot (FileMenu, EditMenu, ViewMenu) */
.menu-panel :deep(.menu-divider) {
  height: 1px;
  margin: var(--sp-1) var(--sp-1);
  background: var(--border-subtle);
  flex: none;
}
.menu-panel :deep(.menu-section-label) {
  padding: var(--sp-2) var(--sp-2) var(--sp-1);
  font-size: var(--fs-2xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-lo);
  flex: none;
}
.menu-panel :deep(.menu-item) {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  min-height: 34px;
  padding: var(--sp-2);
  border-radius: var(--r-sm);
  color: var(--text-hi);
  font-size: var(--fs-sm);
  text-align: left;
  flex: none;
  transition: background var(--dur-fast) var(--ease-out);
}
.menu-panel :deep(.menu-item:hover:not(:disabled)) {
  background: var(--bg-4);
}
.menu-panel :deep(.menu-item:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}
.menu-panel :deep(.menu-item.active) {
  background: var(--accent-soft);
  color: var(--accent);
}
.menu-panel :deep(.item-label) {
  flex: 1;
  min-width: 0;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu-panel :deep(.item-col) {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1px;
  min-width: 0;
}
.menu-panel :deep(.item-sub) {
  font-size: var(--fs-2xs);
  color: var(--text-lo);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu-panel :deep(.menu-item kbd) {
  flex: none;
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: var(--fs-2xs);
  color: var(--text-lo);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  background: var(--bg-inset);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
  white-space: nowrap;
}
.menu-panel :deep(.icon) {
  flex: none;
}
</style>
