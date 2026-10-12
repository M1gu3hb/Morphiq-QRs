import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from '../packages/orchestration/config.ts';
const cfg = config(),
  runner = JSON.parse(readFileSync(path.join(cfg.paths.state, 'runner.json'), 'utf8'));
const base = `http://127.0.0.1:${runner.port}`,
  headers = { 'Content-Type': 'application/json', 'x-office-token': runner.token };
let state: any;
for (let i = 0; i < 30; i++) {
  state = await (await fetch(base + '/api/state')).json();
  if (state.api.ok) break;
  if (state.api.error !== 'Comprobando Models API…') throw new Error(state.api.error);
  await new Promise((r) => setTimeout(r, 500));
}
if (!state.api.ok) throw new Error('Models API no disponible');
const fresh = process.argv.includes('--new');
const prior = fresh
  ? undefined
  : state.runs.find((r: any) => r.kind === 'fixture' && r.status !== 'cancelled');
const id = prior?.id ?? 'bootstrap-' + Date.now();
if (!prior) {
  const fixtureIds = new Set(
    state.runs.filter((r: any) => r.kind === 'fixture').map((r: any) => r.id),
  );
  const used = state.queries
    .filter((q: any) => fixtureIds.has(q.run_id))
    .reduce((total: number, q: any) => total + q.cost + q.reserved, 0);
  const remaining = cfg.bootstrapBudget - used;
  if (remaining < 0.4)
    throw new Error('Presupuesto bootstrap restante insuficiente para otro smoke');
  const response = await fetch(base + '/api/runs', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      idempotencyKey: id,
      kind: 'fixture',
      budget: Math.min(remaining, fresh ? 1 : cfg.bootstrapBudget),
      objective:
        'Corrige dos fallos independientes del fixture: math.js add(2,3) debe devolver 5 y text.js greet("Morphiq") debe devolver "Hola Morphiq". Crea al menos dos tareas independientes, una para cada archivo. No edites tests. Haiku debe ejecutar math.test.js o text.test.js según alcance; solicita revisiones independientes y finalmente integra ambos commits con la suite completa verde. No hagas push.',
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  console.log('Smoke real iniciado: ' + id);
}
let last = '';
let completed = false;
const deadline = Date.now() + 12 * 60_000;
while (Date.now() < deadline) {
  state = await (await fetch(base + '/api/state')).json();
  const run = state.runs.find((r: any) => r.id === id),
    tasks = state.tasks.filter((t: any) => t.runId === id);
  const progress = run.status + ' ' + tasks.map((t: any) => t.id + ':' + t.status).join(', ');
  if (progress !== last) {
    console.log(progress);
    last = progress;
  }
  if (
    ['done', 'blocked', 'cancelled', 'paused'].includes(run.status) &&
    !state.queries.some((q: any) => q.run_id === id && q.status === 'running')
  ) {
    const response = await fetch(base + `/api/runs/${id}/export`);
    const report = await response.text();
    if (!response.ok) throw new Error(report);
    writeFileSync(path.join(cfg.paths.reports, 'smoke.json'), report);
    writeFileSync(path.join(cfg.paths.reports, `${id}.json`), report);
    console.log(
      JSON.stringify({
        id,
        status: run.status,
        cost: JSON.parse(report).cost,
        reason: run.reason,
        commit: run.commit,
      }),
    );
    if (run.status !== 'done') process.exitCode = 1;
    completed = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}
if (!completed)
  throw new Error(`Smoke ${id} excedió el tiempo de espera; consulta su estado en la oficina`);
