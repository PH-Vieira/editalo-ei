<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NumberField from '@/components/ui/NumberField.vue'
import PropertyGroup from './PropertyGroup.vue'
import { useTimelineStore } from '@/stores/timeline'
import { kindLabel } from '@/utils/format'
import { toTimecode } from '@/utils/time'
import { useProjectStore } from '@/stores/project'
import type { Clip } from '@/types'

const timeline = useTimelineStore()
const project = useProjectStore()
const { selectedClip } = storeToRefs(timeline)

type Tab = 'transform' | 'timing' | 'audio' | 'effects'
const tab = ref<Tab>('transform')
const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'transform', label: 'Transform', icon: 'sliders' },
  { key: 'timing', label: 'Timing', icon: 'clock' },
  { key: 'audio', label: 'Audio', icon: 'audio' },
  { key: 'effects', label: 'Effects', icon: 'wand' },
]

/** Cria um v-model que escreve no clipe selecionado via store. */
function field<K extends keyof Clip>(key: K) {
  return computed({
    get: () => (selectedClip.value ? (selectedClip.value[key] as number) : 0),
    set: (v: number) => {
      if (selectedClip.value) timeline.updateClip(selectedClip.value.id, { [key]: v } as Partial<Clip>)
    },
  })
}

const x = field('x')
const y = field('y')
const scale = field('scale')
const rotation = field('rotation')
const opacity = computed({
  get: () => (selectedClip.value ? Math.round(selectedClip.value.opacity * 100) : 100),
  set: (v: number) => selectedClip.value && timeline.updateClip(selectedClip.value.id, { opacity: v / 100 }),
})
const volume = computed({
  get: () => (selectedClip.value ? Math.round(selectedClip.value.volume * 100) : 100),
  set: (v: number) => selectedClip.value && timeline.updateClip(selectedClip.value.id, { volume: v / 100 }),
})
const start = field('start')
const duration = field('duration')

const fps = computed(() => project.project.fps)
const hasAudio = computed(() => selectedClip.value?.kind === 'video' || selectedClip.value?.kind === 'audio')
</script>

<template>
  <div class="inspector">
    <header class="insp-head">
      <h2 class="section-title">Inspetor</h2>
    </header>

    <template v-if="selectedClip">
      <div class="ident">
        <span class="swatch" :style="{ background: selectedClip.color }" />
        <div class="ident-text">
          <input
            class="clip-name"
            :value="selectedClip.name"
            aria-label="Nome do clipe"
            @change="timeline.updateClip(selectedClip.id, { name: ($event.target as HTMLInputElement).value })"
          />
          <span class="clip-kind">{{ kindLabel(selectedClip.kind) }}</span>
        </div>
      </div>

      <nav class="tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ on: tab === t.key }"
          role="tab"
          :aria-selected="tab === t.key"
          @click="tab = t.key"
        >
          <BaseIcon :name="t.icon" :size="14" />
          <span>{{ t.label }}</span>
        </button>
      </nav>

      <div class="scroll">
        <template v-if="tab === 'transform'">
          <PropertyGroup title="Posição" icon="sliders">
            <div class="row-2">
              <NumberField v-model="x" label="X" suffix="px" :step="1" />
              <NumberField v-model="y" label="Y" suffix="px" :step="1" />
            </div>
          </PropertyGroup>
          <PropertyGroup title="Dimensão" icon="resolution">
            <NumberField v-model="scale" label="Escala" suffix="%" :min="1" :max="400" :step="1" />
            <NumberField v-model="rotation" label="Rotação" suffix="°" :min="-180" :max="180" :step="1" />
            <NumberField v-model="opacity" label="Opacidade" suffix="%" :min="0" :max="100" :step="1" />
          </PropertyGroup>
        </template>

        <template v-else-if="tab === 'timing'">
          <PropertyGroup title="Posição na timeline" icon="clock">
            <NumberField v-model="start" label="Início" suffix="s" :min="0" :step="0.1" :precision="2" />
            <NumberField v-model="duration" label="Duração" suffix="s" :min="0.1" :step="0.1" :precision="2" />
            <div class="readout">
              <span class="ro-label">Fim</span>
              <span class="ro-val mono">{{ toTimecode(start + duration, fps) }}</span>
            </div>
          </PropertyGroup>
        </template>

        <template v-else-if="tab === 'audio'">
          <PropertyGroup v-if="hasAudio" title="Áudio" icon="audio">
            <NumberField v-model="volume" label="Volume" suffix="%" :min="0" :max="200" :step="1" />
            <div class="meter">
              <div class="meter-fill" :style="{ width: `${Math.min(100, volume / 2)}%` }" />
            </div>
          </PropertyGroup>
          <EmptyState v-else icon="mute" title="Sem áudio" hint="Este item não possui faixa de áudio." />
        </template>

        <template v-else>
          <PropertyGroup title="Efeitos" icon="wand">
            <div class="fx-empty">
              <p>Nenhum efeito aplicado.</p>
              <button class="fx-add" type="button">
                <BaseIcon name="plus" :size="13" /> Adicionar efeito
              </button>
            </div>
          </PropertyGroup>
        </template>
      </div>
    </template>

    <EmptyState
      v-else
      icon="sliders"
      title="Nada selecionado"
      hint="Selecione um clipe na timeline para editar suas propriedades."
    />
  </div>
</template>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.insp-head {
  padding: var(--sp-3) var(--sp-3) var(--sp-2);
}
.section-title {
  font-size: var(--fs-sm);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-mid);
}
.ident {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0 var(--sp-3) var(--sp-3);
}
.swatch {
  width: 4px;
  align-self: stretch;
  min-height: 34px;
  border-radius: var(--r-full);
}
.ident-text {
  min-width: 0;
  flex: 1;
}
.clip-name {
  width: 100%;
  background: none;
  border: none;
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--text-hi);
  letter-spacing: var(--tracking-display);
  border-radius: var(--r-xs);
}
.clip-name:hover {
  background: var(--bg-inset);
}
.clip-kind {
  font-size: var(--fs-2xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-lo);
}
.tabs {
  display: flex;
  gap: 2px;
  margin: 0 var(--sp-3);
  padding: 3px;
  border-radius: var(--r-sm);
  background: var(--bg-inset);
}
.tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 4px;
  border-radius: var(--r-xs);
  font-size: var(--fs-xs);
  color: var(--text-mid);
  transition: all var(--dur-fast) var(--ease-out);
}
.tab span {
  display: none;
}
.tab.on {
  background: var(--bg-3);
  color: var(--text-hi);
  box-shadow: var(--shadow-sm);
}
.tab.on span {
  display: inline;
}
.tab:hover:not(.on) {
  color: var(--text-hi);
}
.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-top: var(--sp-2);
}
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
}
.readout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  padding: 0 var(--sp-3);
  border-radius: var(--r-sm);
  background: var(--bg-inset);
}
.ro-label {
  font-size: var(--fs-xs);
  color: var(--text-lo);
}
.ro-val {
  font-size: var(--fs-sm);
  color: var(--text-hi);
}
.meter {
  height: 6px;
  border-radius: var(--r-full);
  background: var(--bg-inset);
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--media-audio), var(--accent));
  transition: width var(--dur-fast) var(--ease-out);
}
.fx-empty {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--text-lo);
}
.fx-add {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  align-self: flex-start;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-sm);
  font-size: var(--fs-sm);
  color: var(--text-mid);
  background: var(--bg-3);
  transition: all var(--dur-fast);
}
.fx-add:hover {
  color: var(--text-hi);
  background: var(--bg-4);
}
</style>
