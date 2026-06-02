<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useWindowControls } from '@/composables/useWindowControls'

const { maximized, minimize, toggleMaximize, close } = useWindowControls()
</script>

<template>
  <div class="window-controls" role="group" aria-label="Controles da janela">
    <button type="button" class="wc-btn" aria-label="Minimizar" @click="minimize">
      <BaseIcon name="minimize" :size="12" />
    </button>
    <button
      type="button"
      class="wc-btn"
      :aria-label="maximized ? 'Restaurar' : 'Maximizar'"
      @click="toggleMaximize"
    >
      <BaseIcon :name="maximized ? 'restore' : 'maximize'" :size="12" />
    </button>
    <button type="button" class="wc-btn wc-close" aria-label="Fechar" @click="close">
      <BaseIcon name="close" :size="12" />
    </button>
  </div>
</template>

<style scoped>
.window-controls {
  display: flex;
  align-items: stretch;
  flex: none;
  height: 100%;
  margin: 0 calc(var(--sp-3) * -1) 0 var(--sp-2);
}
.wc-btn {
  display: grid;
  place-items: center;
  width: 46px;
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
