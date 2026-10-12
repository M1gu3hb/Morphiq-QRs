import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { config, processEnv, officeRoot } from '../packages/orchestration/config.ts';
import { Store } from '../packages/orchestration/store.ts';
import { Scheduler, taskSkills } from '../packages/orchestration/scheduler.ts';
import { Roles } from '../packages/contracts/index.ts';
import { execute } from '../packages/orchestration/process.ts';
import { ownedAlive, cancelOwned } from '../packages/orchestration/owned-process.ts';
import { estimate } from '../packages/telemetry/index.ts';
import { officeToolAllowed } from '../packages/anthropic-adapter/index.ts';
const root = 'D:/MIS PROYECTOS/Morphiq Oficina/temp';
test('an authorized product failure returns to Opus for recovery without requiring owner intervention', async () => {
  const dir = mkdtempSync(path.join(root, 'autonomous-')),
    db = new Store(path.join(dir, 's.sqlite')),
    scheduler = new Scheduler(db, config());
  db.createRun({
    id: 'r',
    repo: dir,
    budget: 5,
    kind: 'product',
    objective: 'autonomous recovery',
    authorizeProductWrite: true,
  });
  db.saveSettings({ authorizedProductRunId: 'r' });
  db.updateRun('r', { status: 'running' });
  db.createTask({
    id: 'work',
    runId: 'r',
    title: 'first failure',
    brief: 'recover',
    files: [],
    acceptance: ['pass'],
    role: 'web',
    kind: 'work',
    dependencies: [],
  });
  db.updateTask('work', { status: 'blocked', attempts: 1, reason: 'diagnostic available' });
  const directed: string[] = [];
  scheduler.enabled = true;
  scheduler.direct = async (run) => {
    directed.push(run.id);
  };
  await scheduler.tick();
  assert.deepEqual(directed, ['r']);
  assert.equal(db.run('r')!.status, 'running');
  db.close();
});
test('each worker starts with a skill actually allowed to its role, including integration and reviews', () => {
  const roles = JSON.parse(
    readFileSync(path.join(officeRoot, 'agent-kit/agents/roles.json'), 'utf8'),
  );
  for (const role of Roles.options)
    for (const skill of taskSkills({ kind: 'work', role }))
      assert.ok(roles[role].includes(skill), role + ': ' + skill);
  assert.deepEqual(taskSkills({ kind: 'review', role: 'review' }), ['morphiq-review']);
});
test('product evidence records the npm script actually executed rather than an ignored fixture test selector', async () => {
  const dir = mkdtempSync(path.join(root, 'check-label-')),
    db = new Store(path.join(dir, 's.sqlite')),
    scheduler = new Scheduler(db, config());
  db.createRun({
    id: 'r',
    repo: dir,
    budget: 5,
    kind: 'product',
    objective: 'evidence label',
    authorizeProductWrite: true,
  });
  db.saveSettings({ authorizedProductRunId: 'r' });
  const task = db.createTask({
    id: 'work',
    runId: 'r',
    title: 'check',
    brief: 'real command',
    files: [],
    acceptance: ['pass'],
    role: 'research',
    kind: 'work',
    dependencies: [],
  });
  db.updateTask(task.id, { worktree: dir });
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ type: 'module', scripts: { test: 'node --test actual.test.js' } }),
  );
  writeFileSync(
    path.join(dir, 'actual.test.js'),
    "import {test} from 'node:test';test('actual product test',()=>{});\n",
  );
  const evidence = await scheduler.check(
    db.task(task.id)!,
    'test',
    undefined,
    undefined,
    'nonexistent-fixture.test.js',
  );
  assert.equal(evidence.exitCode, 0);
  assert.equal(evidence.command, 'npm run test');
  assert.match(evidence.output, /actual product test/);
  db.close();
});
test('pause prevents claims; cancellation aborts owned work and preserves verified evidence', () => {
  const dir = mkdtempSync(path.join(root, 'scheduler-')),
    db = new Store(path.join(dir, 's.sqlite')),
    cfg = config(),
    scheduler = new Scheduler(db, cfg);
  db.createRun({ id: 'r', repo: dir, budget: 5, kind: 'fixture', objective: 'cancel fixture' });
  for (const id of ['a', 'b']) {
    db.createTask({
      id,
      runId: 'r',
      title: id,
      brief: id,
      acceptance: ['pass'],
      files: [id + '.js'],
      role: 'web',
      kind: 'work',
      dependencies: [],
    });
    db.assign(id);
  }
  db.updateTask('a', {
    status: 'verified',
    report: { status: 'DONE', summary: 'evidence', files: [], tests: [], concerns: [] },
  });
  scheduler.control('r', 'pause');
  assert.equal(db.claim('r', 4), undefined);
  const controller = new AbortController();
  scheduler.active.set('b', { runId: 'r', controller });
  scheduler.control('r', 'cancel');
  assert.equal(controller.signal.aborted, true);
  assert.equal(db.task('a')?.status, 'verified');
  assert.equal(db.task('b')?.status, 'cancelled');
  db.close();
});
test('command execution passes only sanitized environment and cancellation kills its process', async () => {
  const cfg = config();
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 500);
  const dir = mkdtempSync(path.join(root, 'process-')),
    file = path.join(dir, 'slow.cjs');
  writeFileSync(file, 'setInterval(()=>{},1000);\n');
  await assert.rejects(execute(process.execPath, [file], dir, cfg, controller.signal), /abort/i);
  const env = processEnv(cfg);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.CLAUDE_CONFIG_DIR, cfg.paths.sessions);
  assert.equal(env.TEMP, cfg.paths.temp);
  assert.equal(processEnv(cfg, true).ANTHROPIC_API_KEY, cfg.apiKey);
  assert.equal(env.PATH ?? env.Path, process.env.PATH ?? process.env.Path);
});
test('retrying a rejected review restores its target; retrying implementation invalidates the old review', () => {
  const dir = mkdtempSync(path.join(root, 'review-retry-')),
    db = new Store(path.join(dir, 's.sqlite')),
    scheduler = new Scheduler(db, config());
  db.createRun({ id: 'r', repo: dir, budget: 1, kind: 'fixture', objective: 'review recovery' });
  db.createTask({
    id: 'work',
    runId: 'r',
    title: 'work',
    brief: 'implement',
    acceptance: ['pass'],
    files: ['text.js'],
    role: 'web',
    kind: 'work',
    dependencies: [],
  });
  db.createTask({
    id: 'review',
    runId: 'r',
    title: 'review',
    brief: 'check',
    acceptance: ['pass'],
    files: ['text.js'],
    role: 'review',
    kind: 'review',
    targetId: 'work',
    dependencies: [],
  });
  db.updateTask('work', {
    status: 'blocked',
    attempts: 1,
    reviewId: 'review',
    commit: 'saved-commit',
  });
  db.updateTask('review', { status: 'blocked', attempts: 1 });
  scheduler.retry('review', 'Comprueba el commit que creó el runner');
  assert.equal(db.task('work')?.status, 'review');
  assert.equal(db.task('work')?.commit, 'saved-commit');
  assert.equal(db.task('review')?.status, 'ready');
  db.updateTask('work', { status: 'blocked' });
  db.updateTask('review', { status: 'blocked' });
  scheduler.retry('work', 'Corrige el resultado y solicita una nueva revisión');
  assert.equal(db.task('review')?.status, 'cancelled');
  assert.equal(db.task('work')?.reviewId, undefined);
  db.close();
});
test('cancellation also stops descendants owned by the command', async () => {
  const cfg = config(),
    dir = mkdtempSync(path.join(root, 'tree-')),
    sentinel = path.join(dir, 'should-not-exist'),
    script = path.join(dir, 'parent.cjs');
  writeFileSync(
    script,
    `const {spawn}=require('node:child_process');spawn(process.execPath,['-e',${JSON.stringify(`setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(sentinel)},'leaked'),1800)`)}],{windowsHide:true});setInterval(()=>{},1000);`,
  );
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 500);
  await assert.rejects(execute(process.execPath, [script], dir, cfg, controller.signal), /abort/i);
  await new Promise((r) => setTimeout(r, 2200));
  assert.equal(existsSync(sentinel), false);
});
test('restart recovery checks executable and creation time before cancelling its own PID', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  await new Promise<void>((resolve) => child.once('spawn', resolve));
  const receipt = {
    pid: child.pid!,
    executable: process.execPath,
    startedAt: new Date().toISOString(),
    runnerPid: process.pid,
  };
  try {
    assert.equal(ownedAlive({ ...receipt, executable: 'D:/wrong.exe' }), false);
    assert.equal(ownedAlive({ ...receipt, startedAt: '2000-01-01T00:00:00Z' }), false);
    assert.equal(ownedAlive(receipt), true);
    const exited = new Promise((resolve) => child.once('exit', resolve));
    assert.equal(cancelOwned(receipt), true);
    await exited;
    assert.equal(ownedAlive(receipt), false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
});
test('verified rates apply Haiku prompt threshold, both cache write durations and unknown models', () => {
  assert.equal(estimate('claude-haiku-5-5', { input_tokens: 100000, output_tokens: 100000 }), 0.06);
  assert.equal(
    estimate('claude-haiku-5-5', { input_tokens: 100001, output_tokens: 100000 }),
    0.3000005,
  );
  assert.equal(
    estimate('claude-opus-5-5', {
      cache_creation_input_tokens: 200000,
      cache_creation: { ephemeral_5m_input_tokens: 100000, ephemeral_1h_input_tokens: 100000 },
    }),
    1.3,
  );
  assert.equal(estimate('unknown', { input_tokens: 1 }), null);
});
test('result tree includes native subagents once and resume uses the same reset epoch', () => {
  const db = new Store(path.join(mkdtempSync(path.join(root, 'ledger-')), 's.sqlite'));
  db.createRun({ id: 'r', objective: 'tree', repo: root, budget: 10, kind: 'fixture' });
  db.reserve('parent', 'r', 2, 10);
  db.recordResult('parent', 'session', 1, 0.5, {
    'claude-opus-5-5': { costUSD: 0.3, inputTokens: 100 },
    'claude-haiku-5-5': { costUSD: 0.2, inputTokens: 20 },
  });
  assert.equal(db.cost().spent, 0.5);
  assert.equal(db.sessionEpoch('session'), 1);
  db.closeQuery('parent');
  db.reserve('resume', 'r', 2, 10);
  db.recordResult('resume', 'session', db.sessionEpoch('session'), 0.8, {});
  assert.equal(db.cost().spent, 0.8);
  db.close();
});
test('tool permissions allow scoped MCP and role skills, and deny shell, delegation and other skills', () => {
  const skills = ['morphiq-office:morphiq-web'];
  assert.equal(officeToolAllowed('mcp__office__read_file', {}, skills), true);
  assert.equal(officeToolAllowed('Skill', { skill: skills[0] }, skills), true);
  for (const name of ['Bash', 'Write', 'Edit', 'Agent', 'Task', 'mcp__other__exec'])
    assert.equal(officeToolAllowed(name, {}, skills), false);
  assert.equal(
    officeToolAllowed('Skill', { skill: 'morphiq-office:morphiq-director' }, skills),
    false,
  );
});
test('all imported skills retain resources, licenses and every mapped role resolves', () => {
  const roles = JSON.parse(
    readFileSync(path.join(officeRoot, 'agent-kit/agents/roles.json'), 'utf8'),
  );
  for (const names of Object.values(roles) as string[][])
    for (const name of names)
      assert.ok(existsSync(path.join(officeRoot, 'agent-kit/skills', name, 'SKILL.md')), name);
  for (const name of ['claude-api', 'frontend-design', 'webapp-testing', 'mcp-builder'])
    assert.ok(existsSync(path.join(officeRoot, 'agent-kit/skills', name, 'LICENSE.txt')));
  assert.ok(
    readdirSync(path.join(officeRoot, 'agent-kit/skills/claude-api/typescript')).length > 0,
  );
});
test('local API rejects foreign origins and unauthorized control, and works without an API key', async () => {
  const dir = mkdtempSync(path.join(root, 'api-')),
    port = 4312;
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/runner/main.ts'], {
    cwd: officeRoot,
    windowsHide: true,
    env: {
      ...processEnv(config()),
      MORPHIQ_ROOT: dir,
      MORPHIQ_RUNNER_PORT: String(port),
      ANTHROPIC_API_KEY: '',
    },
    stdio: 'pipe',
  });
  let output = '';
  child.stderr.on('data', (data) => {
    output += data;
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(base + '/api/state')).ok) {
          ready = true;
          break;
        }
      } catch {
        /* startup */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, output);
    assert.equal(
      (await fetch(base + '/api/state', { headers: { Origin: 'https://evil.example' } })).status,
      403,
    );
    assert.equal((await fetch(base + '/api/settings', { method: 'POST', body: '{}' })).status, 403);
    const state = await (await fetch(base + '/api/state')).json();
    assert.equal(state.api.ok, false);
    assert.equal(state.api.error, 'API sin configurar');
    assert.equal(JSON.stringify(state).includes('ANTHROPIC_API_KEY='), false);
    const session = await (await fetch(base + '/api/session')).json(),
      headers = { 'Content-Type': 'application/json', 'x-office-token': session.token };
    assert.equal(
      (
        await fetch(base + '/api/settings', {
          method: 'POST',
          headers,
          body: JSON.stringify({ maxWorkers: 11 }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + '/api/settings', {
          method: 'POST',
          headers,
          body: JSON.stringify({ maxWorkers: 10 }),
        })
      ).status,
      200,
    );
    const run = await fetch(base + '/api/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        idempotencyKey: 'offline',
        objective: 'diagnóstico',
        kind: 'analysis',
        budget: 1,
      }),
    });
    assert.equal(run.status, 400);
    const cancelled = await fetch(base + '/api/cancel-all', { method: 'POST', headers });
    assert.equal(cancelled.status, 200);
    assert.deepEqual((await cancelled.json()).cancelledRuns, []);
    await fetch(base + '/api/stop', { method: 'POST', headers });
    await new Promise((r) => child.once('exit', r));
  } finally {
    if (child.exitCode === null) child.kill();
  }
});
