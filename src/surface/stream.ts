/**
 * SSE helpers for Companion surface chat (#88).
 * Progressive reveal of a completed reply — AIOS provider chat is still non-streaming.
 */

export type StreamPhase = 'memory' | 'local' | 'pipeline' | 'provider'

/** Split text into small chunks for progressive UI reveal (not token streaming). */
export function chunkText(text: string, size = 28): string[] {
  if (!text) return ['']
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

export function writeSseHeaders(res: import('node:http').ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
}

export function writeSseEvent(
  res: import('node:http').ServerResponse,
  event: string,
  data: unknown,
): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}
