<script setup>
defineProps({
  text: { type: String, default: '' },
  color: { type: String, default: 'cyan' }, // cyan pink gold green blue purple gray red
  clickable: { type: Boolean, default: false }
})
</script>

<template>
  <span class="q-tag" :class="`t-${color}`" :class="{ clickable }">
    <slot>{{ text }}</slot>
  </span>
</template>
