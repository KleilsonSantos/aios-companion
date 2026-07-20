/** Presence (#127): governance audit from real aios_governance_audit. CSS only. */

export type GovAuditFinding = {
  id?: string
  severity?: string
  title?: string
  detail?: string
}

export type GovAuditReport = {
  ok: boolean
  summary: string
  findings: GovAuditFinding[]
  mustCount: number
  decisionsCount?: number
  failCount?: number
}

function findingTone(severity?: string): 'error' | 'warn' | 'info' {
  if (severity === 'error') return 'error'
  if (severity === 'warn') return 'warn'
  return 'info'
}

export function GovAuditField(props: {
  report: GovAuditReport | null | undefined
  running?: boolean
}) {
  const { report, running } = props
  if (running) {
    return (
      <section className="gov-audit-field live" aria-label="Governance audit">
        <div className="gov-audit-field-head">
          <h2>Gov audit</h2>
          <span className="gov-audit-field-meta">running…</span>
        </div>
        <p className="gov-audit-empty">Inspecting policies · decisions · docs…</p>
      </section>
    )
  }

  if (!report) {
    return (
      <section className="gov-audit-field calm" aria-label="Governance audit">
        <div className="gov-audit-field-head">
          <h2>Gov audit</h2>
          <span className="gov-audit-field-meta">waiting</span>
        </div>
        <p className="gov-audit-empty">
          Run Audit on demand — must policies, fail verdicts, docs drift.
        </p>
      </section>
    )
  }

  const tone = report.ok ? 'ok' : 'fail'
  const shown = report.findings.slice(0, 8)
  const errors = report.findings.filter((f) => f.severity === 'error').length
  const warns = report.findings.filter((f) => f.severity === 'warn').length

  return (
    <section
      className={`gov-audit-field tone-${tone}`}
      aria-label="Governance audit"
    >
      <div className="gov-audit-field-head">
        <h2>Gov audit</h2>
        <span className="gov-audit-field-meta">
          {report.ok ? 'pass' : 'fail'}
          {` · must ${report.mustCount}`}
          {report.decisionsCount !== undefined
            ? ` · decisions ${report.decisionsCount}`
            : ''}
          {report.failCount ? ` · fail ${report.failCount}` : ''}
          {errors ? ` · ${errors} err` : ''}
          {warns ? ` · ${warns} warn` : ''}
        </span>
      </div>
      <p className="gov-audit-summary">{report.summary}</p>
      {shown.length === 0 ? (
        <p className="gov-audit-empty">No findings returned.</p>
      ) : (
        <ol className="gov-audit-findings">
          {shown.map((f, i) => (
            <li
              key={f.id || `${f.title}-${i}`}
              className={`gov-audit-finding ${findingTone(f.severity)}`}
            >
              <span className="gov-audit-dot" />
              <strong>{f.title || f.id || 'Finding'}</strong>
              {f.detail ? <span>{f.detail}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
