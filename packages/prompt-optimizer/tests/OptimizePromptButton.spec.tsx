/**
 * OptimizePromptButton interaction tests: empty/busy gating, the
 * optimization request shape, and draft replacement on success.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { OptimizePromptButton, OPTIMIZE_PATH, type OptimizePromptButtonProps } from '../src/client/OptimizePromptButton.tsx'

interface FakeInputState {
  draft: string
}

function makeUseInput(seed: string): [(selector: (s: FakeInputState) => unknown) => unknown, (draft: string) => void] {
  let state: FakeInputState = { draft: seed }
  const select = (selector: (s: FakeInputState) => unknown): unknown => selector(state)
  const setDraft = (draft: string): void => { state = { draft } }
  return [select, setDraft]
}

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

function render(props: OptimizePromptButtonProps): void {
  act(() => {
    root.render(<OptimizePromptButton {...props} />)
  })
}

describe('OptimizePromptButton', () => {
  it('posts the draft and replaces it with the optimized text', async () => {
    const [useInput, setDraft] = makeUseInput('把这段写清楚一点')
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true, optimized: '优化后的版本' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const props = {
      sessionId: 'session-7',
      useInput,
      inputActions: { setDraft },
      t: ((key: string) => key),
    } as unknown as OptimizePromptButtonProps
    render(props)

    const button = container.querySelector('button') as HTMLButtonElement
    expect(button.getAttribute('aria-label')).toBe('optimize.label')
    await act(async () => button.click())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0]?.[0]
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(url).toBe(OPTIMIZE_PATH)
    expect(JSON.parse(String(init?.body))).toEqual({ sessionId: 'session-7', prompt: '把这段写清楚一点' })
    expect(useInput((state) => state.draft)).toBe('优化后的版本')
  })

  it('refuses an empty draft without calling the route', () => {
    const [useInput] = makeUseInput('   ')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const props = {
      sessionId: 'session-7',
      useInput,
      inputActions: { setDraft: () => {} },
      t: ((key: string) => key),
    } as unknown as OptimizePromptButtonProps
    render(props)

    const button = container.querySelector('button') as HTMLButtonElement
    act(() => button.click())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps a no-model-route response to the localized error', async () => {
    const [useInput] = makeUseInput('hello')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: false, code: 'no-model-route', message: 'no route' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const props = {
      sessionId: 'session-7',
      useInput,
      inputActions: { setDraft: () => {} },
      t: ((key: string) => key),
    } as unknown as OptimizePromptButtonProps
    render(props)

    const button = container.querySelector('button') as HTMLButtonElement
    await act(async () => button.click())
    expect(document.body.textContent).toContain('optimize.noRoute')
  })
})
