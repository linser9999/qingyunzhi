/**
 * PWA 安装引导 composable
 * 监听 beforeinstallprompt 事件，提供安装功能
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

export function usePWAInstall() {
  const canInstall = ref(false)
  const isInstalled = ref(false)
  let deferredPrompt = null

  function onBeforeInstall(e) {
    e.preventDefault()
    deferredPrompt = e
    canInstall.value = true
  }

  function onAppInstalled() {
    isInstalled.value = true
    canInstall.value = false
    deferredPrompt = null
  }

  async function install() {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      isInstalled.value = true
      canInstall.value = false
    }
    deferredPrompt = null
    return outcome === 'accepted'
  }

  /** 检测是否已安装为 PWA（standalone 模式） */
  function checkInstalled() {
    isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
  }

  onMounted(() => {
    checkInstalled()
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    window.removeEventListener('appinstalled', onAppInstalled)
  })

  return { canInstall, isInstalled, install }
}
