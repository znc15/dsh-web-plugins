/**
 * Delete-conversation confirmation dialog: the shared modal used by the
 * session header action and the sidebar row menu. On confirm the browser
 * POSTs the session id to the host deletion route; the host detaches the
 * live session (which makes the api proxy publish host/session-removed, so
 * the row drops and the selection clears to the New Session view) and
 * removes the durable log files. Sessions that are running are refused
 * host-side with a clear message.
 */

import { useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconTrashOutline16, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionDeleteKey } from './locales.ts'
import styles from './delete.module.css'

/** Deletion route literal (shared with the host half contract). */
export const DELETE_PATH = '/api/session-delete/v1/delete'

export interface DeleteConversationDialogProps {
  /** The session to delete. */
  sessionId: string
  /** Whether the dialog is showing. */
  open: boolean
  /** Close without deleting (Escape / mask / cancel). */
  onClose: () => void
  /** Locale seat of the owning plugin. */
  t: TranslateNS<'session-delete'>
}

/**
 * The confirmation modal body plus the deletion request. The caller mounts
 * it wherever the affordance lives (header action or sidebar menu).
 */
export function DeleteConversationDialog(props: DeleteConversationDialogProps): React.JSX.Element {
  const { sessionId, open, onClose, t } = props
  const [busy, setBusy] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = (): void => {
    setBusy(false)
    setAcknowledged(false)
    setError(null)
    onClose()
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
    <Modal
      open={open}
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
            icon={<IconTrashOutline16 size={14} />}
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
  )
}
