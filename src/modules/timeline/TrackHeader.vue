<script setup lang="ts">
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useTimelineStore } from '@/stores/timeline'
import type { Track } from '@/types'

defineProps<{ track: Track }>()
const timeline = useTimelineStore()
</script>

<template>
  <div class="track-header" :style="{ height: `${track.height}px` }" :data-type="track.type">
    <div class="lead">
      <span class="type-dot" />
      <BaseIcon :name="track.type === 'audio' ? 'audio' : 'video'" :size="14" class="type-icon" />
      <span class="name">{{ track.name }}</span>
    </div>
    <div class="toggles">
      <button
        class="t-btn"
        :class="{ off: track.muted }"
        :title="track.muted ? 'Reativar som' : 'Mudo'"
        :aria-pressed="track.muted"
        @click="timeline.toggleTrackFlag(track.id, 'muted')"
      >
        <BaseIcon :name="track.muted ? 'mute' : 'volume'" :size="14" />
      </button>
      <button
        v-if="track.type === 'video'"
        class="t-btn"
        :class="{ off: track.hidden }"
        :title="track.hidden ? 'Mostrar' : 'Ocultar'"
        :aria-pressed="track.hidden"
        @click="timeline.toggleTrackFlag(track.id, 'hidden')"
      >
        <BaseIcon :name="track.hidden ? 'eye-off' : 'eye'" :size="14" />
      </button>
      <button
        class="t-btn"
        :class="{ on: track.locked }"
        :title="track.locked ? 'Destravar' : 'Travar'"
        :aria-pressed="track.locked"
        @click="timeline.toggleTrackFlag(track.id, 'locked')"
      >
        <BaseIcon :name="track.locked ? 'lock' : 'lock-open'" :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.track-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--sp-2);
  border-bottom: 1px solid var(--border);
  background: var(--bg-2);
}
.lead {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.type-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--r-full);
  flex: none;
}
[data-type='video'] .type-dot {
  background: var(--media-video);
}
[data-type='audio'] .type-dot {
  background: var(--media-audio);
}
.type-icon {
  color: var(--text-lo);
}
.name {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-hi);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toggles {
  display: flex;
  gap: 2px;
}
.t-btn {
  display: grid;
  place-items: center;
  width: 24px;
  height: 22px;
  border-radius: var(--r-xs);
  color: var(--text-lo);
  transition: all var(--dur-fast);
}
.t-btn:hover {
  color: var(--text-hi);
  background: var(--bg-4);
}
.t-btn.off {
  color: var(--danger);
}
.t-btn.on {
  color: var(--accent);
}
</style>
