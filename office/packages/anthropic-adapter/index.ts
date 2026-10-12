import Anthropic from '@anthropic-ai/sdk';
import {
  query,
  type Options,
  type SDKMessage,
  type SDKResultMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Config } from '../orchestration/config.ts';
import { officeRoot, processEnv } from '../orchestration/config.ts';
import { redact } from '../orchestration/policy.ts';
import type { Store } from '../orchestration/store.ts';

export async function verifyModels(cfg: Config) {
  if (!cfg.apiKey) return { ok: false, error: 'API sin configurar', models: [] as string[] };
  const client = new Anthropic({
    baseURL: 'https://api.anthropic.com',
    apiKey: cfg.apiKey,
    maxRetries: 0,
    timeout: 15_000,
    defaultHeaders: cfg.workspaceId ? { 'anthropic-workspace-id': cfg.workspaceId } : undefined,
  });
  try {
    const page = await client.models.list({ limit: 100 });
    const models = page.data.map((m) => m.id);
    const missing = [cfg.director, cfg.worker].filter((m) => !models.includes(m));
    return {
      ok: !missing.length,
      error: missing.length ? `Modelos sin acceso: ${missing.join(', ')}` : undefined,
      models,
    };
  } catch (error) {
    return {
      ok: false,
      error: redact(error instanceof Error ? error.message : String(error), cfg.apiKey),
      models: [] as string[],
    };
  }
}
export function loadSkills(names: string[]) {
  return names
    .map((name) => {
      const file = path.join(officeRoot, 'agent-kit/skills', name, 'SKILL.md');
      if (!existsSync(file)) throw new Error(`Skill faltante: ${name}`);
      return readFileSync(file, 'utf8');
    })
    .join('\n\n');
}
export function officeToolAllowed(name: string, args: Record<string, unknown>, skills: string[]) {
  return (
    name.startsWith('mcp__office__') || (name === 'Skill' && skills.includes(String(args.skill)))
  );
}
export async function runQuery(input: {
  cfg: Config;
  store: Store;
  runId: string;
  taskId?: string;
  model: string;
  cwd: string;
  prompt: string;
  system: string;
  budget: number;
  signal: AbortSignal;
  mcp: NonNullable<Options['mcpServers']>;
  resume?: string;
  onSession?: (session: string) => void;
  onMessage?: (message: SDKMessage) => void;
}) {
  const { cfg, store } = input,
    id = randomUUID();
  if (!store.reserve(id, input.runId, input.budget, cfg.totalBudget, input.model, input.taskId))
    throw new Error('Presupuesto insuficiente para reservar solicitud en vuelo');
  if (input.taskId) store.updateTask(input.taskId, { queryId: id, model: input.model });
  store.event('agent.started', input.runId, input.taskId, {
    id,
    model: input.model,
    role: input.taskId ? 'worker' : 'director',
    budget: input.budget,
    cwd: input.cwd,
  });
  let result: SDKResultMessage | undefined,
    session = input.resume ?? '',
    epoch = store.sessionEpoch(session);
  const role = input.taskId ? (store.task(input.taskId)?.role ?? 'web') : 'director';
  const roles = JSON.parse(
    readFileSync(path.join(officeRoot, 'agent-kit/agents/roles.json'), 'utf8'),
  ) as Record<string, string[]>;
  const skills = roles[role].map((name) => 'morphiq-office:' + name);
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  input.signal.addEventListener('abort', abort, { once: true });
  if (input.signal.aborted) abort();
  const timer = setTimeout(abort, 5 * 60_000);
  try {
    const stream = query({
      prompt: input.prompt,
      options: {
        model: input.model,
        cwd: input.cwd,
        tools: ['Skill'],
        skills,
        disallowedTools: ['Agent', 'Task', 'Bash', 'Write', 'Edit', 'NotebookEdit'],
        mcpServers: input.mcp,
        permissionMode: 'default',
        canUseTool: async (name, args) => {
          const allowed = officeToolAllowed(name, args, skills);
          store.event('tool.permission', input.runId, input.taskId, { name, allowed });
          return allowed
            ? { behavior: 'allow', updatedInput: args }
            : { behavior: 'deny', message: 'Herramienta fuera del contrato Morphiq' };
        },
        systemPrompt: input.system,
        settingSources: [],
        persistSession: true,
        resume: input.resume,
        verbatimPrompts: true,
        env: {
          ...processEnv(cfg, true),
          CLAUDE_CODE_MAX_RETRIES: '2',
          CLAUDE_CODE_NONSTREAMING_TIMEOUT_RETRIES: '0',
          CLAUDE_CODE_MAX_OUTPUT_TOKENS: '4096',
        },
        maxBudgetUsd: input.budget,
        maxTurns: 18,
        effort: 'low',
        thinking: { type: 'adaptive' },
        abortController,
        plugins: [{ type: 'local', path: path.join(officeRoot, 'agent-kit') }],
        stderr: (line) =>
          store.event('runtime.stderr', input.runId, input.taskId, {
            text: redact(line, cfg.apiKey).slice(-2000),
          }),
        spawnClaudeCodeProcess: (options) => {
          const child = spawn(options.command, options.args, {
            cwd: options.cwd,
            env: options.env,
            signal: options.signal,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          store.queryMetadata(id, {
            process: {
              pid: child.pid,
              executable: options.command,
              startedAt: new Date().toISOString(),
              runnerPid: process.pid,
            },
          });
          store.event('runtime.process', input.runId, input.taskId, {
            pid: child.pid,
            queryId: id,
          });
          return child;
        },
      },
    });
    for await (const message of stream) {
      if ('session_id' in message && message.session_id) {
        session = message.session_id;
        input.onSession?.(session);
        if (input.taskId && store.task(input.taskId)?.sessionId !== session)
          store.updateTask(input.taskId, { sessionId: session });
      }
      if (message.type === 'conversation_reset') epoch++;
      if (message.type === 'assistant') {
        store.recordAssistant(id, session, message.message.id, message.message.usage);
        for (const content of message.message.content)
          if (content.type === 'tool_use') {
            if (input.taskId && content.name === 'Skill')
              store.updateTask(input.taskId, {
                skill: String((content.input as { skill?: string }).skill ?? ''),
              });
            store.event('agent.tool', input.runId, input.taskId, {
              agentId: id,
              name: content.name,
              skill:
                content.name === 'Skill' ? (content.input as { skill?: string }).skill : undefined,
            });
          } else if (content.type === 'text' && content.text)
            store.event('agent.message', input.runId, input.taskId, {
              agentId: id,
              text: redact(content.text, cfg.apiKey).slice(0, 6000),
            });
      }
      if (message.type === 'system' && message.subtype === 'init')
        store.event('agent.capabilities', input.runId, input.taskId, {
          agentId: id,
          tools: message.tools,
          model: message.model,
          apiKeySource: message.apiKeySource,
          skills: message.slash_commands,
        });
      if (message.type === 'system' && message.subtype === 'api_retry') {
        store.event('api.retry', input.runId, input.taskId, {
          attempt: message.attempt,
          maxRetries: message.max_retries,
          status: message.error_status,
          delayMs: message.retry_delay_ms,
        });
        if (input.taskId)
          store.updateTask(input.taskId, {
            reason: `Esperando API: ${message.error_status ?? 'red'}, reintento ${message.attempt}/${message.max_retries}`,
          });
      }
      if (message.type === 'result') {
        result = message;
        const unknown = Object.values(message.modelUsage).some(
          (usage) => usage.costBasis === 'unknown',
        );
        if (
          unknown ||
          ('subtype' in message &&
            message.subtype === 'error_during_execution' &&
            message.total_cost_usd === 0)
        )
          store.markIncomplete(id);
        else
          store.recordResult(
            id,
            message.session_id,
            epoch,
            message.total_cost_usd,
            message.modelUsage,
            {
              durationMs: message.duration_ms,
              apiMs: message.duration_api_ms,
              usage: message.usage,
              subtype: message.subtype,
            },
          );
        store.event('agent.result', input.runId, input.taskId, {
          agentId: id,
          sessionId: session,
          subtype: message.subtype,
          cost: message.total_cost_usd,
          usage: message.modelUsage,
          apiMs: message.duration_api_ms,
          durationMs: message.duration_ms,
          provisional: unknown,
        });
      }
      input.onMessage?.(message);
    }
    if (!result) throw new Error('Query terminada sin resultado; pendiente de reconciliar');
    if (store.query(id)?.status !== 'unreconciled') store.closeQuery(id);
    if (result.is_error)
      throw new Error('errors' in result ? result.errors.join('; ') : result.result);
    return { result, session, id };
  } catch (error) {
    if (!result) store.markIncomplete(id);
    else if (store.query(id)?.status !== 'unreconciled') store.closeQuery(id);
    throw new Error(redact(error instanceof Error ? error.message : String(error), cfg.apiKey));
  } finally {
    clearTimeout(timer);
    input.signal.removeEventListener('abort', abort);
    store.event('agent.stopped', input.runId, input.taskId, { id, sessionId: session });
  }
}
