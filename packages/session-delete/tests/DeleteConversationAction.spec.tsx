/**
 * DeleteConversationAction interaction tests: confirmation gating, the
 * deletion request shape, and the running/busy/error paths.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DeleteConversationAction, DELETE_PATH, type DeleteConversationActionProps } from '../src/client/DeleteConversationAction.tsx'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function propsFor(overrides: Partial<DeleteConversationActionProps> = {}): DeleteConversationActionProps {
  return {
    sessionId: 'session-42' as never,
    useSession: (() => false) as never,
    t: ((key: string) => key) as never,
    ...overrides,
  } as DeleteConversationActionProps
}

function render(props: DeleteConversationActionProps): void {
  act(() => {
    root.render(<DeleteConversationAction {...props} />)
  })
}

function confirmButton(): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('delete.confirm'),
  )
}

describe('DeleteConversationAction', () => {
  it('opens the confirmation modal and keeps the confirm button gated on acknowledgement', () => {
    render(propsFor())
    const trigger = container.querySelector('button') as HTMLButtonElement
    expect(trigger.getAttribute('aria-label')).toBe('delete.label')

    act(() => trigger.click())
    const ack = document.body.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(document.body.textContent).toContain('delete.confirmTitle')
    expect(ack).not.toBeNull()

    expect(confirmButton()?.disabled).toBe(true)
    act(() => ack.click())
    expect((document.body.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true)
    expect(confirmButton()?.disabled).toBe(false)
  })

  it('posts the session id to the deletion route on confirm', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true, removed: ['session-42'] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(propsFor())
    act(() => (container.querySelector('button') as HTMLButtonElement).click())
    act(() => (document.body.querySelector('input[type="checkbox"]') as HTMLInputElement).click())
    await act(async () => confirmButton()?.click())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(DELETE_PATH)
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body))).toEqual({ sessionId: 'session-42' })
  })

  it('surfaces the busy copy when the host refuses a running session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      code: 'session-busy',
      message: 'session-busy',
    }), { status: 409, headers: { 'content-type': 'application/json' } })))

    render(propsFor())
    act(() => (container.querySelector('button') as HTMLButtonElement).click())
    act(() => (document.body.querySelector('input[type="checkbox"]') as HTMLInputElement).click())
    await act(async () => confirmButton()?.click())

    expect(document.body.textContent).toContain('delete.busy')
  })

  it('disables the trigger while the session is running', () => {
    render(propsFor({ useSession: (() => true) as never }))
    const trigger = container.querySelector('button') as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
  })
})
