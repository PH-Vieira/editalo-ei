<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import BaseIcon from './BaseIcon.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { unsavedDialog } = storeToRefs(ui)

function onKey(e: KeyboardEvent) {
  if (!unsavedDialog.value) return
  if (e.key === 'Escape') ui.resolveUnsaved('cancel')
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="unsavedDialog" class="backdrop" @click.self="ui.resolveUnsaved('cancel')">
      <div class="modal" role="alertdialog" aria-modal="true" :aria-labelledby="'unsaved-title'">
        <header class="modal-head">
          <div class="head-icon" aria-hidden="true">
            <BaseIcon name="save" :size="17" />
          </div>
          <div>
            <h2 id="unsaved-title" class="title">{{ unsavedDialog.title }}</h2>
            <p class="subtitle">{{ unsavedDialog.message }}</p>
          </div>
        </header>

        <footer class="modal-foot">
          <button type="button" class="btn ghost" @click="ui.resolveUnsaved('cancel')">
            Cancelar
          </button>
          <button type="button" class="btn danger" @click="ui.resolveUnsaved('discard')">
            Não salvar
          </button>
          <button type="button" class="btn primary" @click="ui.resolveUnsaved('save')">
            Salvar
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-popover) + 10);
  display: grid;
  place-items: center;
  padding: var(--sp-4);
  background: rgba(0, 0, 0, 0.62);
}
.modal {
  width: min(100%, 420px);
  padding: var(--sp-4);
  border-radius: var(--r-lg);
  background: var(--bg-2);
  box-shadow: var(--shadow-pop);
  outline: 1px solid var(--border-strong);
}
.modal-head {
  display: flex;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}
.head-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--r-md);
  color: var(--warning);
  background: rgba(242, 176, 61, 0.12);
  flex: none;
}
.title {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--text-hi);
}
.subtitle {
  margin-top: var(--sp-1);
  font-size: var(--fs-sm);
  color: var(--text-mid);
  line-height: 1.45;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
}
.btn {
  height: 34px;
  padding: 0 var(--sp-3);
  border-radius: var(--r-sm);
  font-size: var(--fs-sm);
  font-weight: 500;
  transition: background var(--dur-fast);
}
.btn.ghost {
  color: var(--text-mid);
}
.btn.ghost:hover {
  background: var(--bg-4);
  color: var(--text-hi);
}
.btn.danger {
  color: var(--danger);
  background: var(--danger-soft);
}
.btn.danger:hover {
  background: rgba(229, 72, 77, 0.22);
}
.btn.primary {
  color: var(--text-on-accent);
  background: var(--accent);
  font-weight: 600;
}
.btn.primary:hover {
  background: var(--accent-hover);
}
</style>
