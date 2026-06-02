<script setup lang="ts">
import { provide, ref } from 'vue'
import EditorLayout from '@/layouts/EditorLayout.vue'
import UnsavedChangesModal from '@/components/ui/UnsavedChangesModal.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'

useKeyboardShortcuts()
useUnsavedGuard()

const openMenuId = ref<string | null>(null)
provide('toolbarOpenMenuId', openMenuId)
provide('toolbarSetOpenMenuId', (id: string | null) => {
  openMenuId.value = id
})
</script>

<template>
  <EditorLayout />
  <UnsavedChangesModal />
</template>
