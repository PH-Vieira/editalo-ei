<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useTimelineStore } from '@/stores/timeline'
import type { Track } from '@/types'

const props = defineProps<{ track: Track }>()
const timeline = useTimelineStore()

const editing = ref(false)
const editName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

const clipCount = computed(
  () => timeline.clips.filter((c) => c.trackId === props.track.id).length,
)

const sameTypeTracks = computed(() =>
  timeline.tracks
    .filter((t) => t.type === props.track.type)
    .sort((a, b) => a.index - b.index),
)

const positionInType = computed(() =>
  sameTypeTracks.value.findIndex((t) => t.id === props.track.id),
)

const showReorder = computed(() => sameTypeTracks.value.length > 1)

const showMoveUp = computed(
  () => showReorder.value && positionInType.value > 0,
)

const showMoveDown = computed(
  () =>
    showReorder.value
    && positionInType.value >= 0
    && positionInType.value < sameTypeTracks.value.length - 1,
)

function startRename() {
  if (props.track.locked) return
  editing.value = true
  editName.value = props.track.name
  void nextTick(() => nameInput.value?.select())
}

function commitRename() {
  editing.value = false
  timeline.renameTrack(props.track.id, editName.value)
}

function cancelRename() {
  editing.value = false
}
</script>

<template>
  <div
    class="track-header"
    :style="{ height: `${track.height}px` }"
    :data-type="track.type"
    :data-track-id="track.id"
  >
    <div class="lead">
      <div v-if="showReorder" class="reorder">
        <button
          v-if="showMoveUp"
          type="button"
          class="order-btn"
          title="Subir trilha"
          :disabled="track.locked"
          @click="timeline.moveTrackUp(track.id)"
        >
          <BaseIcon name="chevron-up" :size="14" />
        </button>
        <button
          v-if="showMoveDown"
          type="button"
          class="order-btn"
          title="Descer trilha"
          :disabled="track.locked"
          @click="timeline.moveTrackDown(track.id)"
        >
          <BaseIcon name="chevron-down" :size="14" />
        </button>
      </div>
      <span class="type-dot" />
      <BaseIcon :name="track.type === 'audio' ? 'audio' : 'video'" :size="14" class="type-icon" />
      <input
        v-if="editing"
        ref="nameInput"
        v-model="editName"
        class="name-input"
        maxlength="48"
        @keydown.enter="commitRename"
        @keydown.escape.prevent="cancelRename"
        @blur="commitRename"
      />
      <span
        v-else
        class="name"
        :title="track.locked ? track.name : 'Duplo clique para renomear'"
        @dblclick="startRename"
      >
        {{ track.name }}
      </span>
    </div>
    <div class="footer">
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
        <button
          type="button"
          class="t-btn danger"
          :disabled="track.locked"
          :title="
            track.locked
              ? 'Destrave para remover'
              : clipCount
                ? `Remover trilha e ${clipCount} clipe(s)`
                : 'Remover trilha'
          "
          @click="timeline.removeTrack(track.id)"
        >
          <BaseIcon name="trash" :size="14" />
        </button>
      </div>
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
  gap: 4px;
  min-width: 0;
}
.reorder {
  display: flex;
  flex-direction: column;
  flex: none;
  gap: 1px;
}
.order-btn {
  display: grid;
  place-items: center;
  width: 20px;
  height: 18px;
  border-radius: var(--r-xs);
  color: var(--text-lo);
  transition: all var(--dur-fast);
}
.order-btn:hover:not(:disabled) {
  color: var(--text-hi);
  background: var(--bg-4);
}
.order-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
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
  flex: none;
  color: var(--text-lo);
}
.name {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-hi);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}
.name-input {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-hi);
  background: var(--bg-inset);
  border-radius: var(--r-xs);
  box-shadow: inset 0 0 0 1px var(--accent-ring);
}
.footer {
  display: flex;
  justify-content: flex-end;
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
.t-btn:hover:not(:disabled) {
  color: var(--text-hi);
  background: var(--bg-4);
}
.t-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.t-btn.off {
  color: var(--danger);
}
.t-btn.on {
  color: var(--accent);
}
.t-btn.danger:hover:not(:disabled) {
  color: var(--danger);
}
</style>
