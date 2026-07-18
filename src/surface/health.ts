/**
 * Probe Companion surface API health (#85).
 * Resource-Aware: short timeout; surface optional for doctor.
 */
export async function probeSurfaceHealth(
  options: {
    baseUrl?: string
    timeoutMs?: number
    fetchImpl?: typeof fetch
  } = {},
): Promise<{ ok: boolean; detail: string }> {
  const base =
    options.baseUrl ||
    process.env.COMPANION_SURFACE_URL ||
    `http://127.0.0.1:${process.env.COMPANION_SURFACE_PORT || '8790'}`
  const url = `${base.replace(/\/$/, '')}/api/health`
  const timeoutMs = options.timeoutMs ?? 1500
  const fetchImpl = options.fetchImpl || fetch
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal })
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status} · ${url}` }
    }
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      service?: string
    }
    if (body.ok === true) {
      return {
        ok: true,
        detail: `${body.service || 'companion-surface'} · ${url}`,
      }
    }
    return { ok: false, detail: `unexpected body · ${url}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, detail: `unreachable · ${url} · ${msg}` }
  } finally {
    clearTimeout(timer)
  }
}

export async function waitForSurfaceHealth(
  options: {
    baseUrl?: string
    attempts?: number
    delayMs?: number
    timeoutMs?: number
  } = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 30
  const delayMs = options.delayMs ?? 400
  for (let i = 0; i < attempts; i++) {
    const probe = await probeSurfaceHealth({
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs ?? 800,
    })
    if (probe.ok) return true
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return false
}
