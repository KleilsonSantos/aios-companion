/** Presence (#112): Attention field from governance.attention — CSS only. */

export type AttentionItem = {
  id?: string
  severity?: string
  title?: string
  detail?: string
}

function severityClass(severity?: string): 'error' | 'warn' | 'info' {
  if (severity === 'error') return 'error'
  if (severity === 'warn') return 'warn'
  return 'info'
}

/** Stable-ish layout slots so nodes don't jump every render. */
function slotFor(index: number, total: number): { x: number; y: number } {
  const cols = Math.min(4, Math.max(1, total))
  const col = index % cols
  const row = Math.floor(index / cols)
  const x = 12 + (col / Math.max(cols - 1, 1)) * 76
  const y = 18 + row * 28
  return { x, y }
}

export function AttentionField(props: {
  items: AttentionItem[]
  hasErrors?: boolean
  providerOk?: boolean
}) {
  const { items, hasErrors, providerOk } = props
  const shown = items.slice(0, 8)
  const tone =
    hasErrors || shown.some((i) => i.severity === 'error')
      ? 'bad'
      : shown.some((i) => i.severity === 'warn')
        ? 'warn'
        : shown.length
          ? 'info'
          : 'calm'

  return (
    <section
      className={`attention-field tone-${tone}`}
      aria-label="Governance attention field"
    >
      <div className="attention-field-head">
        <h2>Attention field</h2>
        <span className="attention-field-meta">
          {shown.length === 0
            ? 'clear'
            : `${shown.length} signal${shown.length === 1 ? '' : 's'}`}
          {providerOk === undefined
            ? ''
            : providerOk
              ? ' · provider up'
              : ' · provider down'}
        </span>
      </div>
      <div className="attention-sky" role="img" aria-hidden={shown.length === 0}>
        <div className="attention-horizon" />
        {shown.length === 0 ? (
          <p className="attention-calm">Nothing flagged — control plane quiet.</p>
        ) : (
          shown.map((item, i) => {
            const sev = severityClass(item.severity)
            const { x, y } = slotFor(i, shown.length)
            return (
              <div
                key={item.id || `${item.title}-${i}`}
                className={`attention-star ${sev}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                title={[item.title || item.id || 'Item', item.detail]
                  .filter(Boolean)
                  .join(' — ')}
              >
                <span className="attention-star-core" />
                <span className="attention-star-label">
                  {item.title || item.id || 'Item'}
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
