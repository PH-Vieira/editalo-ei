<script setup lang="ts">
import BaseIcon from './BaseIcon.vue'

withDefaults(
  defineProps<{
    icon: string
    label: string
    active?: boolean
    disabled?: boolean
    size?: number
    variant?: 'ghost' | 'solid' | 'accent'
  }>(),
  { active: false, disabled: false, size: 16, variant: 'ghost' },
)
</script>

<template>
  <button
    type="button"
    class="icon-btn"
    :class="[`v-${variant}`, { active }]"
    :disabled="disabled"
    :title="label"
    :aria-label="label"
    :aria-pressed="active"
  >
    <BaseIcon :name="icon" :size="size" />
    <slot />
  </button>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  height: 30px;
  min-width: 30px;
  padding: 0 7px;
  border-radius: var(--r-sm);
  color: var(--text-mid);
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}
.icon-btn:hover:not(:disabled) {
  background: var(--bg-4);
  color: var(--text-hi);
}
.icon-btn:active:not(:disabled) {
  transform: scale(0.94);
}
.icon-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent-soft-strong);
}
.icon-btn:disabled {
  opacity: 0.38;
}

/* variantes */
.v-solid {
  background: var(--bg-3);
  color: var(--text-hi);
  box-shadow: var(--shadow-inset);
}
.v-solid:hover:not(:disabled) {
  background: var(--bg-4);
}
.v-accent {
  background: var(--accent);
  color: var(--text-on-accent);
  font-weight: 600;
}
.v-accent:hover:not(:disabled) {
  background: var(--accent-hover);
  color: var(--text-on-accent);
}
</style>
