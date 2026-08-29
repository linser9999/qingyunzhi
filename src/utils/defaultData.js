/**
 * 默认数据与示例数据、业务常量
 */

export const CATEGORIES = ['餐饮', '房租', '交通', '学习', '娱乐', '医疗', '人情', '其他']
export const PAY_METHODS = ['微信', '支付宝', '银行卡', '现金']
export const MODES = ['必需', '可选', '冲动', '投资']
export const INCOME_TYPES = ['工资', '副业', '理财收益', '其他']
export const GOAL_TYPES = ['长期', '年度', '季度', '月度', '周度', '每日']
export const PLAN_PERIODS = ['一次性', '每日', '每周', '每月', '每季度', '每年']
export const PLAN_STATUS = ['未开始', '进行中', '已完成', '已放弃']
export const BOOK_STATUS = ['在读', '已读', '放弃']
export const REVIEW_TYPES = ['day', 'week', 'month', 'quarter', 'year']
export const REVIEW_TYPE_LABEL = { day: '每日复盘', week: '每周总结', month: '每月总结', quarter: '季度总结', year: '年度总结' }
export const MILESTONE_PHASES = ['秋招', '毕业入职', '跳槽涨薪', '副业起步', '资产积累', '财富自由']

/** 空数据结构（与 GitHub data/user-data.json 一致） */
export function emptyData() {
  return {
    user: {
      name: '追梦人',
      birthday: '2004-01-01',
      targetAge: 40,
      baselineSalary: 6000,
      createdAt: new Date().toISOString()
    },
    goals: [],
    plans: [],
    dailyRecords: [],
    consumptions: [],
    incomes: [],
    assets: [],
    books: [],
    learnings: [],
    reviews: [],
    milestones: []
  }
}

