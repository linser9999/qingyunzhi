<script setup>
import { onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  icon: { type: String, default: '' },
  lg: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="modal-mask" @click.self="emit('close')">
      <div class="modal-body pop-in" :class="{ lg }">
        <div class="modal-head">
          <h3><span>{{ icon }}</span>{{ title }}</h3>
          <button class="modal-close" @click="emit('close')">✕</button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
