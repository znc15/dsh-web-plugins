// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SkinCenter } from '../src/client/SkinCenter.tsx'
import { zh, type SkinCenterKey } from '../src/client/locales.ts'

;((globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT) = true

const t = (key: SkinCenterKey): string => zh[key] ?? key

const noDirs: string[] = []
const whale = {
  origin: 'user' as const,
  warnings: [],
  manifest: {
    id: 'whale-song', name: '鲸吟', nameEn: 'Whale Song', tagline: 'Whale Song skin',
    contributes: {
      stylesheet: 'skin.css',
      backgroundMedia: [{ src: 'whale-art.webp', type: 'image' as const }],
    },
  },
}

let root: Root
let host: HTMLDivElement

async function renderSkinCenter(options: {
  active?: string | null
  wallpaperSelection?: string
  clearSelection?: () => void
  switchTo?: (id: string | null, state: { active: string | null }) => Promise<string | null>
  runSkin?: (action: () => Promise<string | null>) => Promise<string | null>
  setEnabled?: (value: boolean) => void
} = {}): Promise<void> {
  const active = options.active ?? null
  const controllerState = { active, trying: null, previewing: false }
  const themeSnapshot = { active: { colorScheme: 'light' } }
  const catalog = [whale]
  const runtime = {
    controller: {
      active,
      layers: {},
      getState: () => controllerState,
      subscribe: () => () => {},
      tryOn: async () => null,
      exitTryOn: async () => null,
      switchTo: options.switchTo === undefined
        ? async id => id
        : id => options.switchTo!(id, controllerState),
      refresh: async () => null,
      shutdown: () => {},
    },
    catalog: () => catalog,
    diagnostics: () => [],
    refreshCatalog: async () => {},
    find: (id: string) => catalog.find(entry => entry.manifest.id === id) ?? null,
    subscribe: () => () => {},
    shutdown: () => {},
  }
  const wallpaper = {
    enabled: () => true, selection: () => options.wallpaperSelection ?? '', mode: () => 'live', fit: () => 'cover', dim: () => 0,
    wallpaperBlur: () => 0, wallpaperOpacity: () => 100, pauseOnHidden: () => false, sound: () => false, volume: () => 100,
    dirs: () => noDirs, addDir: () => {}, removeDir: () => {}, activeId: () => null, trying: () => false,
    subscribe: () => () => {}, setEnabled: () => {}, setMode: () => {}, setFit: () => {}, setDim: () => {},
    setBlur: () => {}, setOpacity: () => {}, setPauseOnHidden: () => {}, setSound: () => {}, setVolume: () => {},
    applySelection: () => {}, clearSelection: options.clearSelection ?? (() => {}), sync: () => {}, tryOn: () => {}, exitTryOn: () => {},
    recoverScenePlayer: () => {}, dispose: () => {},
  }
  await act(async () => {
    root.render(<SkinCenter
      t={t as never}
      runtime={runtime as never}
      preview={{
        runSkin: options.runSkin ?? (async action => await action()),
      } as never}
      theme={{
        getTheme: () => themeSnapshot as never,
        subscribe: () => () => {},
        setTheme: () => {},
      }}
      background={{
        enabled: () => true, opacity: () => 0, blurEmpty: () => 0, blurContent: () => 0,
        inputCardBlur: () => 10, bubbleOpacity: () => 50, subscribe: () => () => {},
        setEnabled: options.setEnabled ?? (() => {}), set: () => {},
        setBlurEmpty: () => {}, setBlurContent: () => {}, setInputCardBlur: () => {},
        setBubbleOpacity: () => {},
        dispose: () => {},
      }}
      wallpaper={wallpaper as never}
      customTheme={{
        subscribe: () => () => {},
        getState: () => ({ applied: false, previewing: false, visible: false, writeError: null }),
        deactivate: async () => {},
      } as never}
    />)
  })
}

function cardNamed(name: string): HTMLElement {
  const label = Array.from(host.querySelectorAll('span')).find(node => node.textContent === name)
  const card = label?.parentElement?.parentElement
  if (!(card instanceof HTMLElement)) throw new Error('missing ' + name + ' card')
  return card
}

function buttonNamed(card: ParentNode, name: string): HTMLButtonElement {
  const button = Array.from(card.querySelectorAll('button')).find(node => node.textContent === name)
  if (button === undefined) throw new Error('missing ' + name + ' button')
  return button
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = '<div id="root"></div>'
  host = document.getElementById('root') as HTMLDivElement
  root = createRoot(host)
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, installDir: null, total: 0, portableCount: 0, wallpapers: [] }),
  })))
})

afterEach(() => {
  act(() => { root.unmount() })
  vi.unstubAllGlobals()
})

describe('SkinCenter minimal card', () => {
  it('renders only the switch, the stock look, Whale Song and the theme toggle', async () => {
    await renderSkinCenter()

    expect(host.querySelector('[role="switch"]')).not.toBeNull()
    expect(host.textContent).toContain(t('themeLight'))
    expect(host.textContent).toContain(t('themeDark'))
    expect(cardNamed(t('official')).textContent).toContain(t('officialTagline'))
    const whaleCard = cardNamed('Whale Song')
    expect(whaleCard.textContent).toContain('Whale Song skin')

    // No sliders, no wallpaper panel, no custom-theme card in the minimal card.
    expect(host.querySelector('input[type="range"]')).toBeNull()
    expect(host.querySelector('[data-dsh-custom-theme-card]')).toBeNull()
    expect(host.textContent).not.toContain(t('customThemeTitle'))
  })

  it('applies Whale Song through the atomic switch and clears wallpaper', async () => {
    const calls: Array<string | null> = []
    const clearSelection = vi.fn()
    await renderSkinCenter({
      wallpaperSelection: 'macos-aerial',
      clearSelection,
      switchTo: async (id, state) => {
        calls.push(id)
        state.active = id
        return id
      },
    })

    await click(buttonNamed(cardNamed('Whale Song'), t('apply')))

    expect(calls).toEqual(['whale-song'])
    expect(clearSelection).toHaveBeenCalledTimes(1)
  })

  it('restores the official default look and clears wallpaper', async () => {
    const calls: Array<string | null> = []
    const clearSelection = vi.fn()
    await renderSkinCenter({
      active: 'whale-song',
      wallpaperSelection: 'macos-aerial',
      clearSelection,
      switchTo: async (id, state) => {
        calls.push(id)
        state.active = id
        return id
      },
    })

    await click(buttonNamed(cardNamed(t('official')), t('restore')))

    expect(calls).toEqual([null])
    expect(clearSelection).toHaveBeenCalledTimes(1)
  })

  it('keeps the official card marked active when no skin is selected', async () => {
    await renderSkinCenter({ active: null })

    expect(cardNamed(t('official')).textContent).toContain(t('active'))
    expect(cardNamed('Whale Song').textContent).not.toContain(t('active'))
  })

  it('toggles the enable switch', async () => {
    const setEnabled = vi.fn()
    await renderSkinCenter({ setEnabled })

    const input = host.querySelector('[role="switch"]')
    if (!(input instanceof HTMLButtonElement)) throw new Error('missing switch')
    await click(input)

    expect(setEnabled).toHaveBeenCalledWith(false)
  })
})
