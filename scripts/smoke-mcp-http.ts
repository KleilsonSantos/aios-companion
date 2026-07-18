/**
 * Opt-in smoke: AIOS MCP Streamable HTTP ↔ Companion client (#100).
 *
 * Requires AIOS_HOME (AIOS ≥0.25.0). Not part of default `pnpm test` / CI.
 *
 * Usage: pnpm smoke:mcp-http
 */
import { createServer } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { AiosMcpSession } from '../src/aios/mcp-client.ts'

const HEALTH_TIMEOUT_MS = 20_000
const HEALTH_POLL_MS = 200

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address()
      if (!addr || typeof addr === 'string') {
        s.close()
        reject(new Error('could not bind ephemeral port'))
        return
      }
      const port = addr.port
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
    s.on('error', reject)
  })
}

async function waitHealth(base: string): Promise<void> {
  const url = `${base}/health`
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  let last = ''
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const body = (await res.json()) as {
          ok?: boolean
          service?: string
          transport?: string
        }
        if (
          body.ok === true &&
          body.service === 'aios-mcp' &&
          body.transport === 'streamable-http'
        ) {
          return
        }
        last = JSON.stringify(body)
      } else {
        last = `HTTP ${res.status}`
      }
    } catch (err) {
      last = err instanceof Error ? err.message : String(err)
    }
    await delay(HEALTH_POLL_MS)
  }
  throw new Error(`health not ready within ${HEALTH_TIMEOUT_MS}ms (${last})`)
}

function killChild(child: ChildProcess): void {
  if (child.killed || child.exitCode != null) return
  try {
    child.kill('SIGTERM')
  } catch {
    /* ignore */
  }
}

async function main(): Promise<void> {
  const aiosHome = (process.env.AIOS_HOME || '').trim()
  if (!aiosHome) {
    console.error('smoke-mcp-http> skip — set AIOS_HOME to an AIOS checkout (≥0.25.0)')
    process.exit(0)
  }

  const mcpEntry = join(aiosHome, 'apps', 'mcp', 'src', 'index.ts')
  if (!existsSync(mcpEntry)) {
    console.error(`smoke-mcp-http> FAIL — MCP entry missing: ${mcpEntry}`)
    process.exit(1)
  }

  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  const mcpUrl = `${base}/mcp`

  console.log(`smoke-mcp-http> spawning AIOS HTTP MCP on ${mcpUrl}`)

  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', mcpEntry, '--http', '--port', String(port)],
    {
      cwd: aiosHome,
      env: {
        ...process.env,
        AIOS_MCP_HTTP: '1',
        AIOS_MCP_QUIET: '1',
        AIOS_MCP_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let stderr = ''
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })

  let session: AiosMcpSession | null = null
  try {
    await waitHealth(base)
    console.log('smoke-mcp-http> health OK')

    process.env.AIOS_MCP_URL = mcpUrl
    session = new AiosMcpSession(aiosHome)
    await session.connect()
    if (session.getTransportKind() !== 'http') {
      throw new Error(`expected http transport, got ${session.getTransportKind()}`)
    }
    console.log('smoke-mcp-http> connect OK (http)')

    const contract = await session.contractVersion()
    if (!contract.ok) {
      throw new Error(contract.summary)
    }
    console.log(`smoke-mcp-http> ${contract.summary}`)
    console.log('smoke-mcp-http> PASS')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`smoke-mcp-http> FAIL — ${msg}`)
    if (stderr.trim()) {
      console.error('--- AIOS stderr (tail) ---')
      console.error(stderr.slice(-2000))
    }
    process.exitCode = 1
  } finally {
    if (session) await session.close().catch(() => undefined)
    killChild(child)
    await delay(300)
    if (child.exitCode == null && !child.killed) {
      try {
        child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
    }
  }
}

await main()
