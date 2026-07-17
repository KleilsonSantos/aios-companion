/**
 * Helpers Resource-Aware: spawn on-demand, sem deps novas.
 */
import { spawnSync } from 'node:child_process'

export function which(cmd: string): string | null {
  const r = spawnSync('which', [cmd], { encoding: 'utf8' })
  if (r.status !== 0) return null
  const p = (r.stdout || '').trim()
  return p || null
}

export function run(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const r = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 15_000,
  })
  return {
    ok: r.status === 0,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
    status: r.status,
  }
}
