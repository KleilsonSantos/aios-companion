/**
 * Registry de capability adapters — mesh Companion (ADR-0014).
 */
import { gitAdapter } from './git.ts'
import { githubAdapter } from './github.ts'
import type {
  CapabilityAdapter,
  CapabilityContext,
  CapabilityId,
  CapabilityProbe,
  CapabilitySnapshot,
} from './types.ts'

const adapters: Record<CapabilityId, CapabilityAdapter> = {
  git: gitAdapter,
  github: githubAdapter,
}

export function listAdapters(): CapabilityAdapter[] {
  return Object.values(adapters)
}

export function probeAll(ctx?: CapabilityContext): CapabilityProbe[] {
  return listAdapters().map((a) => a.probe(ctx))
}

export async function snapshotCapability(
  id: CapabilityId,
  ctx?: CapabilityContext,
): Promise<CapabilitySnapshot> {
  const adapter = adapters[id]
  if (!adapter) {
    return {
      id,
      ok: false,
      summary: `capability desconhecida: ${id}`,
      at: new Date().toISOString(),
    }
  }
  return adapter.snapshot(ctx)
}

export type { CapabilityId, CapabilityProbe, CapabilitySnapshot, CapabilityContext }
