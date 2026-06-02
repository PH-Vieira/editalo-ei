<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import IconButton from '@/components/ui/IconButton.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useProjectStore } from '@/stores/project'
import { toTimecode } from '@/utils/time'

const timeline = useTimelineStore()
const project = useProjectStore()
const { currentTime, isPlaying, hasClips } = storeToRefs(timeline)

const scrubbing = ref(false)
const fps = computed(() => project.project.fps)
const progress = computed(() =>
  timeline.duration > 0 ? (currentTime.value / timeline.duration) * 100 : 0,
)

function seek(e: MouseEvent) {
  if (!hasClips.value || timeline.duration <= 0) return
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  timeline.setCurrentTime(ratio * timeline.duration)
}

function startScrub(e: MouseEvent) {
  if (!hasClips.value) return
  timeline.beginUserSeek()
  scrubbing.value = true
  seek(e)
  const move = (ev: MouseEvent) => seek(ev)
  const up = () => {
    scrubbing.value = false
    timeline.endUserSeek()
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
</script>

<template>
  <div class="controls">
    <div
      class="scrubber"
      :class="{ active: scrubbing, disabled: !hasClips }"
      @mousedown="startScrub"
    >
      <div class="track">
        <div class="fill" :style="{ width: `${progress}%` }" />
        <div class="knob" :style="{ left: `${progress}%` }" />
      </div>
    </div>

    <div class="transport">
      <div v-if="hasClips" class="tc">
        <span class="tc-now mono">{{ toTimecode(currentTime, fps) }}</span>
        <span class="tc-sep">/</span>
        <span class="tc-total mono">{{ toTimecode(timeline.duration, fps) }}</span>
      </div>
      <div v-else class="tc tc-placeholder" aria-hidden="true">—</div>

      <div class="center-btns">
        <IconButton icon="skip-start" label="Início (Home)" @click="timeline.setCurrentTime(0)" />
        <button
          class="play"
          type="button"
          :aria-label="isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'"
          @click="timeline.togglePlay()"
        >
          <IconButton :icon="isPlaying ? 'pause' : 'play'" label="" :size="18" variant="accent" />
        </button>
        <IconButton icon="stop" label="Parar" @click="timeline.stop()" />
        <IconButton
          icon="skip-end"
          label="Fim (End)"
          @click="timeline.setCurrentTime(timeline.contentEnd)"
        />
      </div>

      <div class="rate mono">
        <span>{{ fps }} fps</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4) var(--sp-4);
}
.scrubber {
  padding: 6px 0;
  cursor: pointer;
}
.scrubber.disabled {
  cursor: default;
  opacity: 0.45;
  pointer-events: none;
}
.tc-placeholder {
  color: var(--text-lo);
  font-size: var(--fs-sm);
}
.track {
  position: relative;
  height: 4px;
  border-radius: var(--r-full);
  background: var(--bg-inset);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
}
.fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: var(--r-full);
  background: var(--accent);
}
.knob {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: var(--r-full);
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--bg-1), 0 2px 6px rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%) scale(0);
  transition: transform var(--dur-fast) var(--ease-out);
}
.scrubber:hover .knob,
.scrubber.active .knob {
  transform: translate(-50%, -50%) scale(1);
}
.transport {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}
.tc {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
}
.tc-now {
  color: var(--text-hi);
  font-weight: 500;
}
.tc-sep,
.tc-total {
  color: var(--text-lo);
}
.center-btns {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}
.play {
  border-radius: var(--r-sm);
}
.rate {
  justify-self: end;
  font-size: var(--fs-xs);
  color: var(--text-lo);
  padding: 3px 8px;
  border-radius: var(--r-full);
  background: var(--bg-inset);
}
</style>
