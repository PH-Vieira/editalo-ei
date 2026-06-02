<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import BaseIcon from './BaseIcon.vue'
import type { ExportFormat } from '@/tauri/commands'

defineProps<{ modelValue: ExportFormat }>()
const emit = defineEmits<{
  'update:modelValue': [f: ExportFormat]
  confirm: []
  cancel: []
}>()

const formats: {
  id: ExportFormat
  label: string
  icon: string
  desc: string
  detail: string
  badge?: string
}[] = [
  {
    id: 'mp4',
    label: 'MP4',
    icon: 'video',
    desc: 'Vídeo + áudio',
    detail: 'H.264 · AAC · Alta qualidade',
  },
  {
    id: 'mp3',
    label: 'MP3',
    icon: 'audio',
    desc: 'Só áudio',
    detail: 'MPEG-3 · 192 kbps · Stereo',
  },
  {
    id: 'gif',
    label: 'GIF',
    icon: 'image',
    desc: 'Animação',
    detail: '12 fps · 640 px · Sem áudio',
    badge: 'Ótimo para preview',
  },
]

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('cancel')
  if (e.key === 'Enter') emit('confirm')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('cancel')">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Opções de exportação">

        <header class="modal-head">
          <div class="head-icon" aria-hidden="true">
            <BaseIcon name="export" :size="17" />
          </div>
          <div>
            <h2 class="modal-title">Exportar projeto</h2>
            <p class="modal-sub">Escolha o formato de saída</p>
          </div>
        </header>

        <div class="formats" role="radiogroup" aria-label="Formato de exportação">
          <button
            v-for="f in formats"
            :key="f.id"
            class="fmt"
            :class="{ selected: modelValue === f.id }"
            :aria-checked="modelValue === f.id"
            role="radio"
            type="button"
            @click="emit('update:modelValue', f.id)"
          >
            <div class="fmt-icon">
              <BaseIcon :name="f.icon" :size="20" :stroke-width="1.5" />
            </div>
            <div class="fmt-label">{{ f.label }}</div>
            <div class="fmt-desc">{{ f.desc }}</div>
            <div class="fmt-detail mono">{{ f.detail }}</div>
            <span v-if="f.badge" class="fmt-badge">{{ f.badge }}</span>
            <span v-if="modelValue === f.id" class="fmt-check" aria-hidden="true">
              <BaseIcon name="check" :size="13" />
            </span>
          </button>
        </div>

        <footer class="modal-foot">
          <button class="btn-cancel" type="button" @click="emit('cancel')">Cancelar</button>
          <button class="btn-confirm" type="button" @click="emit('confirm')">
            <BaseIcon name="export" :size="15" />
            Exportar como .{{ modelValue }}
          </button>
        </footer>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ---- Backdrop ---- */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-popover);
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: var(--sp-5);
  animation: fade-in var(--dur-med) var(--ease-out) both;
}
@keyframes fade-in {
  from { opacity: 0; }
}

/* ---- Modal card ---- */
.modal {
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-pop), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  width: 100%;
  max-width: 540px;
  animation: slide-up var(--dur-med) var(--ease-out) both;
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
}

/* ---- Header ---- */
.modal-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
  border-bottom: 1px solid var(--border-subtle);
}
.head-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--r-md);
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent-soft-strong);
  flex: none;
}
.modal-title {
  font-family: var(--font-display);
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--text-hi);
  letter-spacing: -0.01em;
}
.modal-sub {
  font-size: var(--fs-xs);
  color: var(--text-lo);
  margin-top: 2px;
}

/* ---- Format cards ---- */
.formats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5);
}
.fmt {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: var(--sp-4) var(--sp-2) var(--sp-3);
  border-radius: var(--r-lg);
  border: 1.5px solid var(--border);
  background: var(--bg-3);
  text-align: center;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}
.fmt:hover {
  border-color: var(--border-strong);
  background: var(--bg-4);
}
.fmt:active {
  transform: scale(0.97);
}
.fmt.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent-soft-strong);
}
.fmt-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r-md);
  background: var(--bg-inset);
  color: var(--text-mid);
  margin-bottom: 4px;
  transition: color var(--dur-fast), background var(--dur-fast);
  box-shadow: var(--shadow-inset);
}
.fmt.selected .fmt-icon {
  background: var(--accent-soft-strong);
  color: var(--accent);
}
.fmt-label {
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--text-hi);
  letter-spacing: -0.01em;
}
.fmt-desc {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-mid);
}
.fmt-detail {
  font-size: var(--fs-2xs);
  color: var(--text-lo);
  line-height: 1.4;
}
.fmt-badge {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: var(--r-full);
  background: rgba(245, 165, 36, 0.12);
  color: var(--accent);
  border: 1px solid rgba(245, 165, 36, 0.22);
  margin-top: 2px;
}
.fmt-check {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: var(--r-full);
  background: var(--accent);
  color: var(--text-on-accent);
}

/* ---- Footer ---- */
.modal-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-5) var(--sp-5);
  border-top: 1px solid var(--border-subtle);
}
.btn-cancel {
  padding: 9px var(--sp-4);
  border-radius: var(--r-sm);
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-mid);
  background: var(--bg-3);
  border: 1px solid var(--border);
  transition: all var(--dur-fast);
}
.btn-cancel:hover {
  color: var(--text-hi);
  background: var(--bg-4);
}
.btn-confirm {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 9px var(--sp-4);
  border-radius: var(--r-sm);
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text-on-accent);
  background: var(--accent);
  transition: all var(--dur-fast);
}
.btn-confirm:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(245, 165, 36, 0.3);
}
.btn-confirm:active {
  transform: scale(0.97);
}
</style>
