/**
 * 核心逻辑单元测试（Node 内置 test runner，零依赖）
 * 运行：node --test tests/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffDays, addDays, weekRange, monthRange, quarterRange, monthKey, ageAt, toDateStr } from '../src/utils/date.js'
import { sumBy, sumAmount, monthlySeries, lastMonths, goalProgress, goalTimeRatio, netWorth, assetCurve, annualGrowthRate, planCompletion, categoryByWeekday, categoryByMode } from '../src/utils/calc.js'
import { fmtMoney, fmtMoneyShort, uid } from '../src/utils/format.js'
import { emptyData, sampleData } from '../src/utils/defaultData.js'
import { mergeData } from '../src/services/dataService.js'
import { encodeBase64, decodeBase64 } from '../src/services/githubService.js'

/* ---------- 日期 ---------- */
test('diffDays 计算正确', () => {
  assert.equal(diffDays('2026-09-01', '2026-09-10'), 9)
  assert.equal(diffDays('2026-09-10', '2026-09-01'), -9)
})
test('addDays 跨月正确', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})
test('weekRange 以周一为起点', () => {
  // 2026-08-29 是周六，所在周应自 08-24(周一) 至 08-30(周日)
  const w = weekRange('2026-08-29')
  assert.equal(w.start, '2026-08-24')
  assert.equal(w.end, '2026-08-30')
})
test('monthRange 覆盖整月', () => {
  const m = monthRange('2026-02-15')
  assert.equal(m.start, '2026-02-01')
  assert.equal(m.end, '2026-02-28')
})
test('quarterRange 正确', () => {
  const q = quarterRange('2026-05-20') // 5月属 Q2
  assert.equal(q.start, '2026-04-01')
  assert.equal(q.end, '2026-06-30')
})
test('monthKey / ageAt', () => {
  assert.equal(monthKey('2026-08-29'), '2026-08')
  assert.equal(ageAt('2004-01-01', '2026-08-29'), 22)
  assert.equal(ageAt('2004-12-31', '2026-08-29'), 21) // 生日未到
})

/* ---------- 财务 ---------- */
const cons = [
  { id: '1', amount: 10, date: '2026-08-01', category: '餐饮', mode: '必需' },
  { id: '2', amount: 20, date: '2026-08-02', category: '餐饮', mode: '冲动' },
  { id: '3', amount: 30, date: '2026-08-03', category: '交通', mode: '必需' },
  { id: '4', amount: 100, date: '2026-09-01', category: '娱乐', mode: '冲动' }
]
test('sumBy 按类别分组求和', () => {
  const m = sumBy(cons, 'category')
  assert.equal(m['餐饮'], 30)
  assert.equal(m['交通'], 30)
})
test('sumAmount 总计', () => {
  assert.equal(sumAmount(cons), 160)
})
test('monthlySeries 按月聚合', () => {
  const s = monthlySeries(cons, ['2026-08', '2026-09'])
  assert.equal(s[0].total, 60)
  assert.equal(s[1].total, 100)
})
test('lastMonths 序列', () => {
  const ms = lastMonths(3, '2026-08-15')
  assert.deepEqual(ms, ['2026-06', '2026-07', '2026-08'])
})
test('categoryByWeekday 周末统计', () => {
  // 2026-08-01 周六
  const input = [{ ...cons[0], category: '餐饮' }, ...cons]
  const w = categoryByWeekday(input, '餐饮')
  assert.ok(w['周六'] >= 10)
  assert.equal(w['周一'] + w['周二'] + w['周三'] + w['周四'] + w['周五'] + w['周六'] + w['周日'], 40)
})
test('categoryByMode 分类×模式', () => {
  const m = categoryByMode(cons, '餐饮')
  assert.equal(m['必需'], 10)
  assert.equal(m['冲动'], 20)
})

/* ---------- 目标 ---------- */
test('goalProgress 数值进度', () => {
  const g = { targetValue: 100, currentValue: 25 }
  assert.equal(goalProgress(g, 25), 25)
  assert.equal(goalProgress(g, 200), 100)
})
test('goalTimeRatio 时间占比', () => {
  const g = { startDate: '2026-01-01', endDate: '2026-12-31' }
  // 已过半年 -> 接近 0.5
  const r = goalTimeRatio({ ...g, endDate: '2027-12-31' })
  assert.ok(r > 0 && r <= 1)
})

/* ---------- 资产 ---------- */
test('netWorth 汇总', () => {
  assert.equal(netWorth({ cash: 100, fund: 200, stock: 300, other: 400 }), 1000)
})
test('assetCurve 排序与取值', () => {
  const c = assetCurve([{ month: '2026-09', cash: 1 }, { month: '2026-08', cash: 5 }])
  assert.deepEqual(c.map(x => x.month), ['2026-08', '2026-09'])
  assert.equal(c[1].value, 1)
})
test('annualGrowthRate 年化', () => {
  // 1 年翻倍 -> 100%
  const r = annualGrowthRate(100, 200, 12)
  assert.ok(Math.abs(r - 1) < 0.01)
})

/* ---------- 计划 ---------- */
test('planCompletion 完成率', () => {
  const plans = [{ status: 'done' }, { status: '进行中' }, { status: '未开始' }]
  const r = planCompletion(plans)
  assert.ok(Math.abs(r - (100 / 3)) < 1e-9)
})

/* ---------- 格式化 ---------- */
test('fmtMoney 千分位', () => {
  assert.equal(fmtMoney(12345.6), '12,345.60')
})
test('fmtMoneyShort 万', () => {
  assert.equal(fmtMoneyShort(123456), '12.35 万')
})
test('uid 唯一', () => {
  assert.notEqual(uid('x'), uid('x'))
})

/* ---------- 默认数据 / 合并 ---------- */
test('emptyData 结构完整', () => {
  const d = emptyData()
  for (const k of ['goals', 'plans', 'dailyRecords', 'consumptions', 'incomes', 'assets', 'books', 'learnings', 'reviews', 'milestones']) {
    assert.ok(Array.isArray(d[k]), k)
  }
  assert.ok(d.user.name)
})
test('sampleData 含示例', () => {
  const s = sampleData()
  assert.ok(s.goals.length > 0)
  assert.ok(s.milestones.length >= 6)
})
test('mergeData 按 id 去重合并', () => {
  const remote = { ...emptyData(), goals: [{ id: 'g1', name: '远程目标' }] }
  const local = { ...emptyData(), goals: [{ id: 'g1', name: '本地目标' }, { id: 'g2', name: '本地新增' }] }
  const m = mergeData(remote, local)
  assert.equal(m.goals.length, 2)
  assert.equal(m.goals.find(g => g.id === 'g1').name, '本地目标') // 本地优先
})

/* ---------- Base64 编解码（UTF-8） ---------- */
test('encodeBase64/decodeBase64 中文往返', () => {
  const src = '你好，青云志 · ¥100,000 万元🎯'
  assert.equal(decodeBase64(encodeBase64(src)), src)
})
