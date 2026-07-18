/**
 * Companion surface API — thin HTTP over MCP + Conversation Manager (#79 / #82 / #88).
 * Port: COMPANION_SURFACE_PORT or 8790 (avoids AIOS console 8787).
 * Resource-Aware: one MCP session for process lifetime; no polling here.
 */
import { createServer } from 'node:http'
import { AiosMcpSession } from '../aios/mcp-client.ts'
import type { OperationalStateLite } from '../aios/cli-bridge.ts'
import {
  createSession,
  isPipelineIntent,
  respondLocal,
  respondWithPipeline,
  respondWithProvider,
  type ConversationSession,
  type ChatTurn,
} from '../conversation/manager.ts'
import {
  buildSurfaceSnapshot,
  defaultWorkspaceId,
  parseChatBody,
  parseMemoryBody,
  parseMemoryChatCommand,
  parseWorkspaceBody,
} from './helpers.ts'
import { loadSession, saveSession } from './persist.ts'
import {
  chunkText,
  writeSseEvent,
  writeSseHeaders,
  type StreamPhase,
} from './stream.ts'
import type {
  GovernanceStatusResult,
  MemoryRecallResult,
} from '../aios/mcp-client.ts'

const port = Number(process.env.COMPANION_SURFACE_PORT || 8790)

let mcp: AiosMcpSession | null = null
let conversation: ConversationSession | null = null
let lastOperational: OperationalStateLite | null = null
let lastGovernance: GovernanceStatusResult | null = null
let lastMemory: MemoryRecallResult | null = null
let memoryWorkspaceId = defaultWorkspaceId()

function now(): string {
  return new Date().toISOString()
}

function sendJson(
  res: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(body, null, 2))
}

async function readJsonBody(
  req: import('node:http').IncomingMessage,
): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw) as unknown
}

async function ensureMcp(): Promise<AiosMcpSession> {
  if (!mcp) {
    mcp = new AiosMcpSession()
    await mcp.connect()
  }
  return mcp
}

async function ensureConversation(
  session: AiosMcpSession,
): Promise<ConversationSession> {
  if (conversation) return conversation
  const stored = loadSession()
  if (stored) {
    conversation = stored
    return conversation
  }
  try {
    lastOperational = await session.operationalState()
  } catch {
    lastOperational = null
  }
  conversation = createSession(lastOperational ?? undefined)
  saveSession(conversation)
  return conversation
}

function persistConversation(): void {
  if (conversation) saveSession(conversation)
}

