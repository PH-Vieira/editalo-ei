<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTimelineStore } from '@/stores/timeline'
import { rulerStep, toClock } from '@/utils/time'

const timeline = useTimelineStore()
const { pixelsPerSecond } = storeToRefs(timeline)

interface Tick {
  t: number
  x: number
  major: boolean
  label: string
}

const ticks = computed<Tick[]>(() => {
  const step = rulerStep(pixelsPerSecond.value)
  const sub = step / 2
  const result: Tick[] = []
  for (let t = 0; t <= timeline.duration + step; t += sub) {
    const major = Math.abs(t % step) < 1e-6
    result.push({
      t,
      x: t * pixelsPerSecond.value,
      major,
      label: major ? toClock(t) : '',
    })
  }
  return result
})
</script>

<template>
  <div class="ruler" :style="{ width: `${timeline.duration * pixelsPerSecond}px` }">
    <div
      v-for="(tick, i) in ticks"
      :key="i"
      class="tick"
      :class="{ major: tick.major }"
      :style="{ left: `${tick.x}px` }"
    >
      <span v-if="tick.label" class="label mono">{{ tick.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.ruler {
  position: relative;
  height: 100%;
  min-width: 100%;
}
.tick {
  position: absolute;
  bottom: 0;
  width: 1px;
  height: 7px;
  background: var(--border-strong);
}
.tick.major {
  height: 12px;
  background: var(--text-lo);
}
.label {
  position: absolute;
  bottom: 14px;
  left: 4px;
  font-size: 10px;
  color: var(--text-mid);
  white-space: nowrap;
}
</style>
