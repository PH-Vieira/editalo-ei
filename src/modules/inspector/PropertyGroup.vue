<script setup lang="ts">
import { ref } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'

defineProps<{ title: string; icon: string }>()
const open = ref(true)
</script>

<template>
  <section class="group" :class="{ collapsed: !open }">
    <button class="group-head" type="button" :aria-expanded="open" @click="open = !open">
      <BaseIcon name="chevron-down" :size="14" class="caret" />
      <BaseIcon :name="icon" :size="14" class="g-icon" />
      <span>{{ title }}</span>
    </button>
    <Transition name="collapse">
      <div v-show="open" class="group-body">
        <slot />
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.group {
  border-bottom: 1px solid var(--border-subtle);
}
.group-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  padding: var(--sp-3);
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-mid);
}
.group-head:hover {
  color: var(--text-hi);
}
.g-icon {
  color: var(--accent);
}
.caret {
  color: var(--text-lo);
  transition: transform var(--dur-fast) var(--ease-out);
}
.collapsed .caret {
  transform: rotate(-90deg);
}
.group-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: 0 var(--sp-3) var(--sp-3);
}
.collapse-enter-active,
.collapse-leave-active {
  transition: opacity var(--dur-fast) var(--ease-out);
}
.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
}
</style>