async function refreshControlPlane(session: AiosMcpSession): Promise<string | undefined> {
  try {
    lastOperational = await session.operationalState()
    lastGovernance = await session.governanceStatus()
    lastMemory = await session.memoryRecall({
      workspaceId: memoryWorkspaceId,
      limit: 5,
    })
    return undefined
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

function snapshot(session: ConversationSession, error?: string) {
  return buildSurfaceSnapshot({
    session,
    operational: lastOperational,
    governance: lastGovernance,
    memory: lastMemory,
    workspaceId: memoryWorkspaceId,
    error,
  })
}

function pushLocalAssistant(
  conv: ConversationSession,
  userText: string,
  reply: string,
): ChatTurn {
  conv.turns.push({ role: 'user', content: userText, at: now() })
  const assistant: ChatTurn = {
    role: 'assistant',
    content: reply,
    at: now(),
    via: 'local',
  }
  conv.turns.push(assistant)
  return assistant
}

async function handleMemoryChat(
  conv: ConversationSession,
  session: AiosMcpSession,
  message: string,
): Promise<ChatTurn | null> {
  const cmd = parseMemoryChatCommand(message)
  if (!cmd) return null

  if (cmd.kind === 'clear-blocked') {
    return pushLocalAssistant(
      conv,
      message,
      'Memory clear is destructive — use `companion memory clear [workspace] --yes` from the CLI.',
    )
  }

  if (cmd.kind === 'recall') {
    memoryWorkspaceId = cmd.workspaceId
    const out = await session.memoryRecall({
      workspaceId: cmd.workspaceId,
      limit: 5,
    })
    lastMemory = out
    const lines = out.entries.slice(0, 5).map((e) => {
      const tags = e.tags?.length ? ` [${e.tags.join(', ')}]` : ''
      return `- ${(e.content || '').slice(0, 160)}${tags}`
    })
    const body =
      lines.length === 0
        ? out.summary
        : `${out.summary}\n${lines.join('\n')}`
    return pushLocalAssistant(conv, message, body)
  }

  const remembered = await session.memoryRemember({
    workspaceId: cmd.workspaceId,
    content: cmd.content,
  })
  memoryWorkspaceId = cmd.workspaceId
  lastMemory = await session.memoryRecall({
    workspaceId: cmd.workspaceId,
    limit: 5,
  })
  return pushLocalAssistant(conv, message, remembered.summary)
}

async function runChatTurn(
  conv: ConversationSession,
  session: AiosMcpSession,
  message: string,
  localOnly: boolean,
): Promise<{ turn: ChatTurn; phase: StreamPhase }> {
  const memTurn = await handleMemoryChat(conv, session, message)
  if (memTurn) return { turn: memTurn, phase: 'memory' }

  if (localOnly) {
    return { turn: respondLocal(conv, message), phase: 'local' }
  }
  if (isPipelineIntent(message)) {
    return {
      turn: await respondWithPipeline(conv, message, session, {
        workspaceId: memoryWorkspaceId,
      }),
      phase: 'pipeline',
    }
  }
  return {
    turn: await respondWithProvider(conv, message, session),
    phase: 'provider',
  }
}

function resolvePhasePreview(message: string, localOnly: boolean): StreamPhase {
  if (parseMemoryChatCommand(message)) return 'memory'
  if (localOnly) return 'local'
  if (isPipelineIntent(message)) return 'pipeline'
  return 'provider'
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'companion-surface' })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/surface') {
    try {
      const session = await ensureMcp()
      const conv = await ensureConversation(session)
      const error = await refreshControlPlane(session)
      sendJson(res, 200, snapshot(conv, error))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: message, service: 'companion-surface' })
    }
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/workspaces') {
    try {
      const session = await ensureMcp()
      const listed = await session.listWorkspaces()
      sendJson(res, 200, {
        ok: true,
        selectedWorkspaceId: memoryWorkspaceId,
        count: listed.count,
        summary: listed.summary,
        workspaces: listed.workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          path: w.path || w.repoPath,
          default: w.default === true,
        })),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: message })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/workspace') {
    try {
      const parsed = parseWorkspaceBody(await readJsonBody(req))
      if ('error' in parsed) {
        sendJson(res, 400, { error: parsed.error })
        return
      }
      const session = await ensureMcp()
      const conv = await ensureConversation(session)
      memoryWorkspaceId = parsed.workspaceId
      lastMemory = await session.memoryRecall({
        workspaceId: memoryWorkspaceId,
        limit: 5,
      })
      persistConversation()
      sendJson(res, 200, snapshot(conv))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: message })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    try {
      const parsed = parseChatBody(await readJsonBody(req))
      if ('error' in parsed) {
        sendJson(res, 400, { error: parsed.error })
        return
      }
      const session = await ensureMcp()
      const conv = await ensureConversation(session)
      const { turn } = await runChatTurn(
        conv,
        session,
        parsed.message,
        parsed.localOnly,
      )

      sendJson(res, 200, {
        turn: {
          role: turn.role,
          content: turn.content,
          at: turn.at,
          via: turn.via,
        },
        ...snapshot(conv),
      })
      persistConversation()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: message })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/chat/stream') {
    try {
      const parsed = parseChatBody(await readJsonBody(req))
      if ('error' in parsed) {
        sendJson(res, 400, { error: parsed.error })
        return
      }
      const session = await ensureMcp()
      const conv = await ensureConversation(session)

      writeSseHeaders(res)
      const preview = resolvePhasePreview(parsed.message, parsed.localOnly)
      writeSseEvent(res, 'status', { phase: preview })

      const { turn, phase } = await runChatTurn(
        conv,
        session,
        parsed.message,
        parsed.localOnly,
      )
      if (phase !== preview) {
        writeSseEvent(res, 'status', { phase })
      }

      for (const piece of chunkText(turn.content)) {
        writeSseEvent(res, 'delta', { text: piece })
      }

      writeSseEvent(res, 'done', {
        turn: {
          role: turn.role,
          content: turn.content,
          at: turn.at,
          via: turn.via,
        },
        ...snapshot(conv),
      })
      persistConversation()
      res.end()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!res.headersSent) {
        sendJson(res, 500, { error: message })
        return
      }
      writeSseEvent(res, 'error', { error: message })
      res.end()
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/session/reset') {
    try {
      const session = await ensureMcp()
      try {
        lastOperational = await session.operationalState()
      } catch {
        lastOperational = null
      }
      conversation = createSession(lastOperational ?? undefined)
      persistConversation()
      sendJson(res, 200, snapshot(conversation))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: message })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/memory') {
    try {
      const parsed = parseMemoryBody(await readJsonBody(req))
      if ('error' in parsed) {
        sendJson(res, 400, { error: parsed.error })
        return
      }
      const session = await ensureMcp()
      const conv = await ensureConversation(session)
      memoryWorkspaceId = parsed.workspaceId
      if (parsed.action === 'remember' && parsed.content) {
        await session.memoryRemember({
          workspaceId: parsed.workspaceId,
          content: parsed.content,
        })
      }
      lastMemory = await session.memoryRecall({
        workspaceId: parsed.workspaceId,
        limit: 5,
      })
      persistConversation()
      sendJson(res, 200, snapshot(conv))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: message })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/refresh') {
    try {
      const session = await ensureMcp()
      const conv = await ensureConversation(session)
      const error = await refreshControlPlane(session)
      sendJson(res, 200, snapshot(conv, error))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: message })
    }
    return
  }

  sendJson(res, 404, { error: 'not found' })
})

server.listen(port, '127.0.0.1', () => {
  console.error(`companion surface api http://127.0.0.1:${port}`)
})

async function shutdown(): Promise<void> {
  persistConversation()
  if (mcp) {
    await mcp.close().catch(() => undefined)
    mcp = null
  }
  server.close()
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0))
})
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0))
})
