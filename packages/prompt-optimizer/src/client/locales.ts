/**
 * prompt-optimizer locale dictionaries. The optimize entry lives in the
 * composer tool row beside the context meter; all copy is localized through
 * the standard `t` seat.
 */

/** Copy keys owned by this plugin. */
export type PromptOptimizerKey =
  | 'optimize.label'
  | 'optimize.hint'
  | 'optimize.busy'
  | 'optimize.empty'
  | 'optimize.failed'
  | 'optimize.busySession'
  | 'optimize.noRoute'

/** Simplified Chinese dictionary (key source). */
export const zh: Record<PromptOptimizerKey, string> = {
  'optimize.label': '优化提示词',
  'optimize.hint': '用当前会话或默认模型优化这段输入',
  'optimize.busy': '正在优化…',
  'optimize.empty': '先输入内容再优化',
  'optimize.failed': '优化失败，请稍后重试',
  'optimize.busySession': '优化暂时不可用',
  'optimize.noRoute': '当前没有可用模型，请先在设置中配置模型',
}

/** English dictionary, checked complete against the zh key set. */
export const en: Record<PromptOptimizerKey, string> = {
  'optimize.label': 'Optimize prompt',
  'optimize.hint': 'Rewrite this draft through the session or default model',
  'optimize.busy': 'Optimizing…',
  'optimize.empty': 'Type something first',
  'optimize.failed': 'Optimization failed, please try again later',
  'optimize.busySession': 'Optimization is unavailable right now',
  'optimize.noRoute': 'No available model is configured; set one up in settings first',
}
