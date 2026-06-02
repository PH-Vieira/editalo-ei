<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import PlayerControls from './PlayerControls.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useProjectStore } from '@/stores/project'
import { kindLabel } from '@/utils/format'
import { toMediaSrc } from '@/tauri/commands'
import type { Clip } from '@/types'

const timeline = useTimelineStore()
const project = useProjectStore()
const { currentTime, isPlaying } = storeToRefs(timeline)

const aspect = computed(() => `${project.project.width} / ${project.project.height}`)

// Clipes visíveis sob o playhead, do topo (maior z) para baixo.
const activeVisuals = computed(() =>
  timeline.clips
    .filter(
      (c) =>
        (c.kind === 'video' || c.kind === 'image' || c.kind === 'text') &&
        currentTime.value >= c.start &&
        currentTime.value < c.start + c.duration,
    )
    .sort((a, b) => {
      const ta = timeline.tracks.find((t) => t.id === a.trackId)?.index ?? 0
      const tb = timeline.tracks.find((t) => t.id === b.trackId)?.index ?? 0
      return tb - ta
    }),
)
const topVisual = computed(() => activeVisuals.value[0] ?? null)

const videoEl = ref<HTMLVideoElement | null>(null)
const mediaSrc = ref<string | undefined>()
const mediaKind = ref<'video' | 'image' | null>(null)

// O áudio do preview respeita o mute da trilha do clipe ativo.
const activeMuted = computed(() => {
  const clip = topVisual.value
  if (!clip) return true
  return timeline.tracks.find((t) => t.id === clip.trackId)?.muted ?? false
})

/** Tempo dentro da fonte correspondente a um tempo da timeline. */
function localOffset(clip: Clip, t: number): number {
  return Math.max(0, clip.inPoint + (t - clip.start))
}

/* ------------------------------------------------------------------ */
/* Carregamento do arquivo do clipe ativo                             */
/* ------------------------------------------------------------------ */
watch(
  () => topVisual.value?.assetId ?? null,
  async (assetId) => {
    const clip = topVisual.value
    const asset = assetId ? project.assets.find((a) => a.id === assetId) : null
    if (clip && asset?.src && (clip.kind === 'video' || clip.kind === 'image')) {
      mediaSrc.value = await toMediaSrc(asset.src)
      mediaKind.value = clip.kind
    } else {
      mediaSrc.value = undefined
      mediaKind.value = null
    }
  },
  { immediate: true },
)

/** Quando o <video> tem dados suficientes: posiciona e retoma se estiver tocando. */
function onCanPlay() {
  const v = videoEl.value
  const clip = topVisual.value
  if (!v || !clip || mediaKind.value !== 'video') return
  const target = localOffset(clip, currentTime.value)
  if (Math.abs(v.currentTime - target) > 0.06) {
    try {
      v.currentTime = target
    } catch {
      /* ignora */
    }
  }
  if (isPlaying.value) v.play().catch(() => {})
}

/* ------------------------------------------------------------------ */
/* Scrubbing: só seekamos o vídeo quando NÃO está tocando             */
/* (durante a reprodução, o vídeo é a fonte do tempo)                 */
/* ------------------------------------------------------------------ */
watch(currentTime, (t) => {
  if (isPlaying.value) return
  const v = videoEl.value
  const clip = topVisual.value
  if (!v || !clip || mediaKind.value !== 'video') return
  const target = localOffset(clip, t)
  if (Number.isFinite(target) && Math.abs(v.currentTime - target) > 0.04) {
    try {
      v.currentTime = target
    } catch {
      /* mídia ainda carregando */
    }
  }
})

/* ------------------------------------------------------------------ */
/* Motor de reprodução (requestAnimationFrame)                        */
/* O playhead SEGUE o relógio do <video>; nunca o re-seekamos a cada  */
/* frame — é isso que elimina o travamento.                           */
/* ------------------------------------------------------------------ */
let raf = 0
let last = 0

function tick(now: number) {
  const dt = (now - last) / 1000
  last = now
  const v = videoEl.value
  const clip = topVisual.value
  const playingVideo = clip && mediaKind.value === 'video' && v && v.readyState >= 2 && !v.paused

  if (playingVideo && v && clip) {
    const localEnd = clip.inPoint + clip.duration
    if (v.currentTime >= localEnd - 0.03) {
      // Chegou ao fim deste clipe → empurra o playhead para o próximo.
      timeline.setCurrentTime(clip.start + clip.duration + 0.001)
    } else {
      timeline.setCurrentTime(clip.start + (v.currentTime - clip.inPoint))
    }
  } else {
    // Sem vídeo ativo (imagem/áudio/intervalo): relógio simples.
    timeline.setCurrentTime(timeline.currentTime + dt)
  }

  if (timeline.currentTime >= timeline.contentEnd) {
    timeline.setCurrentTime(timeline.contentEnd)
    stopPlayback()
    timeline.pause()
    return
  }
  raf = requestAnimationFrame(tick)
}

