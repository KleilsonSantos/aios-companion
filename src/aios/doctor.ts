/**
 * Check-up da ponte Companion ↔ AIOS (Resource-Aware, on-demand).
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveAiosHome } from './cli-bridge.ts'
import {
  AiosMcpSession,
  EXPECTED_CONTRACT_VERSION,
} from './mcp-client.ts'
import { probeSurfaceHealth } from '../surface/health.ts'

export type DoctorCheck = {
  id: string
  ok: boolean
  detail: string
  /** warn = auxiliar (ex. Ollama DOWN) — não falha o doctor global */
  severity?: 'error' | 'warn' | 'info'
}

export type DoctorReport = {
  ok: boolean
  aiosHome: string
  checks: DoctorCheck[]
  summary: string
}

export async function runDoctor(
  options: { aiosHome?: string } = {},
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = []
  let aiosHome: string
  try {
    aiosHome = options.aiosHome || resolveAiosHome()
    checks.push({
      id: 'aios_home',
      ok: true,
      detail: aiosHome,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      aiosHome: '',
      checks: [{ id: 'aios_home', ok: false, detail }],
      summary: 'doctor FAIL · AIOS_HOME inválido',
    }
  }

  const mcpUrl = (process.env.AIOS_MCP_URL || '').trim()
  const mcpEntry = join(aiosHome, 'apps', 'mcp', 'src', 'index.ts')
  const mcpOk = existsSync(mcpEntry)

  if (mcpUrl) {
    checks.push({
      id: 'mcp_entry',
      ok: true,
      severity: 'info',
      detail: `skipped — AIOS_MCP_URL=${mcpUrl}`,
    })
  } else {
    checks.push({
      id: 'mcp_entry',
      ok: mcpOk,
      detail: mcpOk ? mcpEntry : `em falta: ${mcpEntry}`,
    })
    if (!mcpOk) {
      return {
        ok: false,
        aiosHome,
        checks,
        summary: 'doctor FAIL · MCP AIOS não encontrado',
      }
    }
  }

  const session = new AiosMcpSession(aiosHome)
  try {
    await session.connect()
    const kind = session.getTransportKind()
    checks.push({
      id: 'mcp_connect',
      ok: true,
      detail:
        kind === 'http'
          ? `http OK · ${session.getHttpUrl()}`
          : 'stdio OK',
    })

    const contract = await session.contractVersion()
    checks.push({
      id: 'contract',
      ok: contract.ok,
      detail: contract.summary,
    })

    try {
      const state = await session.operationalState()
      checks.push({
        id: 'operational_state',
        ok: true,
        detail: state.summary || `mode=${state.mode || '?'}`,
      })
    } catch (err) {
      checks.push({
        id: 'operational_state',
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      const gov = await session.governanceStatus()
      checks.push({
        id: 'governance',
        ok: !gov.hasErrors,
        detail: gov.summary,
      })

      // Consumption (AIOS provider.chat JSONL) — empty = info, chat errors = warn
      if (gov.providerChat) {
        const pc = gov.providerChat
        const hasChatErr = pc.errorCount > 0
        checks.push({
          id: 'consumption',
          ok: true,
          severity: hasChatErr ? 'warn' : 'info',
          detail: `${pc.count} chat · ~${pc.totalTokens} tok${
            hasChatErr ? ` · ${pc.errorCount} err` : ''
          }${gov.providers?.length ? ` · providers=${gov.providers.join(',')}` : ''}`,
        })
      } else {
        checks.push({
          id: 'consumption',
          ok: true,
          severity: 'info',
          detail:
            'no provider.chat events yet (run aios_provider_chat / companion chat)',
        })
      }

      const govFail = gov.attention.filter(
        (a) =>
          a.severity === 'error' &&
          (a.id === 'gov-fail-verdicts' || a.id?.startsWith('gov-')),
      )
      if (govFail.length > 0) {
        checks.push({
          id: 'governance_v2',
          ok: false,
          detail: govFail
            .slice(0, 3)
            .map((a) => a.title || a.id)
            .join(' · '),
        })
      }
    } catch (err) {
      checks.push({
        id: 'governance',
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      })
    }

    // Provider auxiliar: DOWN = warn (não falha doctor — Resource-Aware / #73)
    try {
      const health = await session.providerHealth()
      if (health.ok) {
        checks.push({
          id: 'provider',
          ok: true,
          detail: health.summary,
        })
      } else {
        checks.push({
          id: 'provider',
          ok: true,
          severity: 'warn',
          detail: `${health.summary} (auxiliar opcional)`,
        })
      }
    } catch (err) {
      checks.push({
        id: 'provider',
        ok: true,
        severity: 'warn',
        detail: `provider unreachable · ${err instanceof Error ? err.message : err} (auxiliar)`,
      })
    }

    try {
      const policies = await session.loadPolicies({ repoPath: aiosHome })
      const mustOk = policies.mustIds.length > 0
      checks.push({
        id: 'policies',
        ok: mustOk,
        detail: mustOk
          ? policies.summary
          : `${policies.summary} · sem must policies`,
      })
    } catch (err) {
      checks.push({
        id: 'policies',
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  } catch (err) {
    checks.push({
      id: 'mcp_connect',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    })
  } finally {
    await session.close().catch(() => undefined)
  }

  // Surface API optional — info when down (#85)
  const probe = await probeSurfaceHealth()
  if (probe.ok) {
    checks.push({
      id: 'surface',
      ok: true,
      detail: probe.detail,
    })
  } else {
    checks.push({
      id: 'surface',
      ok: true,
      severity: 'info',
      detail: `${probe.detail} (optional — run companion surface)`,
    })
  }

  const ok = checks.every((c) => c.ok)
  const failed = checks.filter((c) => !c.ok).map((c) => c.id)
  const warns = checks.filter((c) => c.severity === 'warn').map((c) => c.id)
  return {
    ok,
    aiosHome,
    checks,
    summary: ok
      ? `doctor OK · contract v${EXPECTED_CONTRACT_VERSION} · ${checks.length} checks${warns.length ? ` · warn: ${warns.join(', ')}` : ''}`
      : `doctor FAIL · ${failed.join(', ')}`,
  }
}
