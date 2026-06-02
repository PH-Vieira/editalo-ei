<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'
import type { Asset } from '@/types'
import { toClock } from '@/utils/time'
import { formatBytes } from '@/utils/format'

defineProps<{ asset: Asset; selected: boolean }>()
const emit = defineEmits<{ select: []; add: []; remove: []; dragstart: [e: DragEvent] }>()

const iconByKind: Record<string, string> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
}
</script>

<template>
  <article
    class="media-item"
    :class="{ selected }"
    :data-kind="asset.kind"
    draggable="true"
    tabindex="0"
    role="button"
    :aria-label="`${asset.name}, ${asset.kind}`"
    :aria-pressed="selected"
    @click="emit('select')"
    @dblclick="emit('add')"
    @keydown.enter="emit('add')"
    @keydown.space.prevent="emit('select')"
    @dragstart="emit('dragstart', $event)"
  >
    <div class="thumb" :data-kind="asset.kind">
      <BaseIcon :name="iconByKind[asset.kind]" :size="18" />
      <span v-if="asset.duration > 0" class="dur mono">{{ toClock(asset.duration) }}</span>
    </div>
    <div class="meta">
      <p class="name" :title="asset.name">{{ asset.name }}</p>
      <p class="sub mono">{{ formatBytes(asset.fileSize) }}</p>
    </div>
    <div class="actions">
      <button
        class="action add"
        type="button"
        draggable="false"
        title="Adicionar à timeline"
        aria-label="Adicionar à timeline"
        @click.stop="emit('add')"
      >
        <BaseIcon name="plus" :size="14" />
      </button>
      <button
        class="action remove"
        type="button"
        draggable="false"
        title="Remover da biblioteca"
        aria-label="Remover da biblioteca"
        @click.stop="emit('remove')"
      >
        <BaseIcon name="trash" :size="14" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.media-item {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border-radius: var(--r-md);
  background: var(--bg-3);
  box-shadow: inset 0 0 0 1px transparent;
  cursor: grab;
  transition:
    background var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}
.media-item:hover {
  background: var(--bg-4);
}
.media-item:active {
  cursor: grabbing;
}
.media-item.selected {
  box-shadow: inset 0 0 0 1px var(--accent-ring);
  background: var(--accent-soft);
}
.thumb {
  position: relative;
  display: grid;
  place-items: center;
  height: 36px;
  border-radius: var(--r-sm);
  color: var(--bg-0);
  background: var(--bg-inset);
  overflow: hidden;
}
.thumb[data-kind='video'] { color: var(--media-video); }
.thumb[data-kind='audio'] { color: var(--media-audio); }
.thumb[data-kind='image'] { color: var(--media-image); }
.thumb[data-kind='text'] { color: var(--media-text); }
.thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0.1;
}
.dur {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-size: 9px;
  padding: 0 3px;
  border-radius: var(--r-xs);
  background: rgba(0, 0, 0, 0.6);
  color: var(--text-hi);
}
.meta {
  min-width: 0;
}
.name {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-hi);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  font-size: var(--fs-2xs);
  color: var(--text-lo);
}
.actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.action {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r-sm);
  color: var(--text-mid);
  opacity: 0;
  transition:
    opacity var(--dur-fast),
    background var(--dur-fast),
    color var(--dur-fast);
}
.media-item:hover .action,
.media-item:focus-within .action {
  opacity: 1;
}
.add:hover {
  background: var(--accent);
  color: var(--text-on-accent);
}
.remove:hover {
  background: var(--danger-soft);
  color: var(--danger);
}
</style>
