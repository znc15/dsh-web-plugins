/**
 * Sidebar row-menu delete entry (DOM seat).
 *
 * The official workspace bundle builds its session-row ellipsis menu
 * (rename / fork / archive) with a hard-coded item list and there is no
 * public slot or writable module surface to add a delete entry (the
 * primitives bundle ships as a frozen seed namespace). This module instead
 * seats the delete row at the DOM level with stable semantic hooks:
 *
 *  - a capture-phase click listener recognises the session-row ellipsis by
 *    its aria-label (the workspace menu is the only actions menu whose
 *    label quotes a session title) and resolves the session id from the
 *    browser sessions store at click time;
 *  - on the next frame it injects a destructive "delete conversation" row
 *    into the open `[role="menu"]` portal, cloning the menu's own row
 *    styling so the entry blends in;
 *  - clicking the injected row opens that session (so its header renders)
 *    and programmatically clicks the header's delete action — the same
 *    official confirmation dialog, one flow, no second React root.
 *
 * The row is marked with a data attribute so repeated opens never double
 * inject, and the listener is removed on dispose.
 */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionDeleteKey } from './locales.ts'

/** Item id of the injected delete row. */
export const SIDEBAR_DELETE_ENTRY_ID = 'ui-session-delete-sidebar'

/** Row marker attribute set on the injected menu row (idempotency + click target). */
const ROW_ATTR = 'data-dsh-sidebar-delete-row'
/** Selector form of ROW_ATTR (querySelector/closest need the brackets). */
const ROW_SELECTOR = '[' + ROW_ATTR + ']'

/** The header delete affordance injected by this plugin's header slot. */
const HEADER_DELETE_SELECTOR = '[data-dsh-part="delete-conversation-action"] button[aria-label]'

/** The browser session-list rows this patch reads (structural face). */
interface SidebarSessionRow {
  id: SessionId
  displayTitle: string
  blank?: boolean
}

/** The browser session-list snapshot this patch reads (structural face). */
interface SidebarSessionsSnapshot {
  ids: SessionId[]
  byId: Record<string, SidebarSessionRow>
}

/**
 * Whether the given button is the workspace session-row ellipsis trigger:
 * its aria-label quotes a session title and names an actions menu in either
 * supported locale (the workspace bundle's own copy).
 * @param button - the candidate trigger.
 * @returns true for the row menu trigger.
 */
function isSessionRowTrigger(button: HTMLButtonElement): boolean {
  const label = button.getAttribute('aria-label') ?? ''
  if (!/["“].+[”"]/.test(label)) return false
  return label.includes('的操作') || label.includes('actions for')
}

/**
 * Resolve the session id of the row from the browser sessions store. Exact
 * display-title match first; when titles collide, prefer the first non-blank
 * row in host list order.
 * @param ctx - client root context.
 * @param trigger - the ellipsis trigger DOM node of the row.
 * @returns the resolved session id, or null.
 */
export function resolveSessionIdFromAnchor(ctx: ClientContext, trigger: HTMLElement | null): SessionId | null {
  if (trigger === null) return null
  const label = trigger.getAttribute('aria-label')
  let title: string | null = null
  if (label !== null) {
    const quoted = /["“]([^"”]*)["”]/.exec(label)
    if (quoted !== null && quoted[1].trim() !== '') title = quoted[1].trim()
  }
  if (title === null) {
    const row = trigger.closest('[role="treeitem"]')
    const spans = row?.querySelectorAll('span') ?? []
    for (const span of Array.from(spans)) {
      const text = span.textContent?.trim()
      if (text !== undefined && text !== '') { title = text; break }
    }
  }
  if (title === null) return null
  // The browser sessions face is an observable store; the cordis Context
  // merge also carries the host SessionStore in this package's type scope,
  // so the store is read through a structural narrowing instead.
  const listValue = (ctx.sessions as unknown as { list?: unknown }).list
  if (typeof listValue !== 'object' || listValue === null) return null
  const getSnapshot = (listValue as { getSnapshot?: unknown }).getSnapshot
  if (typeof getSnapshot !== 'function') return null
  const snapshot = (getSnapshot as () => SidebarSessionsSnapshot)()
  if (snapshot === null || typeof snapshot !== 'object') return null
  const matches: Array<{ id: SessionId; displayTitle: string; blank?: boolean }> = snapshot.ids
    .map((id) => snapshot.byId[id])
    .filter((summary) => summary !== undefined && summary.displayTitle === title)
  const best = matches.find((summary) => !summary.blank) ?? matches[0]
  return best?.id ?? null
}

