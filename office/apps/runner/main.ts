import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  openSync,
  closeSync,
} from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import os from 'node:os';
import { config, officeRoot, processEnv } from '../../packages/orchestration/config.ts';
import { execFileSync } from 'node:child_process';
import { Store } from '../../packages/orchestration/store.ts';
import { Scheduler } from '../../packages/orchestration/scheduler.ts';
import { verifyModels } from '../../packages/anthropic-adapter/index.ts';
import { RunInput, type Event } from '../../packages/contracts/index.ts';
import { git, identity } from '../../packages/git-integration/index.ts';
import { redact, within } from '../../packages/orchestration/policy.ts';
import { z } from 'zod';
import {
  ownedAlive,
  cancelOwned,
  type ProcessReceipt,
} from '../../packages/orchestration/owned-process.ts';

const cfg = config(),
  store = new Store(path.join(cfg.paths.state, 'office.sqlite')),
  scheduler = new Scheduler(store, cfg);
const lock = path.join(cfg.paths.state, 'runner.json');
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
if (existsSync(lock)) {
  const old = JSON.parse(readFileSync(lock, 'utf8'));
  if (alive(old.pid)) throw new Error(`Runner ya activo (PID ${old.pid})`);
  unlinkSync(lock);
}
const lockFd = openSync(lock, 'wx');
closeSync(lockFd);
const token = randomBytes(32).toString('hex');
writeFileSync(
  lock,
  JSON.stringify({ pid: process.pid, port: cfg.port, token, startedAt: new Date().toISOString() }),
);
store.recover();
const survivors = (store.queries() as any[])
  .filter((q) => ['running', 'unreconciled'].includes(q.status))
  .map((q) => ({ query: q, receipt: JSON.parse(q.body).process as ProcessReceipt | undefined }))
  .filter(
    (item): item is { query: any; receipt: ProcessReceipt } =>
      !!item.receipt && ownedAlive(item.receipt),
  );
for (const item of survivors)
  store.event('recovery.process_detected', item.query.run_id, item.query.task_id, {
    pid: item.receipt.pid,
    queryId: item.query.id,
    reason: 'Proceso propio sigue vivo; no repetir tarea hasta detenerlo.',
  });
let api: { ok: boolean; error?: string; models: string[] } = {
  ok: false,
  error: 'Comprobando Models API…',
  models: [],
};
let github = { login: 'pendiente', verified: false };
try {
  const login = execFileSync('gh', ['api', 'user', '--jq', '.login'], {
    encoding: 'utf8',
    windowsHide: true,
    env: processEnv(cfg),
    timeout: 10000,
  }).trim();
  github = { login, verified: login === 'M1gu3hb' };
} catch {
  /* doctor reports the actual session */
}
const sessionPaths = cfg.paths;
let cpuPrevious = os.cpus(),
  cpuPercent = 0;
