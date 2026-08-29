<script setup>
import { computed } from 'vue'
import { useDataStore } from '../../stores/dataStore.js'
import { useUiStore } from '../../stores/uiStore.js'

const data = useDataStore()
const ui = useUiStore()

const info = computed(() => {
  if (!data.connected) return { text: '本地模式 · 未配置云同步', cls: 'local' }
  if (data.sync === 'saving') return { text: '正在同步到云端…', cls: 'syncing' }
  if (data.sync === 'error') return { text: '同步失败 · 点击重试', cls: 'err' }
  if (data.sync === 'saved') {
    const t = data.meta.syncedAt ? new Date(data.meta.syncedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
    return { text: `已同步${t ? ' ' + t : ''} · 点击立即保存`, cls: 'ok' }
  }
  return { text: '待同步 · 点击保存', cls: 'syncing' }
})

async function click() {
  if (!data.connected) {
    ui.toast('请先在「设置」中配置 GitHub 同步', 'warning')
    return
  }
  const res = await data.saveNow()
  if (res.ok) ui.toast(res.message, 'success')
  else ui.toast(res.message, 'error')
}
</script>

<template>
  <button v-if="!data.loading" class="sync-bar" :class="info.cls" @click="click">
    <span :class="{ spin: data.sync === 'saving' }">🪁</span>
    {{ info.text }}
  </button>
</template>

<style scoped>
.sync-bar.ok { background: rgba(111,154,92,.92); }
.sync-bar.err { background: rgba(192,85,63,.92); }
.sync-bar.local { background: rgba(154,143,127,.9); }
.sync-bar.syncing { background: rgba(91,140,133,.92); }
</style>
