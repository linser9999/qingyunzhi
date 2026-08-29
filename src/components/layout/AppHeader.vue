<script setup>
import { useRoute } from 'vue-router'
import { useDataStore } from '../../stores/dataStore.js'
import { todayStr, weekdayCn } from '../../utils/date.js'

const route = useRoute()
const data = useDataStore()
</script>

<template>
  <header class="app-header-bar">
    <div class="h-title">
      <span>{{ route.meta.icon }}</span>
      <span>{{ route.meta.title }}</span>
    </div>
    <div class="h-right">
      <span class="h-date muted small desktop-only">{{ todayStr() }} · {{ weekdayCn(todayStr()) }}</span>
      <span v-if="!data.connected" class="q-tag t-gray">本地模式</span>
      <span v-else-if="data.sync === 'saved'" class="q-tag t-green">已同步</span>
      <span v-else-if="data.sync === 'saving'" class="q-tag t-gold">同步中…</span>
      <span v-else-if="data.sync === 'error'" class="q-tag t-red">同步异常</span>
    </div>
  </header>
</template>

<style scoped>
.h-date { white-space: nowrap; }
</style>
