<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { messages } = storeToRefs(ui)
</script>

<template>
  <TransitionGroup name="toast" tag="div" class="toast-stack">
    <div
      v-for="m in messages"
      :key="m.id"
      class="toast"
      :class="`tone-${m.tone}`"
      role="status"
    >
      <span class="dot" />
      <span class="text">{{ m.text }}</span>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: calc(var(--statusbar-h) + var(--sp-3));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  z-index: var(--z-popover);
  pointer-events: none;
}
.toast {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-full);
  background: var(--bg-3);
  box-shadow: var(--shadow-pop), inset 0 0 0 1px var(--border-strong);
  font-size: var(--fs-sm);
  color: var(--text-hi);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: var(--r-full);
  background: var(--text-mid);
}
.tone-success .dot { background: var(--success); }
.tone-warning .dot { background: var(--warning); }
.tone-danger .dot { background: var(--danger); }
.tone-info .dot { background: var(--accent); }

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--dur-med) var(--ease-out),
    transform var(--dur-med) var(--ease-out);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
</style>
