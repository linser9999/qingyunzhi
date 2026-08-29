/**
 * 数据层统一出口（service 抽象层）
 * 未来接入 Supabase / 自建后端时，只需替换 dataService 实现，
 * 业务层（store / view）无需改动。
 */
export * from './dataService.js'
export { githubService } from './githubService.js'
export { localCache } from './localCache.js'
