/**
 * Lightweight surface conversation persistence (#85).
 * Local file only — on-demand write; no watchers / no cloud.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { ChatTurn, ConversationSession } from '../conversation/manager.ts'

const MAX_TURNS = 120

export function defaultSessionPath(): string {
  if (process.env.COMPANION_SESSION_PATH?.trim()) {
    return process.env.COMPANION_SESSION_PATH.trim()
  }
  return join(homedir(), '.aios-companion', 'surface-session.json')
}

function isChatTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  return (
    (t.role === 'system' || t.role === 'user' || t.role === 'assistant') &&
    typeof t.content === 'string' &&
    typeof t.at === 'string'
  )
}

/** Validate and normalize a persisted session payload. */
export function parseStoredSession(raw: unknown): ConversationSession | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.id !== 'string' || !obj.id) return null
  if (typeof obj.createdAt !== 'string' || !obj.createdAt) return null
  if (!Array.isArray(obj.turns)) return null
  const turns = obj.turns.filter(isChatTurn)
  if (turns.length === 0) return null
  if (!turns.some((t) => t.role === 'system')) return null
  return {
    id: obj.id,
    createdAt: obj.createdAt,
    turns: turns.slice(-MAX_TURNS),
  }
}

export function loadSession(
  path: string = defaultSessionPath(),
): ConversationSession | null {
  if (!existsSync(path)) return null
  try {
    const text = readFileSync(path, 'utf8')
    return parseStoredSession(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

export function saveSession(
  session: ConversationSession,
  path: string = defaultSessionPath(),
): string {
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true })
  const payload: ConversationSession = {
    id: session.id,
    createdAt: session.createdAt,
    turns: session.turns.slice(-MAX_TURNS),
  }
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return path
}

export function clearSession(path: string = defaultSessionPath()): void {
  if (!existsSync(path)) return
  writeFileSync(path, '', 'utf8')
}
