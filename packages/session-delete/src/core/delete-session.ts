/**
 * Core deletion planner for the session-delete plugin (host half).
 *
 * The official DSH browser contract exposes no delete-session RPC, so this
 * plugin carries out the operation on the host with the same building blocks
 * the product itself uses:
 *
 *  1. detach every live target from the in-memory session store, which emits
 *     the official `session/disposed` event and lets the api proxy publish
 *     `host/session-removed` — the browser then drops the row and clears the
 *     selection back to the New Session view;
 *  2. delete the durable JSONL artifact directories of every closure member
 *     so a restart (and the cold-session list) no longer sees them;
 *  3. best-effort forget() hooks for the workspace registry and projection
 *     cache memory maps (durable workspace.json self-heals on next boot
 *     because workspace sessionIds getters filter against the rebuilt
 *     header index).
 *
 * Files are only ever removed from the exact session directory the JSONL
 * backend derives via its own path-encoding of the session id — the plugin
 * reimplements that encoding to verify the directory name before deleting.
 *
 * This module is environment-port friendly: it never touches @deepseek-ai
 * types directly (except through the ports) so the same logic runs under
 * vitest with plain doubles.
 */

import { basename, dirname } from 'node:path'
import { rmSync } from 'node:fs'

/** Header fields the deletion planner reads off a session. */
export interface SessionHeaderLike {
  /** The session id (matches the durable log directory encoding). */
  id: string
  /** Direct fork lineage; drives the recursive closure walk. */
  parentSession?: string
  /** Absolute project directory the session was created in. */
  cwd?: string
}

/** One known session: a header plus the resolved artifact file path. */
export interface SessionCandidate {
  readonly header: SessionHeaderLike
  /** Absolute path of the backend artifact, when discoverable. */
  readonly artifactPath?: string
}

/** Ports the planner needs; the host bridge fills them with real services. */
export interface DeleteSessionPorts {
  /** Every currently live session (header + its artifact path). */
  readonly liveCandidates: () => readonly SessionCandidate[]
  /** Every persisted (cold) session header. */
  readonly persistedHeaders: () => Promise<readonly SessionHeaderLike[]>
  /** Resolve the artifact path for one header through the persistence backend. */
  readonly locate: (header: SessionHeaderLike) => string | undefined
  /** Detach a live session from the store; true when it was live. */
  readonly detach: (id: string) => boolean
  /** Whether an agent is currently driving this session. */
  readonly isRunning: (id: string) => boolean
  /** Best-effort in-memory cleanup (workspace registry / projection cache). */
  readonly forget: (id: string) => void
}

/** Successful deletion result. */
export interface DeleteOk {
  readonly ok: true
  /** Every session actually removed (target first, then its durable children). */
  readonly removed: readonly string[]
}

/** Failure result with a stable code the browser maps to localized copy. */
export interface DeleteError {
  readonly ok: false
  readonly code: 'invalid-id' | 'session-not-found' | 'session-busy' | 'deletion-failed'
  readonly message: string
}

export type DeleteResult = DeleteOk | DeleteError

/** Maximum accepted session id length (ids are short counter/host spellings). */
export const MAX_SESSION_ID_LENGTH = 200

/** Validate a wire-supplied session id candidate. */
export function isValidSessionId(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value.length === 0 || value.length > MAX_SESSION_ID_LENGTH) return false
  if (/[\\/\0]/.test(value)) return false
  return true
}

/**
 * The path-segment encoding the JSONL persistence backend applies to session
 * ids (mirror of dsh-session-persistence-jsonl's encodeSegment). The planner
 * uses it to verify a directory really is this session's own directory
 * before any rmSync.
 */
export function encodeSegment(raw: string): string {
  if (raw.length === 0) throw new Error('cannot encode an empty path segment')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += '~' + code.toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

/**
 * Expand the target id to its durable closure: the target plus every session
 * (transitively) whose header names a member as parentSession. Children are
 * removed with their parent so no orphaned child log can resurrect the
 * conversation later.
 */
export function collectDeletionClosure(target: string, headers: readonly SessionHeaderLike[]): string[] {
  const closure = new Set<string>()
  const queue = [target]
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (closure.has(id)) continue
    closure.add(id)
    for (const header of headers) {
      if (header.parentSession === id && !closure.has(header.id)) queue.push(header.id)
    }
  }
  return [...closure]
}

/**
 * The absolute artifact file path degraded into the session's own data
 * directory, or undefined when the backend has no per-session artifact or the
 * resolved directory name does not match this session's encoded id (a
 * foreign directory is never deleted).
 */
export function sessionDataDir(header: SessionHeaderLike, artifactPath: string | undefined): string | undefined {
  if (artifactPath === undefined) return undefined
  const dir = dirname(artifactPath)
  if (basename(dir) === encodeSegment(header.id)) return dir
  return undefined
}

/** Remove one session's data directory (recursive, tolerant). */
export function removeSessionDataDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  } catch {
    // A locked file (Windows) must not take the whole deletion down; the
    // in-memory detach already removed the session from the live world and
    // the durable file is retried on the next boot scan by the backend.
  }
}

/**
 * Run one deletion request end to end.
 * @param rawTarget - the wire value to validate.
 * @param ports - live/persisted sources and mutation hooks.
 * @returns the success or failure payload for the HTTP response.
 */
export async function deleteSessionClosure(rawTarget: unknown, ports: DeleteSessionPorts): Promise<DeleteResult> {
  if (!isValidSessionId(rawTarget)) {
    return { ok: false, code: 'invalid-id', message: 'session id must be a non-empty string without path separators' }
  }
  const target = rawTarget

  const live = ports.liveCandidates()
  const persisted = await ports.persistedHeaders()

  const known = new Map<string, SessionCandidate>()
  for (const candidate of live) known.set(candidate.header.id, candidate)
  for (const header of persisted) {
    if (!known.has(header.id)) known.set(header.id, { header })
  }
  if (!known.has(target)) {
    return { ok: false, code: 'session-not-found', message: `no session "${target}" is live or persisted` }
  }

  const closure = collectDeletionClosure(
    target,
    [...known.values()].map((candidate) => candidate.header),
  )
  const running = closure.filter((id) => ports.isRunning(id))
  if (running.length > 0) {
    return { ok: false, code: 'session-busy', message: `session(s) still running: ${running.join(', ')}` }
  }

  for (const id of closure) {
    ports.detach(id)
    const candidate = known.get(id)
    if (candidate !== undefined) {
      const dataDir = sessionDataDir(candidate.header, candidate.artifactPath ?? ports.locate(candidate.header))
      if (dataDir !== undefined) removeSessionDataDir(dataDir)
    }
    ports.forget(id)
  }

  return { ok: true, removed: closure }
}