/**
 * Pick a template row from the open menu to clone: prefer a real menu item,
 * then any interactive row element.
 * @param menu - the open menu portal.
 * @returns the template element, or null when the menu has no rows.
 */
function templateRow(menu: Element): HTMLElement | null {
  const item =
    menu.querySelector('[role="menuitem"]') ??
    menu.querySelector('button') ??
    menu.querySelector('li') ??
    menu.querySelector('div')
  return item instanceof HTMLElement ? item : null
}

/**
 * Inject the delete row into the open menu once. No-op when the row is
 * already present or no template can be cloned.
 * @param menu - the open menu portal.
 * @param t - session-delete locale seat.
 * @returns the injected row, or null.
 */
export function injectDeleteRow(menu: Element, t: TranslateNS<'session-delete'>): HTMLElement | null {
  if (menu.querySelector(ROW_SELECTOR) !== null) return null
  const template = templateRow(menu)
  if (template === null) return null
  const row = template.cloneNode(false) as HTMLElement
  row.textContent = t('delete.label')
  row.setAttribute(ROW_ATTR, '')
  row.setAttribute('data-dsh-plugin', 'session-delete')
  row.setAttribute('role', 'menuitem')
  row.setAttribute('title', t('delete.hint'))
  row.style.color = 'var(--dsw-alias-state-error-primary)'
  menu.appendChild(row)
  return row
}

/**
 * Install the sidebar delete-row seat.
 * @param ctx - client root context.
 * @param t - session-delete locale seat.
 * @returns a disposer removing the DOM listener.
 */
export function installSidebarMenuDom(ctx: ClientContext, t: TranslateNS<'session-delete'>): () => void {
  if (typeof document === 'undefined') return () => {}

  const closeMenu = (): void => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }

  const onDeleteRowClick = (sessionId: SessionId, event: Event): void => {
    event.preventDefault()
    event.stopPropagation()
    // Open the target session so its header (and the official delete
    // affordance) renders, then drive the official confirmation dialog.
    // The call must stay a method call on the context proxy: extracting the
    // function loses the cordis this-rebinding that resolves the manager.
    const sessions = ctx.sessions as unknown as { open?: (id: SessionId) => void }
    if (typeof sessions.open !== 'function') {
      closeMenu()
      return
    }
    try {
      sessions.open(sessionId)
    } catch {
      // Selection update failed; the dialog would target the wrong session,
      // so leave the stock menu state untouched.
      closeMenu()
      return
    }
    // The header delete affordance renders after the session opens; poll
    // briefly for the enabled trigger instead of racing React's commit.
    const deadline = Date.now() + 2_000
    const attempt = (): void => {
      const trigger = document.querySelector<HTMLButtonElement>(HEADER_DELETE_SELECTOR)
      if (trigger !== null && !trigger.disabled) {
        trigger.click()
        return
      }
      if (Date.now() < deadline) window.setTimeout(attempt, 25)
    }
    attempt()
    closeMenu()
  }

  const onCaptureClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null
    if (target === null || typeof target.closest !== 'function') return
    // Our injected row: dispatch through its own click listener (bubble
    // phase registered below).
    if (target.closest(ROW_SELECTOR) !== null) return
    const trigger = target.closest('button[aria-label]') as HTMLButtonElement | null
    if (trigger === null || !isSessionRowTrigger(trigger)) return
    const row = trigger.closest('[role="treeitem"]')
    if (row === null) return
    const sessionId = resolveSessionIdFromAnchor(ctx, trigger)
    if (sessionId === null) return
    // The Menu portal renders after this event; seat the delete row then.
    window.setTimeout(() => {
      const menu = document.querySelector('[role="menu"]')
      if (menu === null) return
      const injected = injectDeleteRow(menu, t)
      if (injected === null) return
      injected.addEventListener('click', (event) => onDeleteRowClick(sessionId, event))
    }, 0)
  }

  document.addEventListener('click', onCaptureClick, true)
  return () => {
    document.removeEventListener('click', onCaptureClick, true)
  }
}