function startPlayback() {
  const v = videoEl.value
  const clip = topVisual.value
  if (v && clip && mediaKind.value === 'video') {
    const target = localOffset(clip, currentTime.value)
    if (Math.abs(v.currentTime - target) > 0.06) {
      try {
        v.currentTime = target
      } catch {
        /* ignora */
      }
    }
    v.play().catch(() => {})
  }
  last = performance.now()
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
}

function stopPlayback() {
  cancelAnimationFrame(raf)
  raf = 0
  videoEl.value?.pause()
}

watch(isPlaying, (p) => (p ? startPlayback() : stopPlayback()))
onBeforeUnmount(stopPlayback)
</script>

<template>
  <div class="preview">
    <header class="preview-head">
      <div class="tabs">
        <span class="tab active">Programa</span>
        <span class="tab">Fonte</span>
      </div>
      <div class="badge mono">{{ project.project.width }}×{{ project.project.height }}</div>
    </header>

    <div class="stage">
      <div class="viewport" :style="{ aspectRatio: aspect }">
        <div class="frame">
          <!-- Vídeo real -->
          <video
            v-show="mediaKind === 'video' && mediaSrc"
            ref="videoEl"
            class="media"
            :src="mediaSrc"
            :muted="activeMuted"
            playsinline
            preload="auto"
            @canplay="onCanPlay"
            @loadeddata="onCanPlay"
          />
          <!-- Imagem real -->
          <img v-if="mediaKind === 'image' && mediaSrc" class="media" :src="mediaSrc" alt="" />

          <!-- Placeholder (texto, sem arquivo, ou modo navegador) -->
          <template v-if="!mediaSrc">
            <template v-if="topVisual">
              <div class="frame-fill" :style="{ background: topVisual.color }" />
              <div class="frame-grad" />
              <div class="frame-info">
                <span class="frame-kind">
                  <BaseIcon
                    :name="topVisual.kind === 'image' ? 'image' : topVisual.kind === 'text' ? 'text' : 'video'"
                    :size="13"
                  />
                  {{ kindLabel(topVisual.kind) }}
                </span>
                <span class="frame-name">{{ topVisual.name }}</span>
              </div>
            </template>
            <div v-else class="frame-empty">
              <BaseIcon name="film" :size="26" :stroke-width="1.3" />
              <span>Sem mídia no playhead</span>
            </div>
          </template>

          <span v-if="activeVisuals.length > 1" class="layer-count">
            +{{ activeVisuals.length - 1 }} camada(s)
          </span>
        </div>

        <div class="guides" aria-hidden="true">
          <span class="cross h" />
          <span class="cross v" />
          <span class="safe" />
        </div>
      </div>
    </div>

    <PlayerControls />
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-1);
}
.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-subtle);
}
.tabs {
  display: flex;
  gap: var(--sp-1);
}
.tab {
  font-size: var(--fs-xs);
  padding: 4px var(--sp-2);
  border-radius: var(--r-sm);
  color: var(--text-lo);
}
.tab.active {
  color: var(--text-hi);
  background: var(--bg-3);
}
.badge {
  font-size: var(--fs-2xs);
  color: var(--text-lo);
}
.stage {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: var(--sp-5);
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(255, 255, 255, 0.02), transparent 60%),
    var(--bg-1);
}
.viewport {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--bg-inset);
  box-shadow: var(--shadow-md), inset 0 0 0 1px var(--border);
}
.frame {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.frame-fill {
  position: absolute;
  inset: 0;
  opacity: 0.16;
}
.frame-grad {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.5));
}
.frame-info {
  position: absolute;
  left: var(--sp-4);
  bottom: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.frame-kind {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--fs-2xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-mid);
}
.frame-name {
  font-family: var(--font-display);
  font-size: var(--fs-xl);
  font-weight: 600;
  color: var(--text-hi);
}
.layer-count {
  position: absolute;
  top: var(--sp-3);
  right: var(--sp-3);
  font-size: var(--fs-2xs);
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: rgba(0, 0, 0, 0.45);
  color: var(--text-mid);
}
.frame-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  color: var(--text-lo);
  font-size: var(--fs-sm);
}
.guides {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--dur-med);
}
.viewport:hover .guides {
  opacity: 1;
}
.cross {
  position: absolute;
  background: rgba(255, 255, 255, 0.12);
}
.cross.h {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
}
.cross.v {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
}
.safe {
  position: absolute;
  inset: 6%;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 2px;
}
</style>
