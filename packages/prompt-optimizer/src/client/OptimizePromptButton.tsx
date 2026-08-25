/**
 * Optimize-prompt button: the composer tool-row entry rendered just left of
 * the context meter (`conversation.input.right`). On click it POSTs the
 * current draft to the host optimization route and replaces the draft with
 * the returned text through `inputActions.setDraft`.
 */

import { memo, useRef, useState } from 'react'
import type { PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { IconEnhanceOutline16, IconLoadingOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PromptOptimizerKey } from './locales.ts'
import styles from './optimize.module.css'

/** Optimization route literal (shared with the host half contract). */
export const OPTIMIZE_PATH = '/api/prompt-optimizer/v1/optimize'

/** How long a transient error caption stays visible (ms). */
const ERROR_CAPTION_MS = 4_000

export type OptimizePromptButtonProps = PropsRuntime<'conversation.input.right'> & {
  t: TranslateNS<'prompt-optimizer'>
}

export const OptimizePromptButton = memo(function OptimizePromptButton(
  props: OptimizePromptButtonProps,
): React.JSX.Element {
  const { sessionId, useInput, inputActions, t } = props
  const draft = useInput((state) => state.draft) ?? ''
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorTimer = useRef<number | null>(null)

  const showError = (message: string): void => {
    setError(message)
    if (errorTimer.current !== null) window.clearTimeout(errorTimer.current)
    errorTimer.current = window.setTimeout(() => setError(null), ERROR_CAPTION_MS)
  }

  const optimize = async (): Promise<void> => {
    if (busy || sessionId === undefined) return
    const prompt = draft.trim()
    if (prompt === '') {
      showError(t('optimize.empty'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(OPTIMIZE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, prompt }),
      })
      const data = await response.json().catch(() => null) as
        | { ok?: unknown; code?: unknown; message?: unknown; optimized?: unknown }
        | null
      if (!response.ok || data === null || data.ok !== true) {
        const code = data !== null && typeof data.code === 'string' ? data.code : ''
        const message = data !== null && typeof data.message === 'string' ? data.message : ''
        if (code === 'no-model-route') showError(t('optimize.noRoute'))
        else showError(message !== '' ? message : t('optimize.failed'))
        return
      }
      if (typeof data.optimized !== 'string' || data.optimized === '') {
        showError(t('optimize.failed'))
        return
      }
      inputActions?.setDraft(data.optimized)
    } catch {
      showError(t('optimize.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={styles.wrap} data-dsh-plugin="prompt-optimizer" data-dsh-part="optimize-prompt-button">
      <Tooltip label={busy ? t('optimize.busy') : t('optimize.hint')} side="top" delayMs={500}>
        <button
          type="button"
          className={styles.root}
          aria-label={t('optimize.label')}
          disabled={busy || sessionId === undefined}
          onClick={() => void optimize()}
        >
          {busy ? <IconLoadingOutline16 size={16} className={styles.spinner} /> : <IconEnhanceOutline16 size={16} />}
        </button>
      </Tooltip>
      {error !== null && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </span>
  )
})
