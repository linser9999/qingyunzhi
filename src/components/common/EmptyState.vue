<script setup>
defineProps({
  emoji: { type: String, default: '🪁' },
  text: { type: String, default: '暂无数据' },
  sub: { type: String, default: '' }
})
</script>

<template>
  <div class="empty-state">
    <span class="emoji">{{ emoji }}</span>
    <p>{{ text }}</p>
    <p v-if="sub" class="small muted mt-8">{{ sub }}</p>
  </div>
</template>
