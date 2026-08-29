<script setup>
import { useDataStore } from '../../stores/dataStore.js'

const data = useDataStore()
const items = [
  { path: '/dashboard', icon: '🏮', label: '人生总览' },
  { path: '/goals', icon: '🎯', label: '目标管理' },
  { path: '/plans', icon: '📜', label: '计划制定' },
  { path: '/daily', icon: '✍️', label: '每日记录' },
  { path: '/finance', icon: '💰', label: '消费财务' },
  { path: '/books', icon: '📚', label: '读书清单' },
  { path: '/learnings', icon: '🎓', label: '学习记录' },
  { path: '/reviews', icon: '🧘', label: '复盘总结' },
  { path: '/roadmap', icon: '🗺️', label: '路线图' },
  { path: '/assets', icon: '🪙', label: '资产追踪' },
  { path: '/stats', icon: '📊', label: '数据统计' },
  { path: '/settings', icon: '⚙️', label: '设置' }
]
</script>

<template>
  <aside class="side-nav">
    <div class="brand">
      <img src="/favicon.svg" alt="青云志" class="floaty" />
      <div>
        <div class="name">青云志</div>
        <div class="sub">人生进度簿</div>
      </div>
    </div>
    <nav>
      <router-link v-for="it in items" :key="it.path" :to="it.path" class="nav-item">
        <span class="nav-icon">{{ it.icon }}</span>
        <span>{{ it.label }}</span>
      </router-link>
    </nav>
    <div class="nav-foot">追风赶月莫停留 · {{ data.user.name || '追梦人' }}</div>
  </aside>
</template>
