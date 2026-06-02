<script setup lang="ts">
/* Ícones coerentes (traço 1.6, estilo linha) num único componente. */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ name: string; size?: number; strokeWidth?: number }>(),
  { size: 16, strokeWidth: 1.6 },
)

// Cada ícone é o conteúdo interno de um <svg> viewBox 0 0 24 24.
const ICONS: Record<string, string> = {
  play: '<path d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.6" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  'skip-start': '<path d="M7 5v14M19 5l-9 7 9 7V5z" fill="currentColor" stroke="none"/>',
  'skip-end': '<path d="M17 5v14M5 5l9 7-9 7V5z" fill="currentColor" stroke="none"/>',
  cursor: '<path d="M5 3l6.5 16 2.2-6.3L20 10.5 5 3z"/>',
  blade: '<path d="M14.5 4l-9 9M3 21a3 3 0 100-6 3 3 0 000 6zM9 14l11 7"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 013 0v5M11 11V5a1.5 1.5 0 013 0v6M14 11V7a1.5 1.5 0 013 0v6c0 3.5-2 7-6 7s-6-3-6-6l-.8-2.2a1.4 1.4 0 012.4-1.4L8 13"/>',
  'zoom-in': '<circle cx="11" cy="11" r="6.5"/><path d="M21 21l-4.5-4.5M11 8.5v5M8.5 11h5"/>',
  'zoom-out': '<circle cx="11" cy="11" r="6.5"/><path d="M21 21l-4.5-4.5M8.5 11h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  import: '<path d="M12 3v12M8 11l4 4 4-4M5 21h14"/>',
  save: '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h7"/>',
  export: '<path d="M12 15V3M8 7l4-4 4 4M5 21h14v-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="M15.5 10l6-3v10l-6-3z"/>',
  audio: '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9a4 4 0 010 6M19 6.5a8 8 0 010 11"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5L5 21"/>',
  text: '<path d="M5 6h14M5 6v-1M19 6v-1M12 6v13M9 19h6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M3 3l18 18M10.6 10.6a3 3 0 004 4M9.4 5.2A9.6 9.6 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3 3.8M6.3 6.3A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 003.2-.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  'lock-open': '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
  volume: '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 9a4 4 0 010 6"/>',
  mute: '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  wand: '<path d="M15 4V2M15 10V8M11 6H9M21 6h-2M18.5 3.5l-1.4 1.4M12.9 9.1l-1.4 1.4M4 20l9-9"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5" opacity="0.5"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  resolution: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/>',
  fps: '<circle cx="12" cy="12" r="8.5"/><path d="M12 12l4-2M9 12h.01M15 9.5h.01M15 14.5h.01M9 14.5h.01"/>',
  magnet: '<path d="M6 4v6a6 6 0 0012 0V4M6 4H3M18 4h3M6 10H3M18 10h3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  undo: '<path d="M3 10h10a6 6 0 010 12H9M3 10l4-4M3 10l4 4"/>',
  redo: '<path d="M21 10H11a6 6 0 000 12h4M21 10l-4-4M21 10l-4 4"/>',
}

const inner = computed(() => ICONS[props.name] ?? '')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :stroke-width="strokeWidth"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
    v-html="inner"
  />
</template>

<style scoped>
.icon {
  display: block;
  flex: none;
}
</style>
