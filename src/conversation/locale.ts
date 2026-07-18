/**
 * Chat copy locales — tiny module (no i18n library).
 * Default: en · optional: COMPANION_LOCALE=pt|pt-BR|pt-PT
 */
export type CompanionLocale = 'en' | 'pt'

export function resolveLocale(
  raw: string | undefined = process.env.COMPANION_LOCALE,
): CompanionLocale {
  const v = (raw ?? 'en').trim().toLowerCase()
  if (v === 'pt' || v.startsWith('pt-')) return 'pt'
  return 'en'
}

export type ChatCopy = {
  operationalPrefix: string
  empty: string
  system: (summary: string, branch: string) => string
  pipelineHint: string
  noSnapshot: string
  help: string
  github: string
  git: string
  localFallback: (snippet: string) => string
  pipelineFailed: (msg: string) => string
}

const en: ChatCopy = {
  operationalPrefix: 'Operational state:',
  empty: '(empty)',
  system: (summary, branch) =>
    [
      'You are the AIOS Companion (experience). AIOS governs; you converse.',
      'Do not invent policies — suggest consulting the control plane.',
      `Operational state: ${summary}${branch}`,
      'Analysis/inspection of the project → AIOS pipeline (do not improvise).',
      'Voice and IDE/Docker control are out of scope in this MVP.',
      'Capabilities: `companion caps` (git / github via on-demand CLI).',
      'Keep replies short and practical in English.',
    ].join('\n'),
  pipelineHint:
    'This needs the AIOS core. Run `companion run "…"`, `/run …` in chat, or connect MCP (without `--local`).',
  noSnapshot: 'No snapshot — run `companion status`.',
  help: 'Commands: "status"; analysis → pipeline; `companion caps|gov|audit|memory|decide|run|run-all|brief|workspaces|knowledge|providers|policies`. Voice not yet.',
  github:
    'GitHub: run `companion caps github` (uses `gh` if authenticated). Companion does not duplicate APIs.',
  git: 'Git: run `companion caps git` (CLI or AIOS snapshot). No watchers in this MVP.',
  localFallback: (snippet) =>
    [
      `Recorded: “${snippet}”.`,
      'AIOS provider unavailable — local reply.',
      'Validate on the control plane: `companion status` / console Try it.',
    ].join(' '),
  pipelineFailed: (msg) =>
    `Pipeline failed: ${msg}. Try \`companion run\` or \`/run\`.`,
}

const pt: ChatCopy = {
  operationalPrefix: 'Estado operacional:',
  empty: '(vazio)',
  system: (summary, branch) =>
    [
      'És o Companion do AIOS (experiência). O AIOS governa; tu conversas.',
      'Não inventes policies — sugere consultar o control plane.',
      `Estado operacional: ${summary}${branch}`,
      'Pedidos de análise/inspeção do projeto → pipeline AIOS (não improvisar).',
      'Voz e controlo de IDE/Docker estão fora de escopo neste MVP.',
      'Capabilities: `companion caps` (git / github via CLI on-demand).',
      'Respostas curtas e práticas em português.',
    ].join('\n'),
  pipelineHint:
    'Isto pede o núcleo AIOS. Corre `companion run "…"`, `/run …` no chat, ou liga MCP (sem `--local`).',
  noSnapshot: 'Sem snapshot — corre `companion status`.',
  help: 'Comandos: "status"; análise → pipeline; `companion caps|gov|audit|memory|decide|run|run-all|brief|workspaces|knowledge|providers|policies`. Voz ainda não.',
  github:
    'GitHub: corre `companion caps github` (usa `gh` se autenticado). Não duplico APIs no Companion.',
  git: 'Git: corre `companion caps git` (CLI ou snapshot AIOS). Sem watchers neste MVP.',
  localFallback: (snippet) =>
    [
      `Registei: “${snippet}”.`,
      'Provider AIOS indisponível — resposta local.',
      'Valida no control plane: `companion status` / console Try it.',
    ].join(' '),
  pipelineFailed: (msg) =>
    `Pipeline falhou: ${msg}. Tenta \`companion run\` ou \`/run\`.`,
}

export function chatCopy(locale: CompanionLocale = resolveLocale()): ChatCopy {
  return locale === 'pt' ? pt : en
}
