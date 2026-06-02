<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import PlayerControls from './PlayerControls.vue'
import PreviewLayer from './PreviewLayer.vue'
import { useTimelineStore } from '@/stores/timeline'
import { useProjectStore } from '@/stores/project'
import { toMediaSrc } from '@/tauri/commands'
import type { Clip } from '@/types'

const timeline = useTimelineStore()
const project = useProjectStore()
const { currentTime, isPlaying } = storeToRefs(timeline)

const aspect = computed(() => `${project.project.width} / ${project.project.height}`)
const projW = computed(() => project.project.width)
const projH = computed(() => project.project.height)

function trackOf(clip: Clip) {
  return timeline.tracks.find((t) => t.id === clip.trackId)
}

// Clipes visíveis sob o playhead, do topo (maior z) para baixo.
const activeVisuals = computed(() =>
  timeline.clips
    .filter((c) => {
      if (c.kind !== 'video' && c.kind !== 'image' && c.kind !== 'text') return false
      if (currentTime.value < c.start || currentTime.value >= c.start + c.duration) return false
      return !trackOf(c)?.hidden
    })
    .sort((a, b) => (trackOf(b)?.index ?? 0) - (trackOf(a)?.index ?? 0)),
)

/** Ordem de pintura: trilha de baixo primeiro, topo por último. */
const stackedVisuals = computed(() => [...activeVisuals.value].reverse())

/** Vídeo do topo que dirige o relógio do playhead. */
const masterVideoClip = computed(() => activeVisuals.value.find((c) => c.kind === 'video') ?? null)

const shouldSyncVideo = computed(() => !isPlaying.value || timeline.isUserSeeking)

const videoEl = ref<HTMLVideoElement | null>(null)

function onMasterVideo(el: HTMLVideoElement | null) {
  videoEl.value = el
}

watch(masterVideoClip, (clip) => {
  if (!clip) {
    videoEl.value?.pause()
    videoEl.value = null
  }
})
const audioEl = ref<HTMLAudioElement | null>(null)
const audioSrc = ref<string | undefined>()

/** Clipe de áudio dedicado sob o playhead (trilha de áudio). */
const activeAudioClip = computed(() => {
  const clips = timeline.clips
    .filter(
      (c) =>
        c.kind === 'audio' &&
        currentTime.value >= c.start &&
        currentTime.value < c.start + c.duration,
    )
    .filter((c) => {
      const tr = timeline.tracks.find((t) => t.id === c.trackId)
      return tr && !tr.muted
    })
    .sort((a, b) => {
      const ta = timeline.tracks.find((t) => t.id === a.trackId)?.index ?? 0
      const tb = timeline.tracks.find((t) => t.id === b.trackId)?.index ?? 0
      return tb - ta
    })
  return clips[0] ?? null
})

function applyAudioOutput() {
  const a = audioEl.value
  const clip = activeAudioClip.value
  if (!a || !clip) return
  const track = trackOf(clip)
  a.muted = !!(track?.muted)
  a.volume = Math.min(1, Math.max(0, clip.volume))
}

/** Tempo dentro da fonte correspondente a um tempo da timeline. */
function localOffset(clip: Clip, t: number): number {
  return Math.max(0, clip.inPoint + (t - clip.start))
}

/* ------------------------------------------------------------------ */
/* Carregamento do clipe de áudio dedicado                            */
/* ------------------------------------------------------------------ */
watch(
  () => activeAudioClip.value?.assetId ?? null,
  async (assetId) => {
    const clip = activeAudioClip.value
    const asset = assetId ? project.assets.find((a) => a.id === assetId) : null
    if (clip && asset?.src) {
      audioSrc.value = await toMediaSrc(asset.src)
    } else {
      audioSrc.value = undefined
    }
  },
  { immediate: true },
)

watch(
  () => [
    activeAudioClip.value?.id,
    activeAudioClip.value?.volume,
    ...timeline.tracks.map((t) => t.muted),
  ],
  () => applyAudioOutput(),
)

function onAudioCanPlay() {
  const a = audioEl.value
  const clip = activeAudioClip.value
  if (!a || !clip || !audioSrc.value) return
  applyAudioOutput()
  const target = localOffset(clip, currentTime.value)
  if (Math.abs(a.currentTime - target) > 0.06) {
    try {
      a.currentTime = target
    } catch {
      /* ignora */
    }
  }
  if (isPlaying.value) void a.play().catch(() => {})
}

