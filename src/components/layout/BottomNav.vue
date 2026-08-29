<script setup>
const items = [
  { path: '/dashboard', icon: '🏮', label: '首页' },
  { path: '/goals', icon: '🎯', label: '目标' },
  { path: '/daily', icon: '✍️', label: '记录' },
  { path: '/finance', icon: '💰', label: '财务' },
  { path: '/settings', icon: '⚙️', label: '我的' }
]
</script>

<template>
  <nav class="bottom-nav">
    <router-link v-for="it in items" :key="it.path" :to="it.path">
      <span class="bn-icon">{{ it.icon }}</span>
      <span>{{ it.label }}</span>
    </router-link>
  </nav>
</template>
