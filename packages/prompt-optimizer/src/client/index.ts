/**
 * prompt-optimizer - browser half. Registers the prompt-optimizer
 * dictionaries and the optimize entry in the composer tool row
 * (`conversation.input.right`, the seat rendered just left of the
 * context meter). Clicking the button asks the host to rewrite the current
 * draft through the session's own model route and replaces the draft with
 * the optimized text.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { OptimizePromptButton } from './OptimizePromptButton.tsx'
import { en, zh, type PromptOptimizerKey } from './locales.ts'
import { reportDailyHeartbeat } from './telemetry.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** prompt-optimizer surface copy. */
    'prompt-optimizer': PromptOptimizerKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'prompt-optimizer'

/** Unique occupant id inside the shared input.right list slot. */
const ENTRY_ID = 'prompt-optimizer'

/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'sessions']

/**
 * Register the prompt-optimizer surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // Anonymous install heartbeat (docs/telemetry.md): one beat per browser per
  // UTC day, package name only, silent failure.
  reportDailyHeartbeat([{ name: '@linxin666/dsh-client-ui-prompt-optimizer' }])

  ctx.effect(() => {
    try {
      return ctx.locale.register(NS, { zh, en })
    } catch {
      return () => {}
    }
  }, 'prompt-optimizer: dictionaries')

  ctx.slots.inject('conversation.input.right', () => {
    try {
      return ctx.slots.register({
        name: 'conversation.input.right',
        id: ENTRY_ID,
        order: 0,
        locale: NS,
        inject: () => ({}),
      }, OptimizePromptButton)
    } catch {
      return () => {}
    }
  })
}

export type { OptimizePromptButtonProps } from './OptimizePromptButton.tsx'
export type { PromptOptimizerKey } from './locales.ts'
