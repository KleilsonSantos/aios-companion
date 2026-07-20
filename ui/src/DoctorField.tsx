/** Presence (#124): doctor bridge check-up — CSS only, on-demand. */

export type DoctorCheckView = {
  id: string
  ok: boolean
  detail: string
  severity?: 'error' | 'warn' | 'info'
}

export type DoctorReportView = {
  ok: boolean
  summary: string
  checks: DoctorCheckView[]
}

function toneFor(check: DoctorCheckView): 'ok' | 'warn' | 'fail' | 'info' {
  if (!check.ok) return 'fail'
  if (check.severity === 'warn') return 'warn'
  if (check.severity === 'info') return 'info'
  return 'ok'
}

export function DoctorField(props: {
  report: DoctorReportView | null | undefined
  running?: boolean
}) {
  const { report, running } = props
  if (running) {
    return (
      <section className="doctor-field live" aria-label="Doctor check-up">
        <div className="doctor-field-head">
          <h2>Doctor</h2>
          <span className="doctor-field-meta">running…</span>
        </div>
        <p className="doctor-empty">Probing Companion ↔ AIOS bridge…</p>
      </section>
    )
  }

  if (!report) {
    return (
      <section className="doctor-field calm" aria-label="Doctor check-up">
        <div className="doctor-field-head">
          <h2>Doctor</h2>
          <span className="doctor-field-meta">waiting</span>
        </div>
        <p className="doctor-empty">
          Run Doctor on demand — contract, state, gov, provider, policies.
        </p>
      </section>
    )
  }

  const tone = report.ok ? 'ok' : 'fail'
  const fails = report.checks.filter((c) => !c.ok).length
  const warns = report.checks.filter((c) => c.severity === 'warn').length

  return (
    <section
      className={`doctor-field tone-${tone}`}
      aria-label="Doctor check-up"
    >
      <div className="doctor-field-head">
        <h2>Doctor</h2>
        <span className="doctor-field-meta">
          {report.ok ? 'pass' : 'fail'}
          {fails ? ` · ${fails} fail` : ''}
          {warns ? ` · ${warns} warn` : ''}
          {` · ${report.checks.length} checks`}
        </span>
      </div>
      <p className="doctor-summary">{report.summary}</p>
      <ol className="doctor-checks">
        {report.checks.map((c) => (
          <li key={c.id} className={`doctor-check ${toneFor(c)}`}>
            <span className="doctor-dot" />
            <span className="doctor-id">{c.id}</span>
            <span className="doctor-detail">{c.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
