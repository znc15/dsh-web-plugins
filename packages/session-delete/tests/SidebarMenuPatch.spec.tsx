/**
 * SidebarMenuPatch unit tests: the DOM seat recognises the session-row
 * ellipsis trigger, injects the delete row into the open menu portal, opens
 * the target session, and drives the official header delete confirmation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { injectDeleteRow, installSidebarMenuDom, resolveSessionIdFromAnchor } from '../src/client/SidebarMenuPatch.tsx'

function fakeCtx(open = vi.fn()): ClientContext {
  const list = {
    ids: ['s-1', 's-2'] as SessionId[],
    byId: {
      's-1': { id: 's-1', displayTitle: '测试会话', blank: false, running: false, updatedAt: 0 },
      's-2': { id: 's-2', displayTitle: '另一个会话', blank: false, running: false, updatedAt: 0 },
    },
    current: 's-1',
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
  }
  return {
    sessions: { list: { getSnapshot: () => list }, open },
  } as unknown as ClientContext
}

const t = ((key: string) => key) as (key: string) => string

function sessionRow(title: string): HTMLDivElement {
  const row = document.createElement('div')
  row.setAttribute('role', 'treeitem')
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.setAttribute('aria-label', '会话“' + title + '”的操作')
  row.append(trigger)
  return row
}

function openMenu(): HTMLDivElement {
  const menu = document.createElement('div')
  menu.setAttribute('role', 'menu')
  const template = document.createElement('button')
  template.setAttribute('role', 'menuitem')
  template.textContent = '归档会话'
  menu.append(template)
  document.body.append(menu)
  return menu
}

let container: HTMLDivElement

beforeEach(() => {
  container = sessionRow('测试会话')
  document.body.append(container)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('resolveSessionIdFromAnchor', () => {
  it('maps the quoted aria-label title back to a session id', () => {
    const trigger = container.querySelector('button') as HTMLButtonElement
    expect(resolveSessionIdFromAnchor(fakeCtx(), trigger)).toBe('s-1')
  })

  it('returns null without a matching title or trigger', () => {
    const trigger = container.querySelector('button') as HTMLButtonElement
    trigger.setAttribute('aria-label', '会话“不存在的会话”的操作')
    expect(resolveSessionIdFromAnchor(fakeCtx(), trigger)).toBeNull()
    expect(resolveSessionIdFromAnchor(fakeCtx(), null)).toBeNull()
  })
})

describe('injectDeleteRow', () => {
  it('injects one cloned danger row and never double-injects', () => {
    const menu = openMenu()
    const row = injectDeleteRow(menu, t)
    expect(row).not.toBeNull()
    expect(row?.hasAttribute('data-dsh-sidebar-delete-row')).toBe(true)
    expect(row?.textContent).toBe('delete.label')
    expect(menu.querySelectorAll('[data-dsh-sidebar-delete-row]').length).toBe(1)
    expect(injectDeleteRow(menu, t)).toBeNull()
    expect(menu.querySelectorAll('[data-dsh-sidebar-delete-row]').length).toBe(1)
  })
})

describe('installSidebarMenuDom', () => {
  it('opens the session and drives the header delete action from the injected row', async () => {
    const open = vi.fn()
    const dispose = installSidebarMenuDom(fakeCtx(open), t)
    const headerSpan = document.createElement('span')
    headerSpan.setAttribute('data-dsh-part', 'delete-conversation-action')
    const headerButton = document.createElement('button')
    headerButton.setAttribute('aria-label', 'delete.label')
    const headerClicked = vi.fn()
    headerButton.addEventListener('click', headerClicked)
    headerSpan.append(headerButton)
    document.body.append(headerSpan)

    const trigger = container.querySelector('button') as HTMLButtonElement
    const menu = openMenu()
    await act(async () => {
      trigger.click()
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    const injected = menu.querySelector('button[data-dsh-sidebar-delete-row]') as HTMLButtonElement
    expect(injected).not.toBeNull()
    await act(async () => {
      injected.click()
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    expect(open).toHaveBeenCalledWith('s-1')
    expect(headerClicked).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('ignores unrelated buttons', async () => {
    const dispose = installSidebarMenuDom(fakeCtx(), t)
    const unrelated = document.createElement('button')
    unrelated.setAttribute('aria-label', '普通按钮')
    document.body.append(unrelated)
    const menu = openMenu()
    await act(async () => {
      unrelated.click()
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    expect(menu.querySelector('[data-dsh-sidebar-delete-row]')).toBeNull()
    dispose()
  })
})
