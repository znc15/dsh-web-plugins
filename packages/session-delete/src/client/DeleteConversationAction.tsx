/**
 * Delete-conversation action: a trash entry in the session header action
 * row plus a confirmation modal. On confirm the browser POSTs the current
 * session id to the host deletion route; the host detaches the live session
 * (which makes the api proxy publish host/session-removed, so the row drops
 * and the selection clears to the New Session view) and removes the durable
 * log files. Sessions that are running are refused host-side with a clear
 * message.
 */

import { memo, useState } from 'react'
import type { PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Button,
  IconTrashOutline16,
  Modal,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionDeleteKey } from './locales.ts'
import styles from './delete.module.css'

/** Deletion route literal (shared with the host half contract). */
export const DELETE_PATH = '/api/session-delete/v1/delete'

export type DeleteConversationActionProps = PropsRuntime<'conversation.session.header.actions'> & {
  t: TranslateNS<'session-delete'>
}

export const DeleteConversationAction = memo(function DeleteConversationAction(
  props: DeleteConversationActionProps,
): React.JSX.Element {
  const { sessionId, useSession, t } = props
  const running = useSession((s) => s.running) ?? false
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = (): void => {
    setConfirming(false)
    setAcknowledged(false)
    setError(null)
  }

  const confirmDelete = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(DELETE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await response.json().catch(() => null) as
        | { ok?: unknown; code?: unknown; message?: unknown }
        | null
      if (!response.ok || data === null || data.ok !== true) {
        const code = data !== null && typeof data.code === 'string' ? data.code : ''
        const message = data !== null && typeof data.message === 'string' ? data.message : ''
        if (code === 'session-busy') setError(t('delete.busy'))
        else if (code === 'session-not-found') setError(message !== '' ? message : t('delete.failed'))
        else setError(message !== '' ? message : t('delete.failed'))
        setBusy(false)
        return
      }
      // Success: the host frame removes the row and the selection clears to
      // the New Session view; this session-scoped component unmounts.
    } catch {
      setError(t('delete.failed'))
      setBusy(false)
    }
  }

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
          <IconTrashOutline16 />
          <span className={styles.label}>{t('delete.label')}</span>
        </button>
      </Tooltip>
      <Modal
        open={confirming}
        onClose={reset}
        closeLabel={t('delete.cancel')}
        title={t('delete.confirmTitle')}
        description={t('delete.confirmDescription')}
        footer={
          <>
            <Button variant="outline" size="md" onClick={reset}>
              {t('delete.cancel')}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<IconTrashOutline16 />}
              disabled={!acknowledged || busy}
              onClick={() => void confirmDelete()}
            >
              {busy ? t('delete.deleting') : t('delete.confirm')}
            </Button>
          </>
        }
      >
        <label className={styles.acknowledge}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>{t('delete.acknowledge')}</span>
        </label>
        {error !== null && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
      </Modal>
    </span>
  )
})

export type { SessionDeleteKey }
