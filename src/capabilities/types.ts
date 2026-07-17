/**
 * Contratos de capability adapters (ADR-0014).
 * Thin façade — não duplica engines AIOS; CLIs/MCP externos on-demand.
 */
export type CapabilityId = 'git' | 'github'

export type CapabilityProbe = {
  id: CapabilityId
  available: boolean
  /** Porquê indisponível (inspect-before-install). */
  reason?: string
}

export type CapabilitySnapshot = {
  id: CapabilityId
  ok: boolean
  summary: string
  data?: unknown
  at: string
}

export type CapabilityContext = {
  /** Repo a inspecionar (default: cwd). */
  cwd?: string
  /** Snapshot AIOS já obtido — reutilizar git leve. */
  operationalGit?: {
    available?: boolean
    branch?: string
    head?: string
  }
}

export interface CapabilityAdapter {
  id: CapabilityId
  probe(ctx?: CapabilityContext): CapabilityProbe
  snapshot(ctx?: CapabilityContext): Promise<CapabilitySnapshot>
}
