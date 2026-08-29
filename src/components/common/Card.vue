<script setup>
defineProps({
  title: { type: String, default: '' },
  icon: { type: String, default: '' }
})
</script>

<template>
  <section class="q-card">
    <h3 v-if="title" class="card-title"><span>{{ icon }}</span>{{ title }}</h3>
    <slot />
  </section>
</template>
