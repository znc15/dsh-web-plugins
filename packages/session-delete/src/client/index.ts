/**
 * session-delete — browser half. Registers the session-delete dictionaries
 * and two delete-conversation affordances:
 *
 *  - the session header action row (`conversation.session.header.actions`)
 *    plus its confirmation modal, and
 *  - the sidebar session-row ellipsis menu: the official workspace bundle
 *    hard-codes its menu items, so the workspace bundle's Menu is wrapped
 *    (per-factory require patch) to add a destructive delete row that opens
 *    the same dialog.
 *
 * The destructive work happens host-side (POST
 * /api/session-delete/v1/delete); the browser only confirms and reflects
 * errors, so an external plugin can never lose data by itself.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { DeleteConversationAction } from './DeleteConversationAction.tsx'
import { en, zh, type SessionDeleteKey } from './locales.ts'
import { installSidebarMenuDom } from './SidebarMenuPatch.tsx'
import { reportDailyHeartbeat } from './telemetry.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** session-delete surface copy. */
    'session-delete': SessionDeleteKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'session-delete'

/** Unique occupant id inside the shared header-actions list slot. */
const ENTRY_ID = 'session-delete'

/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'sessions']

/**
 * Register the session-delete surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // Anonymous install heartbeat (docs/telemetry.md): one beat per browser per
  // UTC day, package name only, silent failure.
  reportDailyHeartbeat([{ name: '@linxin666/dsh-client-ui-session-delete' }])

  ctx.effect(() => {
    try {
      return ctx.locale.register(NS, { zh, en })
    } catch {
      return () => {}
    }
  }, 'session-delete: dictionaries')

  ctx.slots.inject('conversation.session.header.actions', () => {
    try {
      return ctx.slots.register({
        name: 'conversation.session.header.actions',
        id: ENTRY_ID,
        order: 1000,
        locale: NS,
        inject: () => ({}),
      }, DeleteConversationAction)
    } catch {
      return () => {}
    }
  })

  ctx.effect(() => {
    return installSidebarMenuDom(ctx, ctx.locale.bind(NS))
  }, 'session-delete: sidebar row menu')
}

export type { DeleteConversationActionProps } from './DeleteConversationAction.tsx'
export { DeleteConversationDialog, DELETE_PATH } from './DeleteConversationDialog.tsx'
export { installSidebarMenuDom, injectDeleteRow, resolveSessionIdFromAnchor, SIDEBAR_DELETE_ENTRY_ID } from './SidebarMenuPatch.tsx'
export type { SessionDeleteKey } from './locales.ts'
