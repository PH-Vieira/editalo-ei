<script setup lang="ts">
import BaseIcon from './BaseIcon.vue'

withDefaults(defineProps<{ icon?: string; title: string; hint?: string }>(), {
  icon: 'film',
})
</script>

<template>
  <div class="empty">
    <div class="glyph">
      <BaseIcon :name="icon" :size="22" :stroke-width="1.4" />
    </div>
    <p class="title">{{ title }}</p>
    <p v-if="hint" class="hint">{{ hint }}</p>
    <div v-if="$slots.default" class="action"><slot /></div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--sp-6) var(--sp-5);
  gap: var(--sp-2);
  height: 100%;
}
.glyph {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: var(--sp-1);
  border-radius: var(--r-lg);
  color: var(--text-lo);
  background: var(--bg-inset);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
}
.title {
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--text-mid);
}
.hint {
  font-size: var(--fs-xs);
  color: var(--text-lo);
  max-width: 26ch;
  line-height: 1.5;
}
.action {
  margin-top: var(--sp-3);
}
</style>
