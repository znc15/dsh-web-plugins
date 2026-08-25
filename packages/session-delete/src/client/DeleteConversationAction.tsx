/**
 * Delete-conversation action: a trash entry in the session header action
 * row that opens the shared confirmation dialog. On confirm the browser
 * POSTs the current session id to the host deletion route; the host detaches
 * the live session (which makes the api proxy publish host/session-removed,
 * so the row drops and the selection clears to the New Session view) and
 * removes the durable log files. Sessions that are running are refused
 * host-side with a clear message.
 */

import { memo, useState } from 'react'
import type { PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { IconTrashOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionDeleteKey } from './locales.ts'
import { DeleteConversationDialog } from './DeleteConversationDialog.tsx'
import styles from './delete.module.css'

export type DeleteConversationActionProps = PropsRuntime<'conversation.session.header.actions'> & {
  t: TranslateNS<'session-delete'>
}

export const DeleteConversationAction = memo(function DeleteConversationAction(
  props: DeleteConversationActionProps,
): React.JSX.Element {
  const { sessionId, useSession, t } = props
  const running = useSession((s) => s.running) ?? false
  const [confirming, setConfirming] = useState(false)

  return (
    <span data-dsh-plugin="session-delete" data-dsh-part="delete-conversation-action">
      <Tooltip label={running ? t('delete.busy') : t('delete.hint')} side="bottom">
        <button
          type="button"
          className={styles.action}
          aria-label={t('delete.label')}
          disabled={running}
          onClick={() => setConfirming(true)}
        >
          <IconTrashOutline16 size={14} />
          <span className={styles.label}>{t('delete.label')}</span>
        </button>
      </Tooltip>
      {sessionId !== undefined && (
        <DeleteConversationDialog
          sessionId={sessionId}
          open={confirming}
          onClose={() => setConfirming(false)}
          t={t}
        />
      )}
    </span>
  )
})

export { DELETE_PATH } from './DeleteConversationDialog.tsx'
export type { SessionDeleteKey }
