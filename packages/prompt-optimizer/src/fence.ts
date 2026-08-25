/**
 * Same-origin fence for the optimization route. Mirrors the family fence in
 * session-delete: a cross-site browser fetch is rejected (Sec-Fetch-Site or
 * a mismatched Origin), while curl / node clients without those headers
 * pass - the fence only targets the cross-site browser vector.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { writeJson } from './http.ts'

function hasForeignOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return false
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return true
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

/** Reject cross-site requests with 403; true when the request may proceed. */
export function requireSameOrigin(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    writeJson(res, 403, { ok: false, code: 'cross-site-request-rejected', message: 'cross-site request rejected' })
    return false
  }
  if (hasForeignOrigin(req)) {
    writeJson(res, 403, { ok: false, code: 'cross-site-request-rejected', message: 'cross-site request rejected' })
    return false
  }
  return true
}
