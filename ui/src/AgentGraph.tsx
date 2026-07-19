/** Presence (#118): pipeline agent graph from real aios_run_pipeline workflow. CSS only. */

export type PipelineGraphData = {
  intent?: string
  ran: string[]
  skipped: string[]
  passed: boolean
}

type AgentNode = {
  id: string
  state: 'ran' | 'skipped' | 'pending'
}

function buildNodes(graph: PipelineGraphData | null, live: boolean): AgentNode[] {
  if (live && !graph) {
    return ['architecture', 'appsec', 'docs', 'qa'].map((id) => ({
      id,
      state: 'pending' as const,
    }))
  }
  if (!graph) return []
  const seen = new Set<string>()
  const nodes: AgentNode[] = []
  for (const id of graph.ran) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    nodes.push({ id, state: 'ran' })
  }
  for (const id of graph.skipped) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    nodes.push({ id, state: 'skipped' })
  }
  return nodes
}

export function AgentGraph(props: {
  graph: PipelineGraphData | null | undefined
  live?: boolean
}) {
  const live = Boolean(props.live)
  const graph = props.graph ?? null
  const nodes = buildNodes(graph, live)
  if (!live && nodes.length === 0) {
    return (
      <section className="agent-graph calm" aria-label="Pipeline agent graph">
        <div className="agent-graph-head">
          <h2>Pipeline</h2>
          <span className="agent-graph-meta">waiting for a run</span>
        </div>
        <p className="agent-graph-empty">
          Ask for an analysis — agents light up from the real control-plane workflow.
        </p>
      </section>
    )
  }

  const tone = live
    ? 'live'
    : graph?.passed === false
      ? 'fail'
      : graph?.passed
        ? 'ok'
        : 'calm'

  return (
    <section
      className={`agent-graph tone-${tone}${live ? ' live' : ''}`}
      aria-label="Pipeline agent graph"
    >
      <div className="agent-graph-head">
        <h2>Pipeline</h2>
        <span className="agent-graph-meta">
          {live
            ? 'running…'
            : [
                graph?.intent ? `intent · ${graph.intent}` : null,
                graph?.passed === false ? 'gate fail' : graph?.passed ? 'gate ok' : null,
                `${nodes.filter((n) => n.state === 'ran').length} ran`,
              ]
                .filter(Boolean)
                .join(' · ')}
        </span>
      </div>
      <ol className="agent-nodes">
        {nodes.map((n) => (
          <li key={n.id} className={`agent-node ${n.state}`}>
            <span className="agent-dot" />
            <span className="agent-label">{n.id}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
