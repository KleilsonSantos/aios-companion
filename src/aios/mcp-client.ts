/**
 * Cliente MCP → AIOS control plane (stdio on-demand / sessão de chat).
 * Consome tools aios_* — não duplica engines (ADR-0014).
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

function toolText(result: {
  content?: Array<{ type: string; text?: string }>
  isError?: boolean
}): string {
  const text = result.content
    ?.filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n')
    .trim()
  if (!text) throw new Error('MCP tool: resposta vazia')
  if (result.isError) throw new Error(text)
  return text
}

export type ProviderChatResult = {
  content: string
  raw?: unknown
}

/** Sessão MCP reutilizável (Resource-Aware: um processo por chat, fecha no fim). */
export class AiosMcpSession {
  private client: Client | null = null
  private aiosHome: string

  constructor(aiosHome?: string) {
    this.aiosHome = aiosHome || resolveAiosHome()
  }

  async connect(): Promise<void> {
    if (this.client) return
    const entry = mcpEntry(this.aiosHome)
    if (!existsSync(entry)) {
      throw new Error(`MCP AIOS não encontrado: ${entry}`)
    }
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--experimental-strip-types', entry],
      cwd: this.aiosHome,
      env: {
        ...process.env,
        AIOS_HOME: this.aiosHome,
      } as Record<string, string>,
    })
    const client = new Client({
      name: 'aios-companion',
      version: '0.1.0',
    })
    await client.connect(transport)
    this.client = client
  }

  private requireClient(): Client {
    if (!this.client) throw new Error('MCP session não ligada — chama connect()')
    return this.client
  }

  async operationalState(
    options: { workspaceId?: string } = {},
  ): Promise<OperationalStateLite> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_operational_state',
      arguments: {
        homePath: this.aiosHome,
        ...(options.workspaceId
          ? { workspaceId: options.workspaceId }
          : {}),
      },
    })
    const text = toolText(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    return JSON.parse(text) as OperationalStateLite
  }

  /**
   * Chat auxiliar via AIOS provider (Ollama por defeito).
   * Resource-Aware: falha se provider offline — caller faz fallback local.
   */
  async providerChat(options: {
    message: string
    system?: string
    provider?: string
    model?: string
  }): Promise<ProviderChatResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_provider_chat',
      arguments: {
        message: options.message,
        ...(options.system ? { system: options.system } : {}),
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.model ? { model: options.model } : {}),
      },
    })
    const text = toolText(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    let raw: unknown = text
    try {
      raw = JSON.parse(text)
    } catch {
      return { content: text }
    }
    const obj = raw as {
      message?: { content?: string }
      content?: string
      text?: string
    }
    const content =
      obj.message?.content || obj.content || obj.text || text
    return { content: String(content).trim() || text, raw }
  }

  async close(): Promise<void> {
    if (!this.client) return
    await this.client.close().catch(() => undefined)
    this.client = null
  }
}

/**
 * Snapshot one-shot via MCP (sobe e desce o processo).
 */
export async function fetchOperationalStateMcp(
  options: { aiosHome?: string; workspaceId?: string } = {},
): Promise<OperationalStateLite> {
  const session = new AiosMcpSession(options.aiosHome)
  try {
    await session.connect()
    return await session.operationalState({
      workspaceId: options.workspaceId,
    })
  } finally {
    await session.close()
  }
}
