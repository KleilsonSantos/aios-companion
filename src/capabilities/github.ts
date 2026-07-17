/**
 * Adapter GitHub — `gh` CLI on-demand (inspect-before-install).
 * Sem Octokit novo se `gh` já existir; AIOS não absorve esta tool.
 */
import type {
  CapabilityAdapter,
  CapabilityContext,
  CapabilityProbe,
  CapabilitySnapshot,
} from './types.ts'
import { run, which } from './shell.ts'

function now(): string {
  return new Date().toISOString()
}

export const githubAdapter: CapabilityAdapter = {
  id: 'github',

  probe(): CapabilityProbe {
    if (!which('gh')) {
      return {
        id: 'github',
        available: false,
        reason: 'gh CLI não encontrado — instala GitHub CLI se precisares',
      }
    }
    const auth = run('gh', ['auth', 'status'])
    // gh auth status exits 0 when logged in
    if (!auth.ok) {
      return {
        id: 'github',
        available: false,
        reason: 'gh presente mas não autenticado (`gh auth login`)',
      }
    }
    return { id: 'github', available: true }
  },

  async snapshot(ctx = {}): Promise<CapabilitySnapshot> {
    const probe = githubAdapter.probe()
    if (!probe.available) {
      return {
        id: 'github',
        ok: false,
        summary: probe.reason || 'github indisponível',
        at: now(),
      }
    }

    const repo = run(
      'gh',
      ['repo', 'view', '--json', 'nameWithOwner,url,defaultBranchRef'],
      { cwd: ctx.cwd },
    )
    const prs = run(
      'gh',
      [
        'pr',
        'list',
        '--limit',
        '5',
        '--json',
        'number,title,url,headRefName,isDraft',
      ],
      { cwd: ctx.cwd },
    )

    if (!repo.ok) {
      return {
        id: 'github',
        ok: false,
        summary: repo.stderr || 'gh repo view falhou (remoto?)',
        at: now(),
      }
    }

    let repoData: {
      nameWithOwner?: string
      url?: string
      defaultBranchRef?: { name?: string }
    } = {}
    let prList: Array<{
      number: number
      title: string
      url: string
      headRefName?: string
      isDraft?: boolean
    }> = []
    try {
      repoData = JSON.parse(repo.stdout)
      if (prs.ok) prList = JSON.parse(prs.stdout)
    } catch (err) {
      return {
        id: 'github',
        ok: false,
        summary: err instanceof Error ? err.message : 'JSON gh inválido',
        at: now(),
      }
    }

    const name = repoData.nameWithOwner || '?'
    const summary =
      prList.length === 0
        ? `${name}: sem PRs abertos`
        : `${name}: ${prList.length} PR(s) aberto(s) — #${prList.map((p) => p.number).join(', #')}`

    return {
      id: 'github',
      ok: true,
      summary,
      data: {
        source: 'gh',
        repo: repoData,
        openPullRequests: prList,
      },
      at: now(),
    }
  },
}
