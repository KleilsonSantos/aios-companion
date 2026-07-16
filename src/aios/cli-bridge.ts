/**
 * Bridge CLI → AIOS control plane (Resource-Aware, on-demand).
 * Não importa engines/* do AIOS — só o binário/CLI público.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type OperationalStateLite = {
  generatedAt?: string
  summary?: string
  mode?: string
  git?: { available?: boolean; branch?: string; head?: string }
  health?: { errorCount?: number; warnCount?: number }
  boundaries?: Record<string, boolean>
  [key: string]: unknown
}

export function resolveAiosHome(): string {
  const home = process.env.AIOS_HOME || process.env.AIOS_REPO
  if (home) return resolve(home)
  const sibling = resolve(process.cwd(), '..', 'ai-operating-system')
  if (existsSync(join(sibling, 'package.json'))) return sibling
  throw new Error(
    'AIOS_HOME não definido e sibling ../ai-operating-system não encontrado.',
  )
}

function cliEntry(aiosHome: string): string {
  return join(aiosHome, 'apps', 'cli', 'src', 'index.ts')
}

/**
 * Lê snapshot operacional via `aios --operational-state` (on-demand).
 */
export function fetchOperationalState(
  options: { aiosHome?: string; workspaceId?: string } = {},
): OperationalStateLite {
  const aiosHome = options.aiosHome || resolveAiosHome()
  const entry = cliEntry(aiosHome)
  if (!existsSync(entry)) {
    throw new Error(`CLI AIOS não encontrada: ${entry}`)
  }

  const args = ['--experimental-strip-types', entry, '--operational-state']
  if (options.workspaceId) {
    args.push('--workspace', options.workspaceId)
  }

  const result = spawnSync(process.execPath, args, {
    cwd: aiosHome,
    env: { ...process.env, AIOS_HOME: aiosHome },
    encoding: 'utf8',
    timeout: 30_000,
  })

  if (result.error) throw result.error
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `aios --operational-state falhou (exit ${result.status}): ${result.stderr || result.stdout}`,
    )
  }

  const raw = (result.stdout || '').trim()
  if (!raw) {
    throw new Error(`Saída vazia do AIOS CLI. stderr: ${result.stderr}`)
  }

  return JSON.parse(raw) as OperationalStateLite
}
