import { createRouter, createWebHashHistory } from 'vue-router'

// 使用 hash 模式：GitHub Pages 无需服务器重写即可访问任意路由
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { title: '人生进度总览', icon: '🏮' }
    },
    {
      path: '/goals',
      component: () => import('../views/GoalsView.vue'),
      meta: { title: '目标管理', icon: '🎯' }
    },
    {
      path: '/plans',
      component: () => import('../views/PlansView.vue'),
      meta: { title: '计划制定', icon: '📜' }
    },
    {
      path: '/daily',
      component: () => import('../views/DailyView.vue'),
      meta: { title: '每日记录', icon: '✍️' }
    },
    {
      path: '/finance',
      component: () => import('../views/FinanceView.vue'),
      meta: { title: '消费与财务', icon: '💰' }
    },
    {
      path: '/books',
      component: () => import('../views/BooksView.vue'),
      meta: { title: '读书清单', icon: '📚' }
    },
    {
      path: '/learnings',
      component: () => import('../views/LearningsView.vue'),
      meta: { title: '学习记录', icon: '🎓' }
    },
    {
      path: '/reviews',
      component: () => import('../views/ReviewsView.vue'),
      meta: { title: '复盘总结', icon: '🧘' }
    },
    {
      path: '/roadmap',
      component: () => import('../views/RoadmapView.vue'),
      meta: { title: '路线图', icon: '🗺️' }
    },
    {
      path: '/assets',
      component: () => import('../views/AssetsView.vue'),
      meta: { title: '存款与资产', icon: '🪙' }
    },
    {
      path: '/stats',
      component: () => import('../views/StatsView.vue'),
      meta: { title: '数据统计', icon: '📊' }
    },
    {
      path: '/settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { title: '设置', icon: '⚙️' }
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 青云志` : '青云志 · 人生进度簿'
})

export default router
