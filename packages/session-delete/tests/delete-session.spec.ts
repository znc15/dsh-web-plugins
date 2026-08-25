/**
 * Core deletion planner tests: path encoding, closure expansion, and the
 * orchestrator over plain doubles (real temp dirs for the artifact removal
 * side).
 */

import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  collectDeletionClosure,
  deleteSessionClosure,
  encodeSegment,
  isValidSessionId,
  sessionDataDir,
  type DeleteSessionPorts,
  type SessionHeaderLike,
} from '../src/core/delete-session.ts'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'session-delete-spec-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function sessionDir(id: string): string {
  const dir = join(root, encodeSegment(id))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'session.jsonl'), '{"type":"session","id":"' + id + '"}\n')
  return dir
}

function header(id: string, parentSession?: string): SessionHeaderLike {
  return { id, ...(parentSession === undefined ? {} : { parentSession }) }
}

function locateOf(h: SessionHeaderLike): string {
  return join(root, encodeSegment(h.id), 'session.jsonl')
}

function ports(overrides: Partial<DeleteSessionPorts> = {}): DeleteSessionPorts {
  return {
    liveCandidates: () => [],
    persistedHeaders: async () => [],
    locate: () => undefined,
    detach: () => false,
    isRunning: () => false,
    forget: () => {},
    ...overrides,
  }
}

describe('encodeSegment', () => {
  it('keeps safe segments verbatim and escapes everything else like the backend', () => {
    expect(encodeSegment('session-1')).toBe('session-1')
    expect(encodeSegment('a.b_c')).toBe('a.b_c')
    expect(encodeSegment('.')).toBe('~002E')
    expect(encodeSegment('..')).toBe('~002E~002E')
    expect(encodeSegment('abc def')).toBe('abc~0020def')
    expect(encodeSegment('a~b')).toBe('a~007Eb')
  })
})

describe('isValidSessionId', () => {
  it('accepts ordinary ids and rejects non-strings and path separators', () => {
    expect(isValidSessionId('session-12')).toBe(true)
    expect(isValidSessionId('a.b_c.d')).toBe(true)
    expect(isValidSessionId('')).toBe(false)
    expect(isValidSessionId(42)).toBe(false)
    expect(isValidSessionId(null)).toBe(false)
    expect(isValidSessionId('a/b')).toBe(false)
    expect(isValidSessionId('a\\b')).toBe(false)
    expect(isValidSessionId('x'.repeat(201))).toBe(false)
  })
})

describe('collectDeletionClosure', () => {
  it('returns the target and every transitive child', () => {
    const headers = [
      header('parent'),
      header('child-a', 'parent'),
      header('child-b', 'parent'),
      header('grand', 'child-a'),
      header('unrelated'),
    ]
    expect(collectDeletionClosure('parent', headers).sort()).toEqual(['child-a', 'child-b', 'grand', 'parent'])
    expect(collectDeletionClosure('none', headers)).toEqual(['none'])
  })
})

describe('sessionDataDir', () => {
  it('only accepts the exact encoded session directory', () => {
    const h = header('session-1')
    expect(sessionDataDir(h, join(root, 'session-1', 'session.jsonl.zstd'))).toBe(join(root, 'session-1'))
    expect(sessionDataDir(h, join(root, 'other-dir', 'session.jsonl'))).toBeUndefined()
  })
})

describe('deleteSessionClosure', () => {
  it('rejects invalid and unknown ids', async () => {
    expect(await deleteSessionClosure('', ports())).toMatchObject({ ok: false, code: 'invalid-id' })
    expect(await deleteSessionClosure('missing', ports())).toMatchObject({ ok: false, code: 'session-not-found' })
  })

  it('refuses when the target or a child is running and touches nothing', async () => {
    const targetDir = sessionDir('session-1')
    const base = ports({
      liveCandidates: () => [
        { header: header('session-1') },
        { header: header('session-child', 'session-1') },
      ],
      isRunning: (id) => id === 'session-child',
    })
    const result = await deleteSessionClosure('session-1', base)
    expect(result).toMatchObject({ ok: false, code: 'session-busy' })
    expect(existsSync(targetDir)).toBe(true)
  })

  it('detaches, removes artifact dirs, forgets, and reports the closure', async () => {
    const parentDir = sessionDir('session-parent')
    const childDir = sessionDir('session-child')
    const detached: string[] = []
    const forgotten: string[] = []
    const base = ports({
      liveCandidates: () => [
        { header: header('session-parent') },
        { header: header('session-child', 'session-parent') },
      ],
      locate: locateOf,
      detach: (id) => {
        detached.push(id)
        return true
      },
      forget: (id) => {
        forgotten.push(id)
      },
    })
    const result = await deleteSessionClosure('session-parent', base)
    expect(result).toEqual({ ok: true, removed: ['session-parent', 'session-child'] })
    expect(detached.sort()).toEqual(['session-child', 'session-parent'])
    expect(forgotten.sort()).toEqual(['session-child', 'session-parent'])
    expect(existsSync(parentDir)).toBe(false)
    expect(existsSync(childDir)).toBe(false)
  })

  it('merges cold persistence headers and removes their artifact dirs', async () => {
    const cold = sessionDir('session-cold')
    const base = ports({
      persistedHeaders: async () => [header('session-cold')],
      locate: locateOf,
    })
    const result = await deleteSessionClosure('session-cold', base)
    expect(result).toEqual({ ok: true, removed: ['session-cold'] })
    expect(existsSync(cold)).toBe(false)
  })

  it('never deletes a directory that is not the exact encoded session dir', async () => {
    const foreign = join(root, 'not-the-session')
    mkdirSync(foreign, { recursive: true })
    const base = ports({
      liveCandidates: () => [{ header: header('session-1') }],
      locate: () => join(foreign, 'session.jsonl'),
    })
    await deleteSessionClosure('session-1', base)
    expect(existsSync(foreign)).toBe(true)
  })
})
