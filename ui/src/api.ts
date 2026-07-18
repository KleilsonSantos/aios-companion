export type SurfaceAttention = {
  id?: string
  severity?: string
  title?: string
  detail?: string
}

export type SurfaceTurn = {
  role: 'user' | 'assistant'
  content: string
  at: string
  via?: 'local' | 'provider' | 'pipeline'
}

export type SurfaceMemoryEntry = {
  id?: string
  content?: string
  tags?: string[]
  at?: string
}

export type SurfaceSnapshot = {
  ok: boolean
  service: 'companion-surface'
  conversationId: string
  operational: {
    summary: string
    branch?: string
    generatedAt?: string
  }
  governance: {
    summary: string
    hasErrors: boolean
    providerOk?: boolean
    providers?: string[]
    attention: SurfaceAttention[]
    providerChat?: {
      count: number
      errorCount: number
      totalTokens: number
    }
    consumption?: { tone: 'ok' | 'bad' | ''; label: string }
  }
  memory: {
    workspaceId: string
    summary: string
    entries: SurfaceMemoryEntry[]
  }
  turns: SurfaceTurn[]
  error?: string
}

export async function fetchSurface(): Promise<SurfaceSnapshot> {
  const res = await fetch('/api/surface')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return (await res.json()) as SurfaceSnapshot
}

export async function refreshSurface(): Promise<SurfaceSnapshot> {
  const res = await fetch('/api/refresh', { method: 'POST' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return (await res.json()) as SurfaceSnapshot
}

export async function sendChat(
  message: string,
  localOnly = false,
): Promise<SurfaceSnapshot & { turns: SurfaceTurn[] }> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, local: localOnly }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return (await res.json()) as SurfaceSnapshot & { turns: SurfaceTurn[] }
}

export async function postMemory(options: {
  action: 'recall' | 'remember'
  workspaceId?: string
  content?: string
}): Promise<SurfaceSnapshot> {
  const res = await fetch('/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return (await res.json()) as SurfaceSnapshot
}
