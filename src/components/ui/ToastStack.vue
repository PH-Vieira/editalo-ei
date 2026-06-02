<script setup lang="ts">
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useUiStore } from '@/stores/ui'
import type { SystemMessage } from '@/types'

const ui = useUiStore()
const { messages } = storeToRefs(ui)

async function copyAndDismiss(msg: SystemMessage) {
  try {
    await navigator.clipboard.writeText(msg.text)
  } catch {
    /* fallback silencioso — ainda fecha o toast */
  }
  ui.dismiss(msg.id)
}
</script>

<template>
  <TransitionGroup name="toast" tag="div" class="toast-stack">
    <div
      v-for="m in messages"
      :key="m.id"
      class="toast"
      :class="[`tone-${m.tone}`, { persistent: m.tone === 'danger' }]"
      role="status"
    >
      <span class="dot" />
      <span class="text">{{ m.text }}</span>
      <button
        v-if="m.tone === 'danger'"
        class="copy-btn"
        type="button"
        aria-label="Copiar erro e fechar"
        title="Copiar erro"
        @click="copyAndDismiss(m)"
      >
        <BaseIcon name="copy" :size="14" />
        <span>Copiar</span>
      </button>
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
  max-width: min(92vw, 560px);
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
  pointer-events: auto;
}
.toast.persistent {
  align-items: flex-start;
  border-radius: var(--r-md);
  padding: var(--sp-3);
  max-width: 100%;
}
.dot {
  flex: 0 0 7px;
  width: 7px;
  height: 7px;
  margin-top: 6px;
  border-radius: var(--r-full);
  background: var(--text-mid);
}
.toast:not(.persistent) .dot {
  margin-top: 0;
}
.text {
  min-width: 0;
  line-height: 1.45;
  word-break: break-word;
}
.tone-success .dot { background: var(--success); }
.tone-warning .dot { background: var(--warning); }
.tone-danger .dot { background: var(--danger); }
.tone-info .dot { background: var(--accent); }
.tone-danger {
  background: var(--danger-soft);
  box-shadow: var(--shadow-pop), inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent);
}
.copy-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: var(--sp-1);
  padding: 4px var(--sp-2);
  border-radius: var(--r-sm);
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--text-hi);
  background: var(--bg-4);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
  transition:
    background var(--dur-fast),
    color var(--dur-fast);
}
.copy-btn:hover {
  background: var(--bg-3);
  color: var(--danger);
}

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