const resourceTimer = setInterval(() => {
  const current = os.cpus();
  let total = 0,
    idle = 0;
  current.forEach((cpu, i) => {
    const before = cpuPrevious[i];
    if (!before) return;
    idle += cpu.times.idle - before.times.idle;
    for (const key of ['user', 'nice', 'sys', 'idle', 'irq'] as const)
      total += cpu.times[key] - before.times[key];
  });
  cpuPercent = total ? Math.round(100 * (1 - idle / total)) : 0;
  cpuPrevious = current;
}, 3000);
function snapshot() {
  const settings = store.settings(),
    cost = store.cost();
  return {
    api,
    github,
    config: {
      director: cfg.director,
      worker: cfg.worker,
      maxWorkers: scheduler.maxWorkers(),
      totalBudget: cfg.totalBudget,
      productWrite: cfg.productWrite,
      paths: sessionPaths,
    },
    settings,
    cost,
    runs: store.runs(),
    tasks: store.tasks(),
    events: store.events(0, Number(settings.retention ?? 250)),
    queries: store.queries(),
    totals: store.totals(),
    system: {
      survivingProcesses: survivors
        .filter((item) => ownedAlive(item.receipt))
        .map((item) => ({ runId: item.query.run_id, pid: item.receipt.pid })),
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cpuCount: os.availableParallelism(),
      cpuPercent,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      active: scheduler.active.size,
      apiLimits:
        'Límites de cuenta no disponibles con esta clave. Los errores 429 aparecen en el timeline.',
    },
  };
}
function json(res: ServerResponse, value: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(redact(JSON.stringify(value), cfg.apiKey));
}
async function body(req: IncomingMessage) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 100_000) throw new Error('Petición demasiado grande');
  }
  return data ? JSON.parse(data) : {};
}
function authorized(req: IncomingMessage) {
  const provided = req.headers['x-office-token'];
  if (typeof provided !== 'string' || provided.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(token));
}
function exportRun(id: string) {
  const run = store.run(id);
  if (!run) throw new Error('Misión no encontrada');
  return {
    version: 1,
    run,
    tasks: store.tasks(id),
    queries: store.queries(id),
    events: store.runEvents(id),
    cost: store.cost(id),
    billing: 'Estimación del SDK; confirmar facturación en la Console de Anthropic.',
  };
}
function makeFixture(id: string) {
  const repo = path.join(cfg.paths.root, 'workspaces', id);
  mkdirSync(repo, { recursive: true });
  git(repo, 'init', '-b', 'main');
  identity(repo);
  writeFileSync(
    path.join(repo, 'package.json'),
    JSON.stringify({
      type: 'module',
      name: 'office-fixture',
      scripts: { test: 'node --test *.test.js' },
    }),
  );
  writeFileSync(path.join(repo, 'math.js'), 'export const add = (a, b) => a - b;\n');
  writeFileSync(path.join(repo, 'text.js'), 'export const greet = name => `Hi ${name}`;\n');
  writeFileSync(
    path.join(repo, 'math.test.js'),
    "import {test} from 'node:test';import assert from 'node:assert/strict';import {add} from './math.js';test('sum',()=>assert.equal(add(2,3),5));\n",
  );
  writeFileSync(
    path.join(repo, 'text.test.js'),
    "import {test} from 'node:test';import assert from 'node:assert/strict';import {greet} from './text.js';test('greeting',()=>assert.equal(greet('Morphiq'),'Hola Morphiq'));\n",
  );
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'Fixture para smoke test');
  return repo;
}
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; script-src 'self'; frame-ancestors 'none'",
  );
  const origin = req.headers.origin,
    expected = `http://127.0.0.1:${cfg.port}`;
  if (
    req.headers.host !== `127.0.0.1:${cfg.port}` &&
    req.headers.host !== `localhost:${cfg.port}`
  ) {
    json(res, { error: 'Host no permitido' }, 403);
    return;
  }
  if (origin && origin !== expected && origin !== `http://localhost:${cfg.port}`) {
    json(res, { error: 'Origen no permitido' }, 403);
    return;
  }
  const url = new URL(req.url ?? '/', expected),
    pathname = url.pathname;
  try {
    if (req.method === 'GET' && pathname === '/api/session') {
      json(res, { token });
      return;
    }
    if (req.method === 'GET' && pathname === '/api/state') {
      json(res, snapshot());
      return;
    }
    if (req.method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const after = Number(req.headers['last-event-id'] ?? url.searchParams.get('after') ?? 0);
      const send = (event: Event) => {
        if (res.writableLength > 1_000_000) {
          res.destroy();
          return;
        }
        res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
      };
      for (const event of store.events(after)) send(event);
      store.bus.on('event', send);
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
      req.on('close', () => {
        clearInterval(heartbeat);
        store.bus.off('event', send);
      });
      return;
    }
    if (req.method === 'GET' && /^\/api\/runs\/[^/]+\/export$/.test(pathname)) {
      const id = pathname.split('/')[3],
        report = exportRun(id);
      if (url.searchParams.get('format') === 'csv') {
        const quote = (value: unknown) =>
          '"' +
          String(value ?? '')
            .replaceAll('"', '""')
            .replace(/^[=+@-]/, "'") +
          '"';
        const rows = [
          [
            'run_id',
            'task_id',
            'query',
            'model',
            'session',
            'estimated_usd',
            'reserved_usd',
            'status',
            'duration_ms',
            'session_api_ms',
            'session_usage_json',
          ],
          ...(report.queries as any[]).map((q) => {
            const metadata = JSON.parse(q.body);
            return [
              q.run_id,
              q.task_id,
              q.id,
              q.model,
              q.session_id,
              q.cost,
              q.reserved,
              q.status,
              metadata.durationMs,
              metadata.apiMs,
              JSON.stringify(metadata.usage ?? {}),
            ];
          }),
        ];
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${id}.csv"`,
        });
        res.end('\uFEFF' + rows.map((row) => row.map(quote).join(',')).join('\r\n'));
        return;
      }
      res.setHeader('Content-Disposition', `attachment; filename="${id}.json"`);
      json(res, report);
      return;
    }
    if (req.method !== 'GET') {
      if (!authorized(req)) {
        json(res, { error: 'Secreto de sesión inválido' }, 403);
        return;
      }
      if (req.method !== 'POST') {
        json(res, { error: 'Método no permitido' }, 405);
        return;
      }
      const input = await body(req);
      if (pathname === '/api/cancel-all') {
        const runs = store.runs().filter((run) => !['done', 'cancelled'].includes(run.status));
        for (const run of runs) {
          for (const item of survivors.filter((item) => item.query.run_id === run.id))
            if (cancelOwned(item.receipt))
              store.event('recovery.process_cancelled', run.id, item.query.task_id, {
                pid: item.receipt.pid,
              });
          scheduler.control(run.id, 'cancel');
        }
        json(res, { cancelledRuns: runs.map((run) => run.id), cost: store.cost() });
        return;
      }
      if (pathname === '/api/runs') {
        const spec = RunInput.parse(input);
        const id = spec.idempotencyKey;
        if (store.run(id)) {
          json(res, store.run(id));
          return;
        }
        if (!api.ok) throw new Error(api.error ?? 'API no disponible');
        if (spec.kind === 'product' && (!cfg.productWrite || !spec.authorizeProductWrite))
          throw new Error(
            'Producto en modo lectura; habilita una misión autorizada posteriormente',
          );
        if (spec.kind === 'fixture') {
          const spent = store
            .runs()
            .filter((r) => r.kind === 'fixture')
            .reduce((sum, r) => sum + store.cost(r.id).spent + store.cost(r.id).reserved, 0);
          if (spec.budget > cfg.bootstrapBudget - spent)
            throw new Error('El límite global de bootstrap no tiene capacidad para esta prueba');
        }
        const repo = spec.kind === 'fixture' ? makeFixture(id) : cfg.paths.product;
        const run = store.createRun({
          id,
          objective: spec.objective,
          budget: spec.budget,
          kind: spec.kind,
          repo,
          authorizeProductWrite: spec.authorizeProductWrite,
        });
        json(res, run, 201);
        return;
      }
      if (/^\/api\/runs\/[^/]+\/(pause|resume|cancel)$/.test(pathname)) {
        const [, , , id, action] = pathname.split('/');
        const ownSurvivors = survivors.filter(
          (item) => item.query.run_id === id && ownedAlive(item.receipt),
        );
        if (action === 'resume' && ownSurvivors.length)
          throw new Error(
            'Hay procesos propios vivos de la ejecución anterior; cancela antes de retomar.',
          );
        if (action === 'cancel')
          for (const item of ownSurvivors)
            if (cancelOwned(item.receipt))
              store.event('recovery.process_cancelled', id, item.query.task_id, {
                pid: item.receipt.pid,
              });
        json(res, scheduler.control(id, action as 'pause' | 'resume' | 'cancel'));
        return;
      }
      if (/^\/api\/runs\/[^/]+\/context$/.test(pathname)) {
        const id = pathname.split('/')[3],
          run = store.run(id),
          context = z.string().min(5).max(6000).parse(input.context);
        if (!run || run.status !== 'blocked')
          throw new Error('Solo una misión bloqueada requiere contexto del director');
        if (store.cost(id).unreconciled)
          throw new Error('Reconciliar queries interrumpidas antes de continuar');
        store.event('run.context', id, undefined, { context });
        json(
          res,
          store.updateRun(id, {
            objective: run.objective + '\nContexto del propietario: ' + context,
            status: 'queued',
            directorPasses: 0,
            reason: undefined,
          }),
        );
        return;
      }
      if (/^\/api\/tasks\/[^/]+\/retry$/.test(pathname)) {
        const context = z.string().min(5).max(6000).parse(input.context);
        const taskId = pathname.split('/')[3];
        if (survivors.some((item) => item.query.task_id === taskId && ownedAlive(item.receipt)))
          throw new Error('Un proceso propio anterior sigue vivo; cancela primero.');
        json(res, scheduler.retry(taskId, context));
        return;
      }
      if (pathname === '/api/settings') {
        const schema = z.object({
          maxWorkers: z.number().int().min(1).max(8).optional(),
          manualBalance: z.number().min(0).nullable().optional(),
          creditExpiry: z.string().nullable().optional(),
          budgetAlertPercent: z.number().min(1).max(100).optional(),
          retention: z.number().int().min(50).max(1000).optional(),
        });
        store.saveSettings({ ...store.settings(), ...schema.parse(input) });
        json(res, store.settings());
        return;
      }
      if (pathname === '/api/reconcile') {
        const spec = z
            .object({ queryId: z.string(), cost: z.number().min(0).max(100) })
            .parse(input),
          query = store.query(spec.queryId);
        if (query?.status !== 'unreconciled')
          throw new Error('La query no requiere reconciliación');
        store.closeQuery(spec.queryId, spec.cost);
        store.event('usage.reconciled', query.run_id, query.task_id ?? undefined, {
          queryId: spec.queryId,
          cost: spec.cost,
          source: 'manual Console',
        });
        json(res, { ok: true });
        return;
      }
      if (pathname === '/api/verify') {
        api = await verifyModels(cfg);
        scheduler.enabled = api.ok;
        json(res, api);
        return;
      }
      if (pathname === '/api/stop') {
        json(res, { stopping: true });
        setTimeout(() => void shutdown(), 50);
        return;
      }
      json(res, { error: 'Acción no encontrada' }, 404);
      return;
    }
    const base = path.join(officeRoot, 'dist/web');
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const file = path.resolve(base, relative);
    if (!within(base, file) || relative.includes('.env') || !existsSync(file)) {
      res.writeHead(404);
      res.end('Archivo no encontrado');
      return;
    }
    const mime: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch (error) {
    json(
      res,
      { error: redact(error instanceof Error ? error.message : String(error), cfg.apiKey) },
      400,
    );
  }
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(resourceTimer);
  await scheduler.stop();
  server.closeAllConnections();
  server.close();
  if (existsSync(lock)) unlinkSync(lock);
  store.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
server.listen(cfg.port, cfg.host, () => {
  console.log(`Morphiq Oficina: http://${cfg.host}:${cfg.port}`);
  scheduler.start();
  void verifyModels(cfg).then((result) => {
    api = result;
    scheduler.enabled = result.ok;
    store.event('api.verified', undefined, undefined, result);
  });
});
