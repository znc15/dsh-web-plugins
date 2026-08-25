/**
 * session-delete — host half.
 *
 * Serves POST /api/session-delete/v1/delete: permanently deletes one
 * conversation (plus its durable children) from the running dsh web GUI.
 * The official browser contract has no delete RPC, so the deletion runs
 * host-side: live sessions are detached from the session store (which emits
 * the official session/disposed event and lets the api proxy publish
 * host/session-removed, so the browser drops the row and clears the
 * selection) and the durable JSONL artifact directories are removed.
 * Sessions that are currently running are refused.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { deleteSessionClosure } from './core/delete-session.ts'
import { createDeletePorts } from './host-bridge.ts'
import { requireSameOrigin } from './fence.ts'
import { mountOnce } from './mount-once.ts'
import { readJsonBody, writeJson } from './http.ts'

/** Stable cordis plugin name. */
export const name = 'session-delete'

/** Services required before the route can mount. */
export const inject = ['webServer']

/** The deletion route (client contract shares this literal). */
export const DELETE_PATH = '/api/session-delete/v1/delete'

/** Smallest useful body cap: one session id. */
const MAX_BODY_BYTES = 16 * 1024

function applyImpl(ctx: Context): void {
  ctx.effect(() => {
    const disposer = ctx.webServer.register({
      kind: 'exact',
      path: DELETE_PATH,
      handler: (req: IncomingMessage, res: ServerResponse) => {
        void handleDelete(ctx, req, res)
      },
    })
    return disposer
  }, 'ui-session-delete: route')
}

async function handleDelete(ctx: Context, req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== 'POST') {
      writeJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'POST required' })
      return
    }
    if (!requireSameOrigin(req, res)) return

    const body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true })
    const sessionId =
      body !== null && typeof body === 'object' && 'sessionId' in body
        ? (body as { sessionId: unknown }).sessionId
        : undefined

    const result = await deleteSessionClosure(sessionId, createDeletePorts(ctx))
    if (result.ok) {
      writeJson(res, 200, { ok: true, removed: result.removed })
      return
    }
    const status =
      result.code === 'session-busy' ? 409
      : result.code === 'session-not-found' ? 404
      : result.code === 'invalid-id' ? 400
      : 500
    writeJson(res, status, { ok: false, code: result.code, message: result.message })
  } catch (error) {
    ctx.logger.warn('ui-session-delete: delete failed: ' + String(error))
    writeJson(res, 500, {
      ok: false,
      code: 'deletion-failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Single-instance guard shared by the plugin family: the aggregate bundle
 * and a standalone install of this package can coexist in one profile, so
 * the second host apply must be a no-op instead of re-registering the route.
 */
export const apply = mountOnce('@linxin666/dsh-client-ui-session-delete', applyImpl)
