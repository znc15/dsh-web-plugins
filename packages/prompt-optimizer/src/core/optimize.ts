/**
 * Core prompt-optimization policy for the prompt-optimizer plugin (host
 * half).
 *
 * The optimizer rewrites a user draft into a clearer, better-structured
 * prompt through the session's own model route. The system instruction
 * follows the prompt-optimizer project's approach
 * (https://github.com/linshenkx/prompt-optimizer): pin the role and the
 * goal, make implicit context explicit, remove vague wording, impose
 * structure when the task benefits from it, and never change the user's
 * intent or language.
 *
 * This module is environment-port friendly: it talks to the LLM through a
 * narrow ports face, so the same logic runs under vitest with plain
 * doubles.
 */

import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'

/** Longest accepted draft: 12 000 characters (roughly 24 KiB of CJK UTF-8). */
export const MAX_PROMPT_CHARS = 12_000

/** Frames the exact user text so user content cannot break structural delimiters. */
function framePrompt(prompt: string): string {
  return '优化下面这段用户提示词：\n' + JSON.stringify(prompt)
}

/**
 * The optimizer system instruction. The model is told to keep the user's
 * language, intent, and personal tone, and to return only the rewritten
 * prompt (no commentary).
 */
export const OPTIMIZE_SYSTEM_PROMPT = [
  '你是一名提示词优化专家。用户会发来一段要发送给 AI 智能体的提示词，请在不改变意图、不改写语言的前提下优化它：',
  '1. 明确目标：让模型清楚知道要完成什么、输出给谁、产出什么形式的结果；',
  '2. 补充必要上下文与约束：把用户隐含的假设、范围、格式和边界写清楚；',
  '3. 消除模糊：把“尽量”“大概”“好一点”之类含糊要求改写成可执行的具体标准；',
  '4. 合理结构化：适合分步的任务按编号步骤组织，适合表格/列表的输出明确格式；',
  '5. 保持简洁：不堆砌无意义套话，长度控制在必要范围，保留用户原有的风格和习惯用语；',
  '6. 只输出优化后的提示词本身，不要解释、不要前置说明、不要 Markdown 标题或代码块围栏。'
].join('\n')

/** One resolved model route. */
export interface OptimizeRoute {
  readonly provider: string
  readonly model: string
}

/** The LLM faces the optimizer core needs; the host route fills them. */
export interface OptimizePorts {
  /** The session's current model route, when one was ever used. */
  readonly route: () => OptimizeRoute | undefined
  /** Stream one auxiliary model call (same vocabulary as ctx.llm.stream). */
  readonly stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>
}

/** Stable error codes the route maps to HTTP statuses. */
export type OptimizeErrorCode =
  | 'empty-prompt'
  | 'prompt-too-long'
  | 'no-model-route'
  | 'llm-unavailable'
  | 'optimize-failed'
  | 'optimize-timeout'

/** Typed optimizer failure carrying a stable wire code. */
export class OptimizeError extends Error {
  readonly code: OptimizeErrorCode
  constructor(code: OptimizeErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

/**
 * Translate a terminal finish reason into an OptimizeError.
 * @param finish - assembled terminal state.
 * @returns undefined for a clean stop, otherwise the mapped failure.
 */
function finishError(finish: BlockAssembler['finish']): OptimizeError | undefined {
  switch (finish.kind) {
    case 'stop':
      return undefined
    case 'error':
    case 'aborted': {
      const error = new OptimizeError('optimize-failed', finish.failure.message)
      if (finish.failure.code === 'TIMEOUT' || finish.failure.code === 'ABORT_ERR') {
        return new OptimizeError('optimize-timeout', finish.failure.message)
      }
      return error
    }
    case 'max-tokens':
      return new OptimizeError('optimize-failed', 'optimizer output reached maxTokens')
    case 'tool-calls':
      return new OptimizeError('optimize-failed', 'optimizer model unexpectedly requested a tool')
    default:
      return new OptimizeError('optimize-failed', 'unsupported finish reason: ' + String(finish))
  }
}

/**
 * Normalize the model output into a usable prompt: strip one surrounding
 * code-fence pair if the model wrapped the answer anyway, then collapse
 * leading/trailing whitespace and run-on blank lines.
 * @param raw - assembled model text.
 * @returns the normalized prompt.
 */
export function normalizeOptimizedPrompt(raw: string): string {
  let text = raw.trim()
  const fence = /^```(?:\w+)?\n?([\s\S]*?)\n?```$/
  const fenced = fence.exec(text)
  if (fenced !== null) text = fenced[1].trim()
  return text.replace(/\n{3,}/g, '\n\n')
}

/**
 * Run one optimization pass: frame the draft, stream from the resolved
 * route, assemble blocks, and normalize the answer.
 * @param ports - LLM ports (route + stream).
 * @param prompt - the user's draft to optimize.
 * @param sessionId - session identity stamped on the auxiliary call.
 * @returns the normalized optimized prompt.
 * @throws OptimizeError on every failure path.
 */
export async function runOptimization(
  ports: OptimizePorts,
  prompt: string,
  sessionId: string,
): Promise<string> {
  const trimmed = prompt.trim()
  if (trimmed === '') throw new OptimizeError('empty-prompt', 'prompt is empty')
  if (trimmed.length > MAX_PROMPT_CHARS) {
    throw new OptimizeError('prompt-too-long', 'prompt exceeds ' + MAX_PROMPT_CHARS + ' characters')
  }
  const route = ports.route()
  if (route === undefined) {
    throw new OptimizeError('no-model-route', 'session has no model route yet; send one message first')
  }
  const framed = framePrompt(trimmed)
  const message = createUserMessage({
    content: [{ type: 'text', text: framed }],
    source: { kind: 'plugin', plugin: 'ui-prompt-optimizer' },
  })
  const options: GenerateOptions = {
    provider: route.provider,
    model: route.model,
    messages: [message],
    system: OPTIMIZE_SYSTEM_PROMPT,
    maxTokens: 800,
    sessionId: sessionId as GenerateOptions['sessionId'],
    signal: AbortSignal.timeout(45_000),
  }
  const assembler = new BlockAssembler()
  try {
    for await (const chunk of ports.stream(options)) assembler.push(chunk)
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'TimeoutError' || name === 'AbortError' || (error instanceof Error && String(error.message).includes('timeout'))) {
      throw new OptimizeError('optimize-timeout', 'optimizer call timed out')
    }
    throw new OptimizeError('optimize-failed', error instanceof Error ? error.message : String(error))
  }
  const terminalError = finishError(assembler.finish)
  if (terminalError !== undefined) throw terminalError
  const blocks = assembler.blocks()
  if (blocks.some((block) => block.type === 'tool-call')) {
    throw new OptimizeError('optimize-failed', 'optimizer must return text only')
  }
  const raw = blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
  const optimized = normalizeOptimizedPrompt(raw)
  if (optimized === '') throw new OptimizeError('optimize-failed', 'optimizer produced no text')
  return optimized
}
