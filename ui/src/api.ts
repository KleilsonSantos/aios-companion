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

export type SurfaceWorkspace = {
  id?: string
  name?: string
  path?: string
  default?: boolean
}

export type WorkspacesResponse = {
  ok: boolean
  selectedWorkspaceId: string
  count: number
  summary: string
  workspaces: SurfaceWorkspace[]
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

export type ChatStreamHandlers = {
  onStatus?: (phase: string) => void
  onDelta?: (text: string) => void
}

async function readSseChat(
  res: Response,
  handlers: ChatStreamHandlers = {},
): Promise<SurfaceSnapshot & { turn?: SurfaceTurn }> {
  if (!res.body) {
    throw new Error('SSE body missing')
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let donePayload: (SurfaceSnapshot & { turn?: SurfaceTurn }) | null = null
  let streamError: string | null = null

  const flushEvents = (chunk: string) => {
    buffer += chunk
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const lines = part.split('\n')
      let event = 'message'
      const dataLines: string[] = []
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      }
      if (!dataLines.length) continue
      const data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
      if (event === 'status' && typeof data.phase === 'string') {
        handlers.onStatus?.(data.phase)
      } else if (event === 'delta' && typeof data.text === 'string') {
        handlers.onDelta?.(data.text)
      } else if (event === 'done') {
        donePayload = data as SurfaceSnapshot & { turn?: SurfaceTurn }
      } else if (event === 'error' && typeof data.error === 'string') {
        streamError = data.error
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (value) flushEvents(decoder.decode(value, { stream: !done }))
    if (done) break
  }
  if (buffer.trim()) flushEvents('\n\n')

  if (streamError) throw new Error(streamError)
  if (!donePayload) throw new Error('SSE stream ended without done')
  return donePayload
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

/** Prefer SSE progressive reveal; falls back to POST /api/chat. */
export async function sendChatStream(
  message: string,
  handlers: ChatStreamHandlers = {},
  localOnly = false,
): Promise<SurfaceSnapshot & { turns: SurfaceTurn[] }> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message, local: localOnly }),
  })
  const ct = res.headers.get('content-type') || ''
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  if (!ct.includes('text/event-stream')) {
    return (await res.json()) as SurfaceSnapshot & { turns: SurfaceTurn[] }
  }
  return readSseChat(res, handlers)
}

export async function resetSession(): Promise<SurfaceSnapshot> {
  const res = await fetch('/api/session/reset', { method: 'POST' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return (await res.json()) as SurfaceSnapshot
}

export async function fetchWorkspaces(): Promise<WorkspacesResponse> {
  const res = await fetch('/api/workspaces')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return (await res.json()) as WorkspacesResponse
}

export async function selectWorkspace(
  workspaceId: string,
): Promise<SurfaceSnapshot> {
  const res = await fetch('/api/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return (await res.json()) as SurfaceSnapshot
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
