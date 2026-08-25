/**
 * Optimizer core tests: prompt framing guards, route resolution, finish
 * handling, and output normalization over plain doubles.
 */

import { describe, expect, it, vi } from 'vitest'
import { CallId, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import {
  MAX_PROMPT_CHARS,
  normalizeOptimizedPrompt,
  OptimizeError,
  runOptimization,
  type OptimizePorts,
} from '../src/core/optimize.ts'

function ports(overrides: Partial<OptimizePorts> = {}): OptimizePorts {
  return {
    route: () => ({ provider: 'deepseek', model: 'deepseek-v4-flash' }),
    stream: async function* () {},
    ...overrides,
  }
}

function textChunks(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    ...text.split('').map((letter) => ({ type: 'text-delta' as const, index: 0, text: letter })),
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

describe('normalizeOptimizedPrompt', () => {
  it('strips one surrounding code fence and collapses run-on blank lines', () => {
    expect(normalizeOptimizedPrompt('```text\nfoo   \n\n\n\nbar\n```')).toBe('foo   \n\nbar')
    expect(normalizeOptimizedPrompt('  plain keep  ')).toBe('plain keep')
  })
})

describe('runOptimization', () => {
  it('rejects empty and oversized prompts before touching the LLM', async () => {
    const stream = vi.fn(async function* () {})
    const p = ports({ stream })
    await expect(runOptimization(p, '   ', 'session-1')).rejects.toMatchObject({ code: 'empty-prompt' })
    await expect(runOptimization(p, 'x'.repeat(MAX_PROMPT_CHARS + 1), 'session-1')).rejects.toMatchObject({ code: 'prompt-too-long' })
    expect(stream).not.toHaveBeenCalled()
  })

  it('fails fast when the session has no model route', async () => {
    await expect(runOptimization(ports({ route: () => undefined }), 'write a test', 'session-1'))
      .rejects.toMatchObject({ code: 'no-model-route' })
  })

  it('assembles the streamed text and returns the normalized prompt', async () => {
    const seen: Array<{ provider: string; model: string; system?: string; sessionId?: unknown }> = []
    const stream = async function* (options: GenerateOptions) {
      seen.push({ provider: options.provider, model: options.model, system: options.system, sessionId: options.sessionId })
      yield* textChunks('优化后的提示词')
    }
    const optimized = await runOptimization(ports({ stream }), '帮我写个脚本', 'session-9')
    expect(optimized).toBe('优化后的提示词')
    expect(seen[0]).toMatchObject({ provider: 'deepseek', model: 'deepseek-v4-flash', sessionId: 'session-9' })
    expect(seen[0].system).toContain('提示词优化专家')
  })

  it('maps a max-tokens finish to optimize-failed', async () => {
    const stream: OptimizePorts['stream'] = async function* () {
      yield { type: 'finish', reason: { kind: 'max-tokens' } }
    }
    await expect(runOptimization(ports({ stream }), 'hi', 'session-1'))
      .rejects.toMatchObject({ code: 'optimize-failed' })
  })

  it('maps a terminal error finish to optimize-failed', async () => {
    const stream: OptimizePorts['stream'] = async function* () {
      yield { type: 'finish', reason: { kind: 'error', failure: { message: 'boom', code: 'E_X' } } }
    }
    await expect(runOptimization(ports({ stream }), 'hi', 'session-1'))
      .rejects.toMatchObject({ code: 'optimize-failed', message: 'boom' })
  })

  it('rejects tool-call blocks as non-text output', async () => {
    const stream: OptimizePorts['stream'] = async function* () {
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id: CallId('c1'), name: 'x', argumentsDelta: '{}' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: CallId('c1'), name: 'x', arguments: '{}' } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
    }
    await expect(runOptimization(ports({ stream }), 'hi', 'session-1'))
      .rejects.toMatchObject({ code: 'optimize-failed' })
  })

  it('fails on empty assembled text', async () => {
    const stream: OptimizePorts['stream'] = async function* () {
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
    await expect(runOptimization(ports({ stream }), 'hi', 'session-1'))
      .rejects.toMatchObject({ code: 'optimize-failed' })
  })
})

describe('OptimizeError', () => {
  it('is an Error carrying a stable code', () => {
    const error = new OptimizeError('no-model-route', 'nope')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('no-model-route')
  })
})
