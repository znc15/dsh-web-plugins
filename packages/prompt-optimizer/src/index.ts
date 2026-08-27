/**
 * prompt-optimizer - host half.
 *
 * Serves POST /api/prompt-optimizer/v1/optimize: rewrites a user draft
 * into a clearer, better-structured prompt through the session's own model
 * route (the same provider/model the conversation uses, resolved from the
 * session's last request context). The browser calls this from the composer
 * tool row and replaces the draft with the returned text.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { Session, SessionStore } from '@deepseek-ai/dsh-session'
import { OptimizeError, pickFallbackRoute, runOptimization, type OptimizeRoute } from './core/optimize.ts'
import { requireSameOrigin } from './fence.ts'
import { mountOnce } from './mount-once.ts'
import { readJsonBody, writeJson } from './http.ts'

/** Stable cordis plugin name. */
export const name = 'prompt-optimizer'

/** Services required before the route can mount. */
export const inject = ['webServer']

/** The optimization route (client contract shares this literal). */
export const OPTIMIZE_PATH = '/api/prompt-optimizer/v1/optimize'

/** Smallest useful body cap: one session id plus one draft. */
const MAX_BODY_BYTES = 32 * 1024

/** Session id guard shared with the client (mirrors session-delete's rule). */
function isValidSessionId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 200 && !id.includes('/') && !id.includes('\\') && !id.includes('\0')
}

function applyImpl(ctx: Context): void {
  ctx.effect(() => {
    const disposer = ctx.webServer.register({
      kind: 'exact',
      path: OPTIMIZE_PATH,
      handler: (req: IncomingMessage, res: ServerResponse) => {
        void handleOptimize(ctx, req, res)
      },
    })
    return disposer
  }, 'ui-prompt-optimizer: route')
}

async function handleOptimize(ctx: Context, req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== 'POST') {
      writeJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'POST required' })
      return
    }
    if (!requireSameOrigin(req, res)) return

    const body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true })
    const obj = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : null
    const sessionId = obj?.['sessionId']
    const prompt = obj?.['prompt']

    if (!isValidSessionId(sessionId)) {
      writeJson(res, 400, { ok: false, code: 'invalid-session-id', message: 'invalid session id' })
      return
    }
    if (typeof prompt !== 'string') {
      writeJson(res, 400, { ok: false, code: 'invalid-prompt', message: 'prompt must be a string' })
      return
    }

    const sessions = ctx.get('sessions') as SessionStore | undefined
    const session = sessions?.get?.(sessionId as Parameters<SessionStore['get']>[0])
    if (session === undefined) {
      writeJson(res, 404, { ok: false, code: 'session-not-found', message: 'session not found' })
      return
    }
    const llm = ctx.get('llm') as LlmRuntime | undefined
    if (llm === undefined) {
      writeJson(res, 503, { ok: false, code: 'llm-unavailable', message: 'LLM service is unavailable' })
      return
    }

    const live = session as Session
    const route = await resolveOptimizeRoute(ctx, llm, live)

    const optimized = await runOptimization(
      {
        route: () => route,
        stream: (options) => llm.stream(options),
      },
      prompt,
      sessionId,
    )

    writeJson(res, 200, { ok: true, optimized })
  } catch (error) {
    if (error instanceof OptimizeError) {
      const status =
        error.code === 'empty-prompt' || error.code === 'prompt-too-long' ? 400
        : error.code === 'no-model-route' ? 409
        : error.code === 'llm-unavailable' ? 503
        : error.code === 'optimize-timeout' ? 504
        : 502
      writeJson(res, status, { ok: false, code: error.code, message: error.message })
      return
    }
    ctx.logger.warn('ui-prompt-optimizer: optimize failed: ' + String(error))
    writeJson(res, 500, {
      ok: false,
      code: 'optimize-failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Read the app's default model selection (agent-default-model service), when
 * the core service is mounted and carries a usable provider/model pair.
 */
function defaultModelRoute(ctx: Context): OptimizeRoute | undefined {
  try {
    // ctx.get is the safe loose read: the service is optional and not in our
    // inject list, so a direct ctx.<name> property access would throw.
    const service = (ctx.get as (name: string) => unknown)('agentDefaultModel') as
      | { currentSelection?(): { provider?: unknown; model?: unknown } }
      | undefined
    const selection = service?.currentSelection?.()
    if (selection !== undefined && typeof selection.provider === 'string' && typeof selection.model === 'string') {
      return { provider: selection.provider, model: selection.model }
    }
  } catch {
    return undefined
  }
  return undefined
}

/**
 * Resolve the optimization route. The session's own model record wins
 * (request context, then request header). A session with no record yet —
 * e.g. a fresh empty conversation — falls back to the app's default model
 * selection, and finally polls the registered providers' advertised models,
 * so the optimize button works without sending a message first.
 */
async function resolveOptimizeRoute(
  ctx: Context,
  llm: LlmRuntime,
  session: Session,
): Promise<OptimizeRoute | undefined> {
  const context = session.requestContext?.()
  if (context !== undefined) return { provider: context.provider, model: context.model }
  const header = session.requestHeader?.()
  if (header?.config !== undefined) return { provider: header.config.provider, model: header.config.model }

  const providers = llm.listProviders()
  const defaults = defaultModelRoute(ctx)
  if (defaults !== undefined && providers.some((provider) => provider.id === defaults.provider)) {
    return defaults
  }
  const modelsByProvider = new Map<string, readonly { id: string; inputModalities?: readonly ('text' | 'image')[] }[]>()
  for (const provider of providers) {
    const models = await llm.listModels(provider.id).catch(() => [] as { id: string; inputModalities?: readonly ('text' | 'image')[] }[])
    modelsByProvider.set(provider.id, models)
  }
  return pickFallbackRoute(undefined, providers, modelsByProvider)
}

/**
 * Single-instance guard shared by the plugin family: the aggregate bundle
 * and a standalone install of this package can coexist in one profile, so
 * the second host apply must be a no-op instead of re-registering the route.
 */
export const apply = mountOnce('@linxin666/dsh-client-ui-prompt-optimizer', applyImpl)
