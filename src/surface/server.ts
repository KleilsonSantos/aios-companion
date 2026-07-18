/**
 * Companion surface API — thin HTTP over MCP + Conversation Manager (#79).
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
} from '../conversation/manager.ts'
import { buildSurfaceSnapshot, parseChatBody } from './helpers.ts'
import type { GovernanceStatusResult } from '../aios/mcp-client.ts'

const port = Number(process.env.COMPANION_SURFACE_PORT || 8790)

let mcp: AiosMcpSession | null = null
let conversation: ConversationSession | null = null
let lastOperational: OperationalStateLite | null = null
let lastGovernance: GovernanceStatusResult | null = null

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
  try {
    lastOperational = await session.operationalState()
  } catch {
    lastOperational = null
  }
  conversation = createSession(lastOperational ?? undefined)
  return conversation
}

async function refreshControlPlane(session: AiosMcpSession): Promise<string | undefined> {
  try {
    lastOperational = await session.operationalState()
    lastGovernance = await session.governanceStatus()
    return undefined
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
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
      sendJson(
        res,
        200,
        buildSurfaceSnapshot({
          session: conv,
          operational: lastOperational,
          governance: lastGovernance,
          error,
        }),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: message, service: 'companion-surface' })
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

      let turn
      if (parsed.localOnly) {
        turn = respondLocal(conv, parsed.message)
      } else if (isPipelineIntent(parsed.message)) {
        turn = await respondWithPipeline(conv, parsed.message, session)
      } else {
        turn = await respondWithProvider(conv, parsed.message, session)
      }

      sendJson(res, 200, {
        turn: {
          role: turn.role,
          content: turn.content,
          at: turn.at,
          via: turn.via,
        },
        turns: buildSurfaceSnapshot({
          session: conv,
          operational: lastOperational,
          governance: lastGovernance,
        }).turns,
      })
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
      sendJson(
        res,
        200,
        buildSurfaceSnapshot({
          session: conv,
          operational: lastOperational,
          governance: lastGovernance,
          error,
        }),
      )
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
