<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import ToolbarMenu from './ToolbarMenu.vue'
import { useProjectStore } from '@/stores/project'
import { getRecentProjects, removeRecentProject } from '@/utils/recentProjects'
import { basename } from '@/utils/format'

const project = useProjectStore()
const { isSaving, saveMenuHint, filePath } = storeToRefs(project)
const recent = ref(getRecentProjects())

function refreshRecent() {
  recent.value = getRecentProjects()
}

async function onNew() {
  await project.requestNewProject()
}

async function onOpen() {
  await project.open()
  refreshRecent()
}

async function onSave() {
  await project.save()
}

async function onSaveAs() {
  await project.saveAs()
  refreshRecent()
}

async function onOpenRecent(path: string) {
  const ok = await project.openPath(path)
  if (!ok) removeRecentProject(path)
  refreshRecent()
}
</script>

<template>
  <ToolbarMenu label="Arquivo" menu-id="file" @open="refreshRecent">
    <button type="button" class="menu-item" role="menuitem" @click="onNew">
      <BaseIcon name="plus" :size="15" />
      <span class="item-label">Novo projeto</span>
      <kbd>Ctrl+N</kbd>
    </button>
    <button type="button" class="menu-item" role="menuitem" @click="onOpen">
      <BaseIcon name="folder" :size="15" />
      <span class="item-label">Abrir projeto…</span>
      <kbd>Ctrl+O</kbd>
    </button>

    <template v-if="recent.length">
      <div class="menu-divider" role="separator" />
      <p class="menu-section-label">Recentes</p>
      <button
        v-for="item in recent"
        :key="item.path"
        type="button"
        class="menu-item"
        role="menuitem"
        :title="item.path"
        @click="onOpenRecent(item.path)"
      >
        <BaseIcon name="film" :size="15" />
        <span class="item-col">
          <span class="item-label">{{ item.name }}</span>
          <span class="item-sub">{{ basename(item.path) }}</span>
        </span>
      </button>
    </template>

    <div class="menu-divider" role="separator" />

    <button
      type="button"
      class="menu-item"
      role="menuitem"
      :disabled="isSaving"
      :title="saveMenuHint"
      @click="onSave"
    >
      <BaseIcon name="save" :size="15" />
      <span class="item-label">Salvar projeto</span>
      <kbd>Ctrl+S</kbd>
    </button>
    <button
      type="button"
      class="menu-item"
      role="menuitem"
      :disabled="isSaving"
      :title="filePath ? 'Escolher outro caminho' : 'Salvar em .elei'"
      @click="onSaveAs"
    >
      <BaseIcon name="save" :size="15" />
      <span class="item-label">Salvar como…</span>
      <kbd>Ctrl+⇧+S</kbd>
    </button>
  </ToolbarMenu>
</template>
