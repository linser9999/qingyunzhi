<script setup>
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  sub: { type: String, default: '' },
  icon: { type: String, default: '' },
  color: { type: String, default: '' } // css color for value
})
</script>

<template>
  <div class="stat-card">
    <span v-if="icon" class="s-ico">{{ icon }}</span>
    <div class="s-label">{{ label }}</div>
    <div class="s-value" :style="color ? { color } : {}">{{ value }}</div>
    <div v-if="sub" class="s-sub">{{ sub }}</div>
  </div>
</template>
