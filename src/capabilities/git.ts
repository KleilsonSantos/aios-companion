/**
 * Adapter Git — status on-demand (CLI git ou snapshot AIOS).
 * Não watchers; não duplica operational-state engine.
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

export const gitAdapter: CapabilityAdapter = {
  id: 'git',

  probe(ctx = {}): CapabilityProbe {
    if (ctx.operationalGit?.available) {
      return { id: 'git', available: true }
    }
    if (!which('git')) {
      return {
        id: 'git',
        available: false,
        reason: 'git CLI não encontrado no PATH',
      }
    }
    const inside = run('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: ctx.cwd,
    })
    if (!inside.ok || inside.stdout !== 'true') {
      return {
        id: 'git',
        available: false,
        reason: 'cwd não é um repositório git',
      }
    }
    return { id: 'git', available: true }
  },

  async snapshot(ctx = {}): Promise<CapabilitySnapshot> {
    const probe = gitAdapter.probe(ctx)
    if (!probe.available) {
      return {
        id: 'git',
        ok: false,
        summary: probe.reason || 'git indisponível',
        at: now(),
      }
    }

    // Preferir snapshot AIOS já pago (Resource-Aware) quando completo.
    if (ctx.operationalGit?.available && ctx.operationalGit.branch) {
      const { branch, head } = ctx.operationalGit
      return {
        id: 'git',
        ok: true,
        summary: `branch ${branch}${head ? ` @ ${head.slice(0, 7)}` : ''} (via AIOS operational state)`,
        data: { source: 'aios', branch, head },
        at: now(),
      }
    }

    const branch = run('git', ['branch', '--show-current'], { cwd: ctx.cwd })
    const head = run('git', ['rev-parse', '--short', 'HEAD'], { cwd: ctx.cwd })
    const status = run('git', ['status', '-sb'], { cwd: ctx.cwd })
    if (!branch.ok || !head.ok) {
      return {
        id: 'git',
        ok: false,
        summary: branch.stderr || head.stderr || 'falha git',
        at: now(),
      }
    }

    const dirty = status.stdout.split('\n').length > 1
    return {
      id: 'git',
      ok: true,
      summary: `${branch.stdout} @ ${head.stdout}${dirty ? ' (working tree dirty)' : ''}`,
      data: {
        source: 'cli',
        branch: branch.stdout,
        head: head.stdout,
        status: status.stdout,
      },
      at: now(),
    }
  },
}
