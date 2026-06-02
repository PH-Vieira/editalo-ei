<script setup lang="ts">
/* Campo numérico com arraste horizontal (scrub) — padrão de software criativo. */
import { ref } from 'vue'
import { clamp } from '@/utils/time'

const props = withDefaults(
  defineProps<{
    modelValue: number
    label: string
    min?: number
    max?: number
    step?: number
    suffix?: string
    precision?: number
  }>(),
  { min: -Infinity, max: Infinity, step: 1, suffix: '', precision: 0 },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const dragging = ref(false)

function commit(v: number) {
  emit('update:modelValue', clamp(Number(v.toFixed(props.precision)), props.min, props.max))
}

function onInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isNaN(v)) commit(v)
}

function startScrub(e: PointerEvent) {
  if ((e.target as HTMLElement).tagName === 'INPUT') return
  dragging.value = true
  const startX = e.clientX
  const startVal = props.modelValue
  const sensitivity = props.step * 0.6
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

  const move = (ev: PointerEvent) => {
    commit(startVal + (ev.clientX - startX) * sensitivity)
  }
  const up = () => {
    dragging.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
</script>

<template>
  <label class="field" :class="{ dragging }">
    <span class="label" @pointerdown.prevent="startScrub">{{ label }}</span>
    <span class="control">
      <input
        class="mono"
        type="number"
        :value="modelValue"
        :min="min === -Infinity ? undefined : min"
        :max="max === Infinity ? undefined : max"
        :step="step"
        @input="onInput"
      />
      <span v-if="suffix" class="suffix">{{ suffix }}</span>
    </span>
  </label>
</template>

<style scoped>
.field {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--sp-2);
  height: 30px;
  padding: 0 var(--sp-2) 0 0;
  border-radius: var(--r-sm);
  background: var(--bg-inset);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
  transition: box-shadow var(--dur-fast) var(--ease-out);
}
.field:focus-within {
  box-shadow: inset 0 0 0 1px var(--accent-ring);
}
.label {
  padding: 0 var(--sp-3);
  font-size: var(--fs-xs);
  color: var(--text-lo);
  cursor: ew-resize;
  white-space: nowrap;
}
.dragging .label {
  color: var(--accent);
}
.control {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
input {
  width: 100%;
  min-width: 40px;
  text-align: right;
  background: none;
  border: none;
  color: var(--text-hi);
  font-size: var(--fs-sm);
  padding: 0;
}
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}
input[type='number'] {
  -moz-appearance: textfield;
}
.suffix {
  font-size: var(--fs-2xs);
  color: var(--text-lo);
}
</style>
