<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  color: { type: String, default: '' }, // green | gold | pink | red | blue
  showText: { type: Boolean, default: false },
  height: { type: Number, default: 10 }
})
const clamped = computed(() => Math.max(0, Math.min(100, Number(props.value) || 0)))
</script>

<template>
  <div class="q-progress" :class="color ? `p-${color}` : ''" :style="{ height: height + 'px' }">
    <div class="bar bar-shine" :style="{ width: clamped + '%' }" />
  </div>
</template>
