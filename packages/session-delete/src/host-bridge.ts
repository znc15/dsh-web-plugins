/**
 * Host bridge: adapts the live DSH services to the deletion planner's ports.
 *
 * The SessionStore exposes no public "destroy this session" method; the
 * bridge reaches the store entry's detach disposer (the same teardown the
 * owning fiber would run) so the official `session/disposed` event fires and
 * the api proxy frames `host/session-removed` for the browser. This is the
 * only internal-reach in the plugin; every other step (locate, list, agent
 * status) rides public service faces.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId, Session } from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import type { DeleteSessionPorts, SessionCandidate, SessionHeaderLike } from './core/delete-session.ts'

/** The part of the SessionStore entry the bridge touches. */
interface SessionStoreEntry {
  detach?: () => void
}

/** The part of the SessionStore service the bridge touches. */
interface SessionStoreLike {
  get(id: string): Session | undefined
  list(): Session[]
  store?: Map<string, SessionStoreEntry>
  liveEntryFor?(session: Session): SessionStoreEntry
}

/** Agent registry read face (busy probe only). */
interface AgentRegistryLike {
  get(id: string): { status: 'idle' | 'running' } | undefined
}

/** Workspace registry memory maps (best-effort cleanup). */
interface WorkspaceRegistryLike {
  headers?: Map<string, unknown>
  sessionPaths?: Map<string, unknown>
  invalidSessionPaths?: Map<string, unknown>
}

/** Projection cache service memory map (best-effort cleanup). */
interface ProjectionCacheLike {
  cachedRows?: Map<string, unknown>
}

function headerOf(session: Session): SessionHeaderLike {
  return {
    id: session.id,
    ...(session.header.parentSession !== undefined ? { parentSession: session.header.parentSession } : {}),
    ...(session.header.cwd !== undefined ? { cwd: session.header.cwd } : {}),
  }
}

/**
 * Build the deletion ports over a host context.
 * @param ctx - host plugin context (sessions/agents required; persistence and
 *   registry services optional so a minimal boot never blocks the route).
 */
export function createDeletePorts(ctx: Context): DeleteSessionPorts {
  const sessions = ctx.get('sessions') as SessionStoreLike | undefined
  const agents = ctx.get('agents') as AgentRegistryLike | undefined
  const persistence = ctx.get('sessionPersistence') as SessionPersistence | undefined

  const liveCandidates = (): readonly SessionCandidate[] => {
    if (sessions?.list === undefined) return []
    return sessions.list().map((session) => ({
      header: headerOf(session),
      artifactPath: artifactPathOf(headerOf(session)),
    }))
  }

  const artifactPathOf = (header: SessionHeaderLike): string | undefined => {
    if (persistence?.locate === undefined) return undefined
    try {
      return persistence.locate(header as Parameters<SessionPersistence['locate']>[0])?.path
    } catch {
      return undefined
    }
  }

  const persistedHeaders = async (): Promise<readonly SessionHeaderLike[]> => {
    if (persistence?.list === undefined) return []
    try {
      const headers = await persistence.list()
      return headers.map((header) => ({
        id: header.id,
        ...(header.parentSession !== undefined ? { parentSession: header.parentSession } : {}),
        ...(header.cwd !== undefined ? { cwd: header.cwd } : {}),
      }))
    } catch {
      return []
    }
  }

  const detach = (id: string): boolean => {
    if (sessions?.get === undefined) return false
    const live = sessions.get(id)
    if (live === undefined) return false
    const internals = sessions as unknown as SessionStoreLike
    const entry =
      internals.store?.get(id) ??
      (internals.liveEntryFor !== undefined ? internals.liveEntryFor(live) : undefined)
    if (entry?.detach === undefined) return false
    try {
      entry.detach()
      return true
    } catch {
      return false
    }
  }

  const isRunning = (id: string): boolean => {
    if (agents?.get === undefined) return false
    try {
      return agents.get(id)?.status === 'running'
    } catch {
      return false
    }
  }

  const forget = (id: string): void => {
    try {
      const registry = ctx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined
      if (registry !== undefined) {
        registry.headers?.delete(id)
        registry.sessionPaths?.delete(id)
        registry.invalidSessionPaths?.delete(id)
      }
    } catch {
      // best effort
    }
    try {
      const cache = ctx.get('sessionProjectionCache') as ProjectionCacheLike | undefined
      cache?.cachedRows?.delete(id)
    } catch {
      // best effort
    }
  }

  return {
    liveCandidates,
    persistedHeaders,
    locate: artifactPathOf,
    detach,
    isRunning,
    forget,
  }
}

export type { SessionId }