/* ------------------------------------------------------------------ */
/* Sincroniza o <video> quando o playhead muda na timeline            */
/* (pausado, ou busca manual durante reprodução — estilo CapCut)        */
/* ------------------------------------------------------------------ */
function syncMasterVideo(t: number) {
  const v = videoEl.value
  const clip = masterVideoClip.value
  if (!v || !clip) return
  const target = localOffset(clip, t)
  if (Number.isFinite(target) && Math.abs(v.currentTime - target) > 0.04) {
    try {
      v.currentTime = target
    } catch {
      /* mídia ainda carregando */
    }
  }
  if (isPlaying.value) void v.play().catch(() => {})
}

function syncAudioToPlayhead(t: number) {
  const a = audioEl.value
  const clip = activeAudioClip.value
  if (!a || !clip || !audioSrc.value) return
  applyAudioOutput()
  const target = localOffset(clip, t)
  if (Number.isFinite(target) && Math.abs(a.currentTime - target) > 0.04) {
    try {
      a.currentTime = target
    } catch {
      /* ignora */
    }
  }
  if (isPlaying.value) void a.play().catch(() => {})
}

watch(currentTime, (t) => {
  if (isPlaying.value && !timeline.isUserSeeking) return
  syncMasterVideo(t)
  syncAudioToPlayhead(t)
})

/* ------------------------------------------------------------------ */
/* Motor de reprodução (requestAnimationFrame)                        */
/* O playhead SEGUE o relógio do <video>; nunca o re-seekamos a cada  */
/* frame — é isso que elimina o travamento.                           */
/* ------------------------------------------------------------------ */
let raf = 0
let last = 0

function tick(now: number) {
  if (timeline.isUserSeeking) {
    raf = requestAnimationFrame(tick)
    return
  }
  const dt = (now - last) / 1000
  last = now
  const v = videoEl.value
  const clip = masterVideoClip.value
  const a = audioEl.value
  const audioClip = activeAudioClip.value
  const playingVideo = clip && v && v.readyState >= 2 && !v.paused
  const playingAudio =
    audioClip && a && audioSrc.value && a.readyState >= 2 && !a.paused

  if (playingVideo && v && clip) {
    const localEnd = clip.inPoint + clip.duration
    if (v.currentTime >= localEnd - 0.03) {
      timeline.setCurrentTime(clip.start + clip.duration + 0.001)
    } else {
      timeline.setCurrentTime(clip.start + (v.currentTime - clip.inPoint))
    }
  } else if (playingAudio && a && audioClip) {
    const localEnd = audioClip.inPoint + audioClip.duration
    if (a.currentTime >= localEnd - 0.03) {
      timeline.setCurrentTime(audioClip.start + audioClip.duration + 0.001)
    } else {
      timeline.setCurrentTime(audioClip.start + (a.currentTime - audioClip.inPoint))
    }
  } else {
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
  syncMasterVideo(currentTime.value)

  const a = audioEl.value
  const audioClip = activeAudioClip.value
  if (a && audioClip && audioSrc.value) {
    applyAudioOutput()
    const target = localOffset(audioClip, currentTime.value)
    if (Math.abs(a.currentTime - target) > 0.06) {
      try {
        a.currentTime = target
      } catch {
        /* ignora */
      }
    }
    void a.play().catch(() => {})
  }

  last = performance.now()
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
}

function stopPlayback() {
  cancelAnimationFrame(raf)
  raf = 0
  videoEl.value?.pause()
  audioEl.value?.pause()
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
        <!-- Áudio das trilhas de som (clipes só-áudio) -->
        <audio
          ref="audioEl"
          class="hidden-audio"
          :src="audioSrc"
          preload="auto"
          @canplay="onAudioCanPlay"
          @loadeddata="onAudioCanPlay"
        />

        <div class="frame">
          <PreviewLayer
            v-for="clip in stackedVisuals"
            :key="clip.id"
            :clip="clip"
            :current-time="currentTime"
            :is-playing="isPlaying"
            :should-sync-video="shouldSyncVideo"
            :is-master="clip.id === masterVideoClip?.id"
            :track-muted="trackOf(clip)?.muted ?? false"
            :volume="clip.volume"
            :proj-w="projW"
            :proj-h="projH"
            @master-video="onMasterVideo"
          />

          <div v-if="!activeVisuals.length" class="frame-empty">
            <BaseIcon name="film" :size="26" :stroke-width="1.3" />
            <span>Sem mídia no playhead</span>
          </div>
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
}
.frame-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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
.hidden-audio {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
