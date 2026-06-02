<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import IconButton from '@/components/ui/IconButton.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import ExportModal from '@/components/ui/ExportModal.vue'
import { useProjectStore } from '@/stores/project'
import { useTimelineStore } from '@/stores/timeline'
import { useUiStore } from '@/stores/ui'
import {
  exportVideo,
  pickExportPath,
  onExportProgress,
  isTauri,
  type ExportFormat,
  type ExportSegment,
} from '@/tauri/commands'

const project = useProjectStore()
const timeline = useTimelineStore()
const ui = useUiStore()
const { project: proj } = storeToRefs(project)
const { isImporting } = storeToRefs(ui)

/* ---- Modal de exportação ---- */
const showExportModal = ref(false)
const exportFormat = ref<ExportFormat>('mp4')

function openExportModal() {
  const segments = buildSegments()
  if (isTauri() && segments.length === 0) {
    ui.notify('Importe vídeos reais e adicione-os à timeline para exportar', 'warning')
    return
  }
  showExportModal.value = true
}

async function confirmExport() {
  showExportModal.value = false
  const format = exportFormat.value
  const ext = format  // 'mp4' | 'mp3' | 'gif'
  const out = await pickExportPath(`${proj.value.name}.${ext}`, format)
  if (!out) return

  ui.setRenderStatus('exporting', 0)
  const label = { mp4: 'vídeo', mp3: 'áudio', gif: 'GIF' }[format]
  ui.notify(`Exportando ${label}…`, 'info')

  const stop = await onExportProgress((p) => {
    ui.setRenderStatus(p.done ? 'ready' : 'exporting', Math.round(p.progress * 100))
  })

  try {
    await exportVideo({
      segments: buildSegments(),
      outputPath: out,
      width: proj.value.width,
      height: proj.value.height,
      fps: proj.value.fps,
      format,
    })
    ui.setRenderStatus('ready', 100)
    ui.notify(`Exportação concluída (.${ext}) 🎬`, 'success')
  } catch (e) {
    ui.setRenderStatus('error', 0)
    ui.notify(`Falha na exportação: ${String(e).slice(0, 120)}`, 'danger')
  } finally {
    stop()
    setTimeout(() => ui.setRenderStatus('ready', 0), 600)
  }
}

/** Monta os segmentos (trim) dos clipes de vídeo, em ordem de tempo. */
function buildSegments(): ExportSegment[] {
  return timeline.clips
    .filter((c) => c.kind === 'video')
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((c) => {
      const asset = project.assets.find((a) => a.id === c.assetId)
      return asset?.src ? { path: asset.src, inPoint: c.inPoint, duration: c.duration } : null
    })
    .filter((s): s is ExportSegment => s !== null)
}
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="mark" aria-hidden="true">
        <BaseIcon name="film" :size="17" :stroke-width="1.7" />
      </div>
      <div class="title">
        <span class="name">Editá-lo-ei</span>
        <span class="tag">studio</span>
      </div>
    </div>

    <div class="divider" />

    <nav class="actions" aria-label="Ações do projeto">
      <IconButton icon="plus" label="Novo projeto (Ctrl+N)" @click="project.newProject()">
        <span class="btn-text">Novo</span>
      </IconButton>
      <IconButton
        icon="import"
        label="Importar mídia"
        :disabled="isImporting"
        @click="project.importMedia()"
      >
        <span class="btn-text">{{ isImporting ? 'Importando…' : 'Importar' }}</span>
      </IconButton>
      <IconButton icon="save" label="Salvar projeto (Ctrl+S)" @click="project.save()">
        <span class="btn-text">Salvar</span>
      </IconButton>
    </nav>

    <div class="project-chip" title="Clique no nome para editar">
      <input
        class="chip-name"
        :value="proj.name"
        aria-label="Nome do projeto"
        spellcheck="false"
        @change="project.renameProject(($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @keydown.escape.prevent="($event.target as HTMLInputElement).value = proj.name; ($event.target as HTMLInputElement).blur()"
        @focus="($event.target as HTMLInputElement).select()"
      />
      <span class="chip-meta mono">{{ proj.width }}×{{ proj.height }} · {{ proj.fps }}fps</span>
    </div>

    <div class="spacer" />

    <div class="right">
      <IconButton
        icon="layers"
        label="Alternar biblioteca"
        :active="ui.sidebarVisible"
        @click="ui.toggleSidebar()"
      />
      <IconButton
        icon="sliders"
        label="Alternar inspetor"
        :active="ui.inspectorVisible"
        @click="ui.toggleInspector()"
      />
      <button class="export-btn" type="button" @click="openExportModal">
        <BaseIcon name="export" :size="15" />
        <span>Exportar</span>
        <kbd>{{ timeline.contentEnd.toFixed(0) }}s</kbd>
      </button>
    </div>
  </header>

  <ExportModal
    v-if="showExportModal"
    v-model="exportFormat"
    @confirm="confirmExport"
    @cancel="showExportModal = false"
  />
</template>

<style scoped>
.topbar {
  flex: 0 0 var(--topbar-h);
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 0 var(--sp-3);
  background: var(--bg-0);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding-left: var(--sp-1);
}
.mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-sm);
  color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent-soft-strong);
}
.title {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}
.name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--fs-lg);
  letter-spacing: -0.02em;
}
.tag {
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-lo);
}
.divider {
  width: 1px;
  height: 24px;
  background: var(--border);
}
.actions {
  display: flex;
  gap: 2px;
}
.btn-text {
  font-size: var(--fs-sm);
  font-weight: 500;
}
.project-chip {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4px var(--sp-3);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
  line-height: 1.2;
  max-width: 230px;
}
.chip-name {
  width: 100%;
  font-family: var(--font-ui);
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-hi);
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
  border-radius: var(--r-xs);
  transition: background var(--dur-fast), box-shadow var(--dur-fast);
}
.chip-name:hover {
  background: var(--bg-inset);
}
.chip-name:focus {
  background: var(--bg-inset);
  box-shadow: 0 0 0 1.5px var(--accent-ring);
  text-overflow: clip;
  user-select: text;
}
.chip-meta {
  font-size: var(--fs-2xs);
  color: var(--text-lo);
}
.spacer {
  flex: 1;
}
.right {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.export-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  height: 32px;
  padding: 0 var(--sp-2) 0 var(--sp-3);
  border-radius: var(--r-sm);
  background: var(--accent);
  color: var(--text-on-accent);
  font-weight: 600;
  font-size: var(--fs-sm);
  transition:
    background var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}
.export-btn:hover {
  background: var(--accent-hover);
}
.export-btn:active {
  transform: scale(0.97);
}
.export-btn kbd {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: var(--r-xs);
  background: rgba(0, 0, 0, 0.22);
}
</style>
