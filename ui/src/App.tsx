import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import {
  fetchSurface,
  postMemory,
  refreshSurface,
  sendChat,
  type SurfaceSnapshot,
  type SurfaceTurn,
} from './api'

export function App() {
  const [snap, setSnap] = useState<SurfaceSnapshot | null>(null)
  const [turns, setTurns] = useState<SurfaceTurn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [pending, startTransition] = useTransition()
  const listRef = useRef<HTMLDivElement>(null)
  const booted = useRef(false)

  function applySnap(data: SurfaceSnapshot) {
    setSnap(data)
    setTurns(data.turns)
    setError(null)
  }

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void (async () => {
      try {
        const data = await fetchSurface()
        startTransition(() => applySnap(data))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [turns])

  async function onRefresh() {
    setError(null)
    try {
      const data = await refreshSurface()
      startTransition(() => applySnap(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onRecallMemory() {
    setError(null)
    try {
      const data = await postMemory({
        action: 'recall',
        workspaceId: snap?.memory.workspaceId,
      })
      startTransition(() => applySnap(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault()
    const message = draft.trim()
    if (!message || sending) return
    setSending(true)
    setError(null)
    setDraft('')
    setTurns((prev) => [
      ...prev,
      {
        role: 'user',
        content: message,
        at: new Date().toISOString(),
      },
    ])
    try {
      const out = await sendChat(message)
      startTransition(() => applySnap(out))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  const attention = snap?.governance.attention ?? []
  const errors = attention.filter((a) => a.severity === 'error').length
  const warns = attention.filter((a) => a.severity === 'warn').length
  const consumption = snap?.governance.consumption
  const memory = snap?.memory

  return (
    <div className="stage">
      <div className="glow" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <main className="compose">
        <header className="brand-block">
          <p className="brand">Companion</p>
          <h1 className="lede">Talk with the control plane.</h1>
          <p className="sub">
            One surface — conversation first. AIOS still governs.
          </p>
        </header>

        <div className="state-line" aria-label="Operational summary">
          <span className={`pulse ${snap?.governance.hasErrors ? 'bad' : 'ok'}`} />
          <span className="state-text">
            {snap?.operational.summary || (error ? 'Surface offline' : 'Connecting…')}
          </span>
          {snap?.operational.branch && (
            <span className="state-meta">{snap.operational.branch}</span>
          )}
          {consumption && (
            <span className={`chip ${consumption.tone}`} title="provider.chat consumption">
              {consumption.label}
            </span>
          )}
          <button
            type="button"
            className="ghost"
            onClick={() => void onRefresh()}
            disabled={pending}
          >
            Refresh
          </button>
        </div>

        {error && (
          <p className="banner" role="alert">
            {error}. Start with <code>companion surface</code> or{' '}
            <code>pnpm surface</code> (API :8790).
          </p>
        )}

        <section className="chat" aria-label="Conversation">
          <div className="transcript" ref={listRef}>
            {turns.length === 0 && (
              <p className="empty">
                Ask for status, remember a note with{' '}
                <code>/memory remember …</code>, or run an analysis — pipeline
                intents route to AIOS.
              </p>
            )}
            {turns.map((t, i) => (
              <article
                key={`${t.at}-${i}`}
                className={`bubble ${t.role}`}
              >
                <p>{t.content}</p>
                {t.via && <span className="via">{t.via}</span>}
              </article>
            ))}
          </div>

          <form className="composer" onSubmit={(e) => void onSend(e)}>
            <label className="sr-only" htmlFor="msg">
              Message
            </label>
            <input
              id="msg"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message Companion… (/memory)"
              autoComplete="off"
              disabled={sending}
            />
            <button type="submit" disabled={sending || !draft.trim()}>
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </section>

        <aside className="rail" aria-label="Attention and memory">
          <div className="attention">
            <div className="att-head">
              <h2>Attention</h2>
              <span>
                {errors} err · {warns} warn
              </span>
            </div>
            {attention.length === 0 ? (
              <p className="att-empty">Nothing flagged — refresh after control-plane changes.</p>
            ) : (
              <ul>
                {attention.slice(0, 6).map((a, i) => (
                  <li key={a.id || `${a.title}-${i}`} className={a.severity || 'info'}>
                    <strong>{a.title || a.id || 'Item'}</strong>
                    {a.detail && <span>{a.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
            {snap?.governance.providerOk !== undefined && (
              <p className="att-foot">
                Provider {snap.governance.providerOk ? 'up' : 'down'}
                {snap.governance.providers?.length
                  ? ` · ${snap.governance.providers.join(', ')}`
                  : ''}
              </p>
            )}
          </div>

          <div className="memory">
            <div className="att-head">
              <h2>Memory</h2>
              <button
                type="button"
                className="ghost"
                onClick={() => void onRecallMemory()}
                disabled={pending}
              >
                Recall
              </button>
            </div>
            <p className="mem-summary">
              {memory?.summary || 'Not loaded'}
              {memory?.workspaceId ? ` · ${memory.workspaceId}` : ''}
            </p>
            {!memory?.entries.length ? (
              <p className="att-empty">
                Empty — try <code>/memory remember …</code> in chat.
              </p>
            ) : (
              <ul>
                {memory.entries.map((e, i) => (
                  <li key={e.id || `${e.at}-${i}`}>
                    <span>{(e.content || '').slice(0, 140)}</span>
                    {e.tags?.length ? (
                      <em>{e.tags.join(', ')}</em>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
