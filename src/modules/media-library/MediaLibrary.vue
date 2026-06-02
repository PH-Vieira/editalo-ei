<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MediaItem from './MediaItem.vue'
import { useProjectStore, type MediaFilter } from '@/stores/project'
import { useTimelineStore } from '@/stores/timeline'
import { useUiStore } from '@/stores/ui'
import type { Asset } from '@/types'

const project = useProjectStore()
const timeline = useTimelineStore()
const ui = useUiStore()
const { filteredAssets, selectedAssetId, filter, search, assets } = storeToRefs(project)

const filters: { key: MediaFilter; icon: string; label: string }[] = [
  { key: 'all', icon: 'layers', label: 'Tudo' },
  { key: 'video', icon: 'video', label: 'Vídeos' },
  { key: 'audio', icon: 'audio', label: 'Áudios' },
  { key: 'image', icon: 'image', label: 'Imagens' },
  { key: 'text', icon: 'text', label: 'Textos' },
]

const dragOver = ref(false)

function onDrop(e: DragEvent) {
  dragOver.value = false
  // Em produção: ler e.dataTransfer.files e enviar ao backend Tauri.
  if (e.dataTransfer?.files?.length) project.importMedia()
}

function dragAsset(e: DragEvent, asset: Asset) {
  e.dataTransfer?.setData('application/x-asset-id', asset.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}
</script>

<template>
  <div class="library">
    <header class="lib-head">
      <h2 class="section-title">Biblioteca</h2>
      <span class="count mono">{{ assets.length }}</span>
    </header>

    <div class="search">
      <BaseIcon name="search" :size="14" />
      <input
        :value="search"
        type="text"
        placeholder="Buscar mídia…"
        aria-label="Buscar mídia"
        @input="project.setSearch(($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="filters" role="tablist" aria-label="Filtrar por tipo">
      <button
        v-for="f in filters"
        :key="f.key"
        class="chip"
        :class="{ on: filter === f.key }"
        role="tab"
        :aria-selected="filter === f.key"
        @click="project.setFilter(f.key)"
      >
        <BaseIcon :name="f.icon" :size="13" />
        <span>{{ f.label }}</span>
      </button>
    </div>

    <div
      class="list-wrap"
      :class="{ 'drag-over': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div v-if="ui.isImporting" class="skeletons">
        <div v-for="n in 3" :key="n" class="skeleton" />
      </div>

      <TransitionGroup v-else-if="filteredAssets.length" name="fade" tag="div" class="list">
        <MediaItem
          v-for="asset in filteredAssets"
          :key="asset.id"
          :asset="asset"
          :selected="asset.id === selectedAssetId"
          @select="project.selectAsset(asset.id)"
          @add="timeline.addClipFromAsset(asset)"
          @dragstart="dragAsset($event, asset)"
        />
      </TransitionGroup>

      <EmptyState
        v-else
        icon="folder"
        :title="search || filter !== 'all' ? 'Nada encontrado' : 'Biblioteca vazia'"
        :hint="
          search || filter !== 'all'
            ? 'Ajuste a busca ou o filtro de tipo.'
            : 'Arraste arquivos aqui ou use Importar para começar.'
        "
      >
        <button class="empty-cta" type="button" @click="project.importMedia()">
          <BaseIcon name="import" :size="14" />
          Importar mídia
        </button>
      </EmptyState>

      <div v-if="dragOver" class="drop-veil">
        <BaseIcon name="import" :size="22" />
        <span>Solte para importar</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.lib-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-3) var(--sp-2);
}
.section-title {
  font-size: var(--fs-sm);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-mid);
}
.count {
  font-size: var(--fs-2xs);
  color: var(--text-lo);
  padding: 1px 7px;
  border-radius: var(--r-full);
  background: var(--bg-inset);
}
.search {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0 var(--sp-3) var(--sp-2);
  padding: 0 var(--sp-2);
  height: 32px;
  border-radius: var(--r-sm);
  background: var(--bg-inset);
  color: var(--text-lo);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
  transition: box-shadow var(--dur-fast);
}
.search:focus-within {
  box-shadow: inset 0 0 0 1px var(--accent-ring);
}
.search input {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-hi);
  font-size: var(--fs-sm);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 var(--sp-3) var(--sp-3);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px var(--sp-2);
  border-radius: var(--r-full);
  font-size: var(--fs-xs);
  color: var(--text-mid);
  background: var(--bg-3);
  transition: all var(--dur-fast) var(--ease-out);
}
.chip:hover {
  color: var(--text-hi);
  background: var(--bg-4);
}
.chip.on {
  color: var(--text-on-accent);
  background: var(--accent);
  font-weight: 600;
}
.list-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--sp-3) var(--sp-3);
  border-radius: var(--r-md);
  transition: box-shadow var(--dur-fast);
}
.list-wrap.drag-over {
  box-shadow: inset 0 0 0 2px var(--accent-ring);
}
.list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.skeletons {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.skeleton {
  height: 52px;
  border-radius: var(--r-md);
  background: linear-gradient(100deg, var(--bg-3) 30%, var(--bg-4) 50%, var(--bg-3) 70%);
  background-size: 200% 100%;
  animation: shimmer 1.3s var(--ease-in-out) infinite;
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
.empty-cta {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-sm);
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-on-accent);
  background: var(--accent);
  transition: background var(--dur-fast);
}
.empty-cta:hover {
  background: var(--accent-hover);
}
.drop-veil {
  position: absolute;
  inset: var(--sp-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  border-radius: var(--r-md);
  background: rgba(11, 13, 16, 0.84);
  color: var(--accent);
  font-size: var(--fs-sm);
  pointer-events: none;
}
</style>
