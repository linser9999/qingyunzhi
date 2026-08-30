<script setup>
import { onMounted } from 'vue'
import { useDataStore } from './stores/dataStore.js'
import { useUiStore } from './stores/uiStore.js'
import SideNav from './components/layout/SideNav.vue'
import BottomNav from './components/layout/BottomNav.vue'
import AppHeader from './components/layout/AppHeader.vue'
import CloudDeco from './components/layout/CloudDeco.vue'
import SyncBar from './components/common/SyncBar.vue'
import InAppReminder from './components/common/InAppReminder.vue'
import { initReminders, checkGoalsAndBudget } from './utils/reminders.js'

const data = useDataStore()
const ui = useUiStore()

onMounted(async () => {
  await data.init()
  initReminders()
  setTimeout(() => checkGoalsAndBudget(data.data), 4000)
})
</script>

<template>
  <div class="app-root">
    <CloudDeco />
    <div class="app-shell">
      <SideNav class="desktop-only" />
      <div class="app-main">
        <AppHeader class="app-header" />
        <main class="page-container">
          <div v-if="data.loading" class="page-loading">
            <span class="spin">🪁</span>
            <p>正在打开人生进度簿…</p>
          </div>
          <router-view v-else v-slot="{ Component }">
            <transition name="page" mode="out-in">
              <component :is="Component" :key="$route.path" />
            </transition>
          </router-view>
        </main>
      </div>
    </div>
    <BottomNav class="mobile-only" />
    <SyncBar />
    <InAppReminder />
    <div class="toast-wrap">
      <transition-group name="toast">
        <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="`toast-${t.type}`">{{ t.message }}</div>
      </transition-group>
    </div>
  </div>
</template>

<style>
.page-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; min-height: 50vh; color: var(--ink-3); font-size: 15px;
}
.page-loading .spin { font-size: 40px; display: inline-block; }

.toast-wrap {
  position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
  z-index: 200; display: flex; flex-direction: column; gap: 8px; align-items: center;
  width: min(92vw, 420px); pointer-events: none;
}
.toast {
  background: rgba(63,58,51,.92); color: #fdf6ec;
  padding: 9px 18px; border-radius: 999px; font-size: 13px;
  box-shadow: var(--shadow-float); text-align: center;
}
.toast-success { background: rgba(111,154,92,.95); }
.toast-error { background: rgba(192,85,63,.95); }
.toast-warning { background: rgba(217,146,46,.95); }
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from { opacity: 0; transform: translateY(-14px); }
.toast-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
