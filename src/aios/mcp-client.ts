/**
 * Cliente MCP → AIOS control plane (stdio on-demand).
 * Consome `aios_operational_state` — não duplica engines.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  resolveAiosHome,
  type OperationalStateLite,
} from './cli-bridge.ts'

function mcpEntry(aiosHome: string): string {
  return join(aiosHome, 'apps', 'mcp', 'src', 'index.ts')
}

function parseToolText(result: {
  content?: Array<{ type: string; text?: string }>
}): OperationalStateLite {
  const text = result.content
    ?.filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n')
    .trim()
  if (!text) throw new Error('aios_operational_state: resposta vazia')
  return JSON.parse(text) as OperationalStateLite
}

/**
 * Snapshot via MCP stdio (Resource-Aware: processo sobe e desce no pedido).
 */
export async function fetchOperationalStateMcp(
  options: { aiosHome?: string; workspaceId?: string } = {},
): Promise<OperationalStateLite> {
  const aiosHome = options.aiosHome || resolveAiosHome()
  const entry = mcpEntry(aiosHome)
  if (!existsSync(entry)) {
    throw new Error(`MCP AIOS não encontrado: ${entry}`)
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--experimental-strip-types', entry],
    cwd: aiosHome,
    env: {
      ...process.env,
      AIOS_HOME: aiosHome,
    } as Record<string, string>,
  })

  const client = new Client({
    name: 'aios-companion',
    version: '0.1.0',
  })

  try {
    await client.connect(transport)
    const result = await client.callTool({
      name: 'aios_operational_state',
      arguments: {
        homePath: aiosHome,
        ...(options.workspaceId
          ? { workspaceId: options.workspaceId }
          : {}),
      },
    })
    return parseToolText(
      result as { content?: Array<{ type: string; text?: string }> },
    )
  } finally {
    await client.close().catch(() => undefined)
  }
}
