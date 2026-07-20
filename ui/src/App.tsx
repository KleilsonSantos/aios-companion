import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import {
  SignalRail,
  signalFromPhaseOrVia,
  type SignalKind,
} from './SignalRail'
import { AttentionField } from './AttentionField'
import { AgentGraph, type PipelineGraphData } from './AgentGraph'
import { DoctorField } from './DoctorField'
import { GovAuditField } from './GovAuditField'
import {
  fetchSurface,
  fetchWorkspaces,
  postDoctor,
  postGovAudit,
  postMemory,
  refreshSurface,
  resetSession,
  selectLocale,
  selectWorkspace,
  sendChatStream,
  type SurfaceSnapshot,
  type SurfaceTurn,
  type SurfaceWorkspace,
} from './api'

export function App() {
  const [snap, setSnap] = useState<SurfaceSnapshot | null>(null)
  const [turns, setTurns] = useState<SurfaceTurn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [streamPhase, setStreamPhase] = useState<string | null>(null)
  const [lastSignal, setLastSignal] = useState<SignalKind>('idle')
  const [pipelineLive, setPipelineLive] = useState(false)
  const [doctorRunning, setDoctorRunning] = useState(false)
  const [auditRunning, setAuditRunning] = useState(false)
  const [processOpen, setProcessOpen] = useState(() => {
    try {
      return sessionStorage.getItem('companion.processOpen') === '1'
    } catch {
      return false
    }
  })
  const [wsOpen, setWsOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<SurfaceWorkspace[] | null>(null)
  const [wsLoading, setWsLoading] = useState(false)
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

  useEffect(() => {
    try {
      sessionStorage.setItem('companion.processOpen', processOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [processOpen])

  // Auto-open process panels when something real is happening
  useEffect(() => {
    if (pipelineLive || (sending && lastSignal !== 'idle')) {
      setProcessOpen(true)
    }
  }, [pipelineLive, sending, lastSignal])

  async function onRefresh() {
    setError(null)
    try {
      const data = await refreshSurface()
      startTransition(() => applySnap(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onNewChat() {
    setError(null)
    try {
      const data = await resetSession()
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

  async function onDoctor() {
    setError(null)
    setDoctorRunning(true)
    setProcessOpen(true)
    try {
      const data = await postDoctor()
      startTransition(() => applySnap(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDoctorRunning(false)
    }
  }

  async function onGovAudit() {
    setError(null)
    setAuditRunning(true)
    setProcessOpen(true)
    try {
      const data = await postGovAudit()
      startTransition(() => applySnap(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAuditRunning(false)
    }
  }

  async function onToggleWorkspaces() {
    if (wsOpen) {
      setWsOpen(false)
      return
    }
    setLangOpen(false)
    setWsOpen(true)
    if (workspaces) return
    setWsLoading(true)
    setError(null)
    try {
      const listed = await fetchWorkspaces()
      setWorkspaces(listed.workspaces)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setWsOpen(false)
    } finally {
      setWsLoading(false)
    }
  }

  async function onPickWorkspace(id: string) {
    setError(null)
    setWsOpen(false)
    try {
      const data = await selectWorkspace(id)
      startTransition(() => applySnap(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onPickLocale(locale: 'en' | 'pt') {
    setError(null)
    setLangOpen(false)
    try {
      const data = await selectLocale(locale)
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
    setStreamPhase(null)
    setLastSignal('idle')
    setPipelineLive(false)
    setError(null)
    setDraft('')
    const at = new Date().toISOString()
    setTurns((prev) => [
      ...prev,
      { role: 'user', content: message, at },
      {
        role: 'assistant',
        content: '',
        at: new Date().toISOString(),
      },
    ])
    try {
      const out = await sendChatStream(message, {
        onStatus: (phase) => {
          setStreamPhase(phase)
          setLastSignal(signalFromPhaseOrVia(phase, null))
          setPipelineLive(phase === 'pipeline')
        },
        onDelta: (text) => {
          setTurns((prev) => {
            if (prev.length === 0) return prev
            const next = [...prev]
            const last = next[next.length - 1]
            if (!last || last.role !== 'assistant') return prev
            next[next.length - 1] = {
              ...last,
              content: last.content + text,
            }
            return next
          })
        },
      })
      const via = [...out.turns].reverse().find((t) => t.role === 'assistant')?.via
      setLastSignal(signalFromPhaseOrVia(null, via))
      setPipelineLive(false)
      startTransition(() => applySnap(out))
    } catch (err) {
      setPipelineLive(false)
      setError(err instanceof Error ? err.message : String(err))
      setTurns((prev) => {
        if (prev.length === 0) return prev
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setSending(false)
      setStreamPhase(null)
    }
  }

  const attention = snap?.governance.attention ?? []
  const errors = attention.filter((a) => a.severity === 'error').length
  const warns = attention.filter((a) => a.severity === 'warn').length
  const consumption = snap?.governance.consumption
  const memory = snap?.memory
  const workspaceLabel = memory?.workspaceId || 'workspace'
  const localeLabel = snap?.locale || 'en'
  const lastPipeline = (snap?.lastPipeline ?? null) as PipelineGraphData | null
  const lastDoctor = snap?.lastDoctor ?? null
  const lastGovAudit = snap?.lastGovAudit ?? null

  return (
    <div className="stage">
      <div className="glow" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <main className="compose">
        <header className="brand-block">
          <p className="brand">Companion</p>
          <h1 className="lede">Talk with the control plane.</h1>
          <p className="sub">
            Start with a question. Open Process only when you want the signal
            trail.
          </p>
        </header>

        <div className="state-line" aria-label="Operational summary">
          <span className={`pulse ${snap?.governance.hasErrors ? 'bad' : 'ok'}`} />
          <span className="state-text">
            {snap?.operational.summary || (error ? 'Surface offline' : 'Connecting…')}
          </span>
          <div className="state-actions">
            {snap?.operational.branch && (
              <span className="chip branch" title="Git branch">
                {snap.operational.branch}
              </span>
            )}
            {consumption && (
              <span className={`chip ${consumption.tone}`} title="provider.chat consumption">
                {consumption.label}
              </span>
            )}
            <button
              type="button"
              className={`ghost process-toggle${processOpen ? ' on' : ''}`}
              aria-expanded={processOpen}
              onClick={() => setProcessOpen((v) => !v)}
              title="Show or hide Signal / Attention / Pipeline / Doctor"
            >
              {processOpen ? 'Hide process' : 'Process'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void onDoctor()}
              disabled={pending || doctorRunning || auditRunning}
              title="Run Companion ↔ AIOS doctor (on-demand)"
            >
              {doctorRunning ? 'Doctor…' : 'Doctor'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void onGovAudit()}
              disabled={pending || doctorRunning || auditRunning}
              title="Run aios_governance_audit (on-demand)"
            >
              {auditRunning ? 'Audit…' : 'Audit'}
            </button>
            <div className="ws-wrap">
              <button
                type="button"
                className="chip ws"
                onClick={() => void onToggleWorkspaces()}
                disabled={pending || wsLoading}
                aria-expanded={wsOpen}
                title="Select AIOS workspace (on-demand)"
              >
                {wsLoading ? 'ws…' : `ws · ${workspaceLabel}`}
              </button>
              {wsOpen && (
                <ul className="ws-menu" role="listbox">
                  {(workspaces || []).length === 0 ? (
                    <li className="ws-empty">No workspaces registered</li>
                  ) : (
                    (workspaces || []).map((w) => {
                      const id = w.id || ''
                      if (!id) return null
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            className={id === workspaceLabel ? 'active' : ''}
                            onClick={() => void onPickWorkspace(id)}
                          >
                            {w.name || id}
                            {w.default ? ' · default' : ''}
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              )}
            </div>
            <div className="ws-wrap">
              <button
                type="button"
                className="chip ws"
                onClick={() => {
                  setWsOpen(false)
                  setLangOpen((open) => !open)
                }}
                disabled={pending}
                aria-expanded={langOpen}
                title="Chat locale (resets conversation)"
              >
                {`lang · ${localeLabel}`}
              </button>
              {langOpen && (
                <ul className="ws-menu" role="listbox">
                  {(
                    [
                      { id: 'en' as const, label: 'English' },
                      { id: 'pt' as const, label: 'Português' },
                    ] as const
                  ).map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        className={opt.id === localeLabel ? 'active' : ''}
                        onClick={() => void onPickLocale(opt.id)}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => void onRefresh()}
              disabled={pending}
            >
              Refresh
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void onNewChat()}
              disabled={pending}
            >
              New chat
            </button>
          </div>
        </div>

        {error && (
          <p className="banner" role="alert">
            {error}. Start with <code>companion surface</code> or{' '}
            <code>pnpm surface</code> (API :8790).
          </p>
        )}

        {processOpen && (
          <div className="process-stack">
            <SignalRail signal={lastSignal} live={sending} />
            <AttentionField
              items={attention}
              hasErrors={snap?.governance.hasErrors}
              providerOk={snap?.governance.providerOk}
            />
            <AgentGraph graph={lastPipeline} live={pipelineLive} />
            <DoctorField report={lastDoctor} running={doctorRunning} />
            <GovAuditField report={lastGovAudit} running={auditRunning} />
          </div>
        )}

        <section className="chat" aria-label="Conversation">
          <div className="transcript" ref={listRef}>
            {turns.length === 0 && (
              <p className="empty">
                Try <strong>status</strong> — or ask something simple. Analysis
                words route to the AIOS pipeline when you are ready.
              </p>
            )}
            {turns.map((t, i) => (
              <article
                key={`${t.at}-${i}`}
                className={`bubble ${t.role}`}
              >
                {t.via && <span className="via">{t.via}</span>}
                <p>
                  {t.content ||
                    (sending && i === turns.length - 1 && t.role === 'assistant'
                      ? streamPhase
                        ? `… ${streamPhase}`
                        : '…'
                      : '')}
                </p>
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