/** 首次使用时的示例数据（可在设置中一键清除） */
export function sampleData() {
  const d = emptyData()
  d.user = { ...d.user, name: '追梦人', birthday: '2004-01-01', targetAge: 40, baselineSalary: 6000 }
  d.goals = [
    {
      id: 'g-1000000', name: '六年净资产 100 万', type: '长期',
      description: '从大四到 30 岁，通过工资、副业与理财实现净资产 100 万。',
      startDate: '2026-09-01', endDate: '2032-08-31',
      targetValue: 1000000, currentValue: 12000, unit: '元',
      progressMode: 'auto', status: 'active',
      milestones: [
        { id: 'gm1', name: '毕业前存款 5 万', date: '2027-06-30', targetValue: 50000, achieved: false },
        { id: 'gm2', name: '首份工作稳定一年', date: '2028-09-30', targetValue: 150000, achieved: false },
        { id: 'gm3', name: '突破 50 万', date: '2030-12-31', targetValue: 500000, achieved: false }
      ],
      tags: ['财富'], createdAt: new Date().toISOString()
    },
    {
      id: 'g-free', name: '35-40 岁财富自由', type: '长期',
      description: '被动收入覆盖日常开销，实现时间自由。',
      startDate: '2026-09-01', endDate: '2036-12-31',
      targetValue: 3000000, currentValue: 0, unit: '元',
      progressMode: 'manual', status: 'active',
      milestones: [],
      tags: ['财富自由'], createdAt: new Date().toISOString()
    }
  ]
  d.plans = [
    { id: 'p1', name: '每日 LeetCode 刷题 2 道', goalId: 'g-1000000', period: '每日',
      startDate: '2026-09-01', endDate: '2026-12-31', startTime: '20:00', endTime: '21:30',
      priority: 1, status: '进行中', progress: 40, repeat: { type: 'daily', weekDays: [], interval: 1 },
      sortOrder: 0, createdAt: new Date().toISOString() },
    { id: 'p2', name: '每周复盘一次', goalId: '', period: '每周',
      startDate: '2026-09-01', endDate: '', startTime: '', endTime: '',
      priority: 2, status: '进行中', progress: 0, repeat: { type: 'weekly', weekDays: [6], interval: 1 },
      sortOrder: 1, createdAt: new Date().toISOString() },
    { id: 'p3', name: '每月定投基金 2000 元', goalId: 'g-1000000', period: '每月',
      startDate: '2026-09-01', endDate: '', startTime: '', endTime: '',
      priority: 1, status: '进行中', progress: 50, repeat: { type: 'monthly', weekDays: [], interval: 1 },
      sortOrder: 2, createdAt: new Date().toISOString() }
  ]
  d.consumptions = [
    { id: 'c1', amount: 18, date: '2026-08-20', time: '12:10', category: '餐饮', payMethod: '微信', mode: '必需', note: '午饭', tags: [], createdAt: new Date().toISOString() },
    { id: 'c2', amount: 56.5, date: '2026-08-21', time: '18:20', category: '餐饮', payMethod: '支付宝', mode: '可选', note: '朋友聚餐', tags: ['社交'], createdAt: new Date().toISOString() },
    { id: 'c3', amount: 39, date: '2026-08-22', time: '10:00', category: '学习', payMethod: '微信', mode: '投资', note: '技术书籍', tags: [], createdAt: new Date().toISOString() },
    { id: 'c4', amount: 12, date: '2026-08-23', time: '15:30', category: '交通', payMethod: '支付宝', mode: '必需', note: '地铁', tags: [], createdAt: new Date().toISOString() },
    { id: 'c5', amount: 300, date: '2026-08-24', time: '09:00', category: '房租', payMethod: '银行卡', mode: '必需', note: '合租', tags: [], createdAt: new Date().toISOString() },
    { id: 'c6', amount: 25, date: '2026-08-25', time: '20:00', category: '娱乐', payMethod: '微信', mode: '冲动', note: '游戏皮肤', tags: ['反思'], createdAt: new Date().toISOString() }
  ]
  d.incomes = [
    { id: 'i1', date: '2026-08-01', type: '副业', amount: 800, note: '接了个小外包', createdAt: new Date().toISOString() },
    { id: 'i2', date: '2026-08-15', type: '理财收益', amount: 45.2, note: '货基收益', createdAt: new Date().toISOString() }
  ]
  d.assets = [
    { id: 'a1', month: '2026-08', cash: 5000, fund: 6000, stock: 0, other: 1000, note: '初始', createdAt: new Date().toISOString() },
    { id: 'a2', month: '2026-09', cash: 4200, fund: 8000, stock: 0, other: 1000, note: '', createdAt: new Date().toISOString() }
  ]
  d.books = [
    { id: 'b1', title: '纳瓦尔宝典', author: '埃里克·乔根森', startDate: '2026-08-10', finishDate: '', notes: '财富与幸福的原则，重读一遍。', rating: 0, status: 'reading', tags: ['理财'], createdAt: new Date().toISOString() },
    { id: 'b2', title: '深入理解 Java 虚拟机', author: '周志明', startDate: '2026-07-01', finishDate: '2026-08-18', notes: 'GC 与内存模型章节很扎实。', rating: 5, status: 'read', tags: ['技术'], createdAt: new Date().toISOString() }
  ]
  d.learnings = [
    { id: 'l1', date: '2026-08-20', subject: 'Java 并发编程', minutes: 90, note: 'AQS 原理', link: '', tags: ['技术'], createdAt: new Date().toISOString() },
    { id: 'l2', date: '2026-08-21', subject: '股票基金入门', minutes: 60, note: '指数基金定投策略', link: '', tags: ['理财'], createdAt: new Date().toISOString() }
  ]
  d.dailyRecords = [
    { id: 'd1', date: '2026-08-20', tasksDone: ['完成 2 道 LeetCode', '看完一章书'], studyMinutes: 150, exercise: '跑步 3 公里',
      mood: 4, summary: '效率不错', reflection: '晚上刷手机太久，明天控制。', tags: ['自律'], checkins: [{ label: '今日已定投', done: false }], createdAt: new Date().toISOString() }
  ]
  d.reviews = [
    { id: 'r1', type: 'week', periodStart: '2026-08-17', periodEnd: '2026-08-23', title: '第一周复盘',
      content: '## 本周完成\n- 学习了 AQS\n- 读完 2 章书\n\n## 下周计划\n- 复习 JVM 内存模型\n- 开始写简历', tags: ['学习'], createdAt: new Date().toISOString() }
  ]
  d.milestones = [
    { id: 'm1', name: '秋招冲刺', startDate: '2026-09-01', endDate: '2026-10-31', goalStatus: '投递 50 家 · 面试 10 家',
      keyActions: ['完善简历', '刷题 100 道', '复习八股'], achieved: false, achievedDate: '', sortOrder: 0, createdAt: new Date().toISOString() },
    { id: 'm2', name: '毕业入职', startDate: '2027-06-01', endDate: '2027-09-01', goalStatus: '拿到 offer 并入职',
      keyActions: ['毕业设计', '入职体检'], achieved: false, achievedDate: '', sortOrder: 1, createdAt: new Date().toISOString() },
    { id: 'm3', name: '跳槽涨薪', startDate: '2029-01-01', endDate: '2029-06-30', goalStatus: '薪资提升 30%+',
      keyActions: ['积累项目亮点', '技术深度提升'], achieved: false, achievedDate: '', sortOrder: 2, createdAt: new Date().toISOString() },
    { id: 'm4', name: '副业起步', startDate: '2027-09-01', endDate: '2028-12-31', goalStatus: '副业月入 3k',
      keyActions: ['定位方向', '建立作品集'], achieved: false, achievedDate: '', sortOrder: 3, createdAt: new Date().toISOString() },
    { id: 'm5', name: '资产积累', startDate: '2030-01-01', endDate: '2032-12-31', goalStatus: '净资产突破 50 万',
      keyActions: ['定投+低买', '控制消费'], achieved: false, achievedDate: '', sortOrder: 4, createdAt: new Date().toISOString() },
    { id: 'm6', name: '财富自由', startDate: '2033-01-01', endDate: '2036-12-31', goalStatus: '被动收入覆盖开销',
      keyActions: ['构建睡后收入'], achieved: false, achievedDate: '', sortOrder: 5, createdAt: new Date().toISOString() }
  ]
  return d
}

/** 消费类别颜色映射 */
export const CATEGORY_COLORS = {
  餐饮: '#e0a1a1', 房租: '#7b95b5', 交通: '#a58bb5', 学习: '#7a9e6b',
  娱乐: '#d9a94e', 医疗: '#c96a4a', 人情: '#e8b45e', 其他: '#9a8f7f'
}
