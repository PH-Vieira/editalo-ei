<script setup lang="ts">
import { storeToRefs } from 'pinia'
import TopBar from '@/modules/topbar/TopBar.vue'
import MediaLibrary from '@/modules/media-library/MediaLibrary.vue'
import PreviewPanel from '@/modules/preview/PreviewPanel.vue'
import InspectorPanel from '@/modules/inspector/InspectorPanel.vue'
import TimelinePanel from '@/modules/timeline/TimelinePanel.vue'
import StatusBar from '@/modules/statusbar/StatusBar.vue'
import ToastStack from '@/components/ui/ToastStack.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { sidebarVisible, inspectorVisible } = storeToRefs(ui)
</script>

<template>
  <div class="editor">
    <TopBar />

    <div class="middle">
      <Transition name="panel-slide">
        <aside v-if="sidebarVisible" class="region sidebar"><MediaLibrary /></aside>
      </Transition>

      <main class="region center"><PreviewPanel /></main>

      <Transition name="panel-slide">
        <aside v-if="inspectorVisible" class="region inspector"><InspectorPanel /></aside>
      </Transition>
    </div>

    <section class="region timeline-region"><TimelinePanel /></section>

    <StatusBar />
    <ToastStack />
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-0);
}
.middle {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  gap: 1px;
  background: var(--bg-0);
  padding: 1px;
}
.region {
  background: var(--bg-2);
  min-height: 0;
  overflow: hidden;
}
.sidebar {
  flex: 0 0 var(--sidebar-w);
  border-radius: var(--r-md);
}
.center {
  flex: 1 1 auto;
  border-radius: var(--r-md);
  background: var(--bg-1);
}
.inspector {
  flex: 0 0 var(--inspector-w);
  border-radius: var(--r-md);
}
.timeline-region {
  flex: 0 0 clamp(240px, 36vh, 420px);
  border-top: 1px solid var(--border);
  background: var(--bg-1);
}
</style>
