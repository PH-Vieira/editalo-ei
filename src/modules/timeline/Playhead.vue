<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTimelineStore } from '@/stores/timeline'

const HEADER_W = 168 // deve coincidir com --track-header-w

const timeline = useTimelineStore()
const { currentTime, pixelsPerSecond, hasClips } = storeToRefs(timeline)

const left = computed(() => HEADER_W + currentTime.value * pixelsPerSecond.value)

/**
 * Busca o container scrollável (.tl-scroll) a partir de qualquer nó filho.
 * Precisamos do scrollLeft para converter clientX → segundos corretamente.
 */
function findScroll(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el.parentElement
  while (cur) {
    if (cur.classList.contains('tl-scroll')) return cur
    cur = cur.parentElement
  }
  return null
}

function startDrag(e: PointerEvent) {
  if (!hasClips.value) return
  e.preventDefault()
  e.stopPropagation()
  timeline.beginUserSeek()
  const grip = e.currentTarget as HTMLElement
  const scrollEl = findScroll(grip)
  ;(grip as HTMLElement).setPointerCapture(e.pointerId)

  const move = (ev: PointerEvent) => {
    if (!scrollEl) return
    const rect = scrollEl.getBoundingClientRect()
    const x = ev.clientX - rect.left - HEADER_W + scrollEl.scrollLeft
    timeline.setCurrentTime(x / pixelsPerSecond.value)
  }

  const up = () => {
    timeline.endUserSeek()
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
</script>

<template>
  <div class="playhead" :class="{ inactive: !hasClips }" :style="{ left: `${left}px` }">
    <!-- O grip captura o evento diretamente — pointer-events: auto aqui -->
    <div class="grip" @pointerdown="startDrag" />
    <div class="line" />
  </div>
</template>

<style scoped>
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  z-index: 16;
  /* O próprio div é inerte; só o .grip e .line são ativos. */
  pointer-events: none;
}
.playhead.inactive .grip {
  opacity: 0.35;
  cursor: default;
}
.grip {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;   /* área de clique generosa */
  height: 18px;
  background: var(--accent);
  border-radius: 3px 3px 4px 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
  pointer-events: auto;
  cursor: ew-resize;
  /* Triângulo indicador */
}
.grip::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -6px;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid var(--accent);
  pointer-events: none;
}
.line {
  position: absolute;
  top: 17px; /* abaixo do grip */
  bottom: 0;
  left: 0;
  width: 1px;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent-soft-strong);
  pointer-events: none;
}
</style>
