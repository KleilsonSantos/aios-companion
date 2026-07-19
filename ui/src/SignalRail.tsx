/** Presence spike (#106): signal rail tied to chat SSE phase / turn via. CSS only. */

export type SignalKind = 'idle' | 'memory' | 'local' | 'pipeline' | 'provider'

const NODES = [
  { id: 'intent', label: 'Intent' },
  { id: 'route', label: 'Route' },
  { id: 'aios', label: 'AIOS' },
  { id: 'reply', label: 'Reply' },
] as const

function nodeState(
  id: (typeof NODES)[number]['id'],
  signal: SignalKind,
  live: boolean,
): 'off' | 'dim' | 'on' | 'hot' {
  if (signal === 'idle') {
    return id === 'intent' ? 'dim' : 'off'
  }
  if (id === 'intent') return live ? 'hot' : 'on'
  if (id === 'route') {
    if (signal === 'memory' || signal === 'local') return live ? 'hot' : 'on'
    return 'on'
  }
  if (id === 'aios') {
    if (signal === 'pipeline') return live ? 'hot' : 'on'
    if (signal === 'provider') return live ? 'on' : 'dim'
    if (signal === 'memory') return 'dim'
    return 'dim'
  }
  // reply
  if (live) return 'dim'
  return 'on'
}

function routeCaption(signal: SignalKind): string {
  switch (signal) {
    case 'pipeline':
      return 'pipeline · aios_run_pipeline'
    case 'provider':
      return 'provider · aios_provider_chat'
    case 'memory':
      return 'memory · aios_memory_*'
    case 'local':
      return 'local · offline fallback'
    default:
      return 'waiting for a turn'
  }
}

export function SignalRail(props: {
  signal: SignalKind
  live: boolean
}) {
  const { signal, live } = props
  return (
    <section
      className={`signal-rail${live ? ' live' : ''}${signal !== 'idle' ? ' armed' : ''}`}
      aria-label="Control-plane signal rail"
    >
      <div className="signal-rail-head">
        <h2>Signal</h2>
        <span className="signal-caption">{routeCaption(signal)}</span>
      </div>
      <div className="signal-track">
        <div className="signal-track-line" aria-hidden="true" />
        <ol className="signal-nodes">
          {NODES.map((n) => {
            const state = nodeState(n.id, signal, live)
            return (
              <li key={n.id} className={`signal-node ${state}`}>
                <span className="signal-dot" />
                <span className="signal-label">{n.label}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

export function signalFromPhaseOrVia(
  phase: string | null | undefined,
  via: string | null | undefined,
): SignalKind {
  const raw = (phase || via || '').toLowerCase()
  if (raw === 'pipeline') return 'pipeline'
  if (raw === 'provider') return 'provider'
  if (raw === 'memory') return 'memory'
  if (raw === 'local') return 'local'
  return 'idle'
}
