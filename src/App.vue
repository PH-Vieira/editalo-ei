<script setup lang="ts">
import EditorLayout from '@/layouts/EditorLayout.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

// A reprodução é dirigida pelo PreviewPanel (que possui o elemento <video>).
useKeyboardShortcuts()
</script>

<template>
  <EditorLayout />
</template>
