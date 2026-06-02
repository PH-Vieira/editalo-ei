<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, type CSSProperties } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { useProjectStore } from '@/stores/project'
import { resolveMediaSrc } from '@/utils/mediaSrcCache'
import { kindLabel } from '@/utils/format'
import type { Clip } from '@/types'

const props = defineProps<{
  clip: Clip
  currentTime: number
  isPlaying: boolean
  /** Pausado ou scrub manual — força seek nos vídeos. */
  shouldSyncVideo: boolean
  isMaster: boolean
  trackMuted: boolean
  volume: number
  projW: number
  projH: number
}>()

const emit = defineEmits<{
  'master-video': [el: HTMLVideoElement | null]
}>()

const project = useProjectStore()
const mediaSrc = ref<string>()
const mediaKind = ref<'video' | 'image' | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)

const layerStyle = computed((): CSSProperties => ({
  opacity: props.clip.opacity,
  transform: [
    `translate(${(props.clip.x / props.projW) * 100}%, ${(props.clip.y / props.projH) * 100}%)`,
    `scale(${props.clip.scale / 100})`,
    `rotate(${props.clip.rotation}deg)`,
  ].join(' '),
  transformOrigin: 'center center',
}))

const videoMuted = computed(() => !props.isMaster || props.trackMuted)

function applyVideoOutput() {
  const v = videoEl.value
  if (!v || mediaKind.value !== 'video') return
  v.muted = videoMuted.value
  v.volume = props.isMaster ? Math.min(1, Math.max(0, props.volume)) : 0
}

function localOffset(t: number): number {
  return Math.max(0, props.clip.inPoint + (t - props.clip.start))
}

async function loadMedia() {
  const asset = props.clip.assetId
    ? project.assets.find((a) => a.id === props.clip.assetId)
    : null
  if (asset?.src && (props.clip.kind === 'video' || props.clip.kind === 'image')) {
    mediaSrc.value = await resolveMediaSrc(asset.src)
    mediaKind.value = props.clip.kind
  } else {
    mediaSrc.value = undefined
    mediaKind.value = null
  }
}

function syncVideo() {
  const v = videoEl.value
  if (!v || mediaKind.value !== 'video') return
  const target = localOffset(props.currentTime)
  if (Number.isFinite(target) && Math.abs(v.currentTime - target) > 0.04) {
    try {
      v.currentTime = target
    } catch {
      /* mídia ainda carregando */
    }
  }
}

function onCanPlay() {
  applyVideoOutput()
  syncVideo()
  if (props.isPlaying) videoEl.value?.play().catch(() => {})
}

function setMasterRef(el: HTMLVideoElement | null) {
  if (props.isMaster) emit('master-video', el)
}

watch(
  () => [props.clip.assetId, props.clip.kind] as const,
  () => loadMedia(),
  { immediate: true },
)

watch(
  () => props.currentTime,
  () => {
    if (props.shouldSyncVideo || !props.isMaster) syncVideo()
  },
)

watch(
  () => props.isPlaying,
  (playing) => {
    const v = videoEl.value
    if (!v || mediaKind.value !== 'video') return
    if (playing) {
      if (!props.isMaster) syncVideo()
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  },
)

watch(
  () => [props.trackMuted, props.volume, props.isMaster] as const,
  () => applyVideoOutput(),
)

watch(videoEl, (el) => {
  applyVideoOutput()
  setMasterRef(el)
})

watch(
  () => props.isMaster,
  () => setMasterRef(videoEl.value),
)

onBeforeUnmount(() => setMasterRef(null))
</script>

<template>
  <div class="layer" :style="layerStyle">
    <video
      v-show="mediaKind === 'video' && mediaSrc"
      ref="videoEl"
      class="media"
      :src="mediaSrc"
      :muted="videoMuted"
      playsinline
      preload="auto"
      @canplay="onCanPlay"
      @loadeddata="onCanPlay"
    />
    <img v-if="mediaKind === 'image' && mediaSrc" class="media" :src="mediaSrc" alt="" />

    <template v-if="!mediaSrc">
      <div class="frame-fill" :style="{ background: clip.color }" />
      <div class="frame-grad" />
      <div class="frame-info">
        <span class="frame-kind">
          <BaseIcon
            :name="clip.kind === 'image' ? 'image' : clip.kind === 'text' ? 'text' : 'video'"
            :size="13"
          />
          {{ kindLabel(clip.kind) }}
        </span>
        <span class="frame-name">{{ clip.name }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.layer {
  position: absolute;
  inset: 0;
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
  letter-spacing: var(--tracking-display);
}
</style>
