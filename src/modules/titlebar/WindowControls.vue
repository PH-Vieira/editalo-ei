<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'

defineProps<{
  maximized: boolean
}>()

const emit = defineEmits<{
  minimize: []
  toggleMaximize: []
  close: []
}>()
</script>

<template>
  <div class="window-controls" role="group" aria-label="Controles da janela">
    <button type="button" class="wc-btn" aria-label="Minimizar" @click="emit('minimize')">
      <BaseIcon name="minimize" :size="11" />
    </button>
    <button
      type="button"
      class="wc-btn"
      :aria-label="maximized ? 'Restaurar' : 'Maximizar'"
      @click="emit('toggleMaximize')"
    >
      <BaseIcon :name="maximized ? 'restore' : 'maximize'" :size="11" />
    </button>
    <button type="button" class="wc-btn wc-close" aria-label="Fechar" @click="emit('close')">
      <BaseIcon name="close" :size="11" />
    </button>
  </div>
</template>

<style scoped>
.window-controls {
  display: flex;
  align-items: stretch;
  flex: none;
  height: var(--topbar-h);
  margin: 0 0 0 var(--sp-2);
}
.wc-btn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 100%;
  color: var(--text-mid);
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}
.wc-btn:hover {
  background: var(--bg-4);
  color: var(--text-hi);
}
.wc-close:hover {
  background: #e81123;
  color: #fff;
}
</style>
