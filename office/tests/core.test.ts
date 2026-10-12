import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { Store } from '../packages/orchestration/store.ts';
import { scopedPath, redact, retryDelay } from '../packages/orchestration/policy.ts';

const root = 'D:/MIS PROYECTOS/Morphiq Oficina/temp';
const setup = () => new Store(path.join(mkdtempSync(path.join(root, 'test-')), 'state.sqlite'));
test('reserves concurrent budgets atomically and releases only completed queries', () => {
  const db = setup();
  db.createRun({ id: 'r', objective: 'fixture', repo: root, budget: 1, kind: 'fixture' });
  assert.equal(db.reserve('a', 'r', 0.6, 1), true);
  assert.equal(db.reserve('b', 'r', 0.6, 1), false);
  db.closeQuery('a', 0.2);
  assert.equal(db.reserve('b', 'r', 0.6, 1), true);
  assert.equal(db.cost().reserved, 0.6);
  db.close();
});
test('deduplicates message usage and result cumulative totals across resume and resets', () => {
  const db = setup();
  db.createRun({ id: 'r', objective: 'fixture', repo: root, budget: 10, kind: 'fixture' });
  db.reserve('q', 'r', 1, 10);
  db.recordAssistant('q', 's', 'm', { input_tokens: 100, output_tokens: 0 });
  db.recordAssistant('q', 's', 'm', { input_tokens: 100, output_tokens: 0 });
  assert.equal(db.messages().length, 1);
  db.recordResult('q', 's', 0, 0.2, {
    'claude-opus-5-5': { inputTokens: 100, outputTokens: 10, costUSD: 0.2 },
  });
  db.recordResult('q', 's', 0, 0.2, {});
  assert.equal(db.cost().spent, 0.2);
  db.recordResult('q', 's', 0, 0.3, {});
  assert.equal(db.cost().spent, 0.3);
  db.recordResult('q', 's2', 1, 0.1, {});
  assert.equal(db.cost().spent, 0.4);
  db.reserve('worker', 'r', 1, 10);
  db.recordResult('worker', 'ws', 0, 0.1, {});
  assert.equal(db.cost().spent, 0.5);
  db.close();
});
test('does not turn an incomplete query or unknown cost into free usage', () => {
  const db = setup();
  db.createRun({ id: 'r', objective: 'fixture', repo: root, budget: 5, kind: 'fixture' });
  db.reserve('q', 'r', 1, 5);
  db.markIncomplete('q');
  assert.equal(db.cost().unreconciled, 1);
  assert.equal(db.cost().reserved, 1);
  db.close();
});
test('claims dependencies once, serializes overlapping ownership and obeys slot count', () => {
  const db = setup();
  db.createRun({ id: 'r', objective: 'fixture', repo: root, budget: 5, kind: 'fixture' });
  const t = (id: string, files: string[], dependencies: string[] = []) =>
    db.createTask({
      id,
      runId: 'r',
      title: id,
      brief: id,
      acceptance: ['test'],
      files,
      dependencies,
      role: 'web',
      kind: 'work',
    });
  t('a', ['a.ts']);
  t('b', ['a.ts']);
  t('c', ['c.ts'], ['a']);
  t('d', ['d.ts']);
  for (const id of ['a', 'b', 'c', 'd']) db.assign(id);
  assert.equal(db.claim('r', 2)?.id, 'a');
  assert.equal(db.claim('r', 2)?.id, 'd');
  assert.equal(db.claim('r', 2), undefined);
  db.updateTask('a', { status: 'verified' });
  assert.equal(db.claim('r', 2)?.id, 'b');
  assert.equal(db.claim('r', 2), undefined);
  db.updateTask('d', { status: 'verified' });
  assert.equal(db.claim('r', 2)?.id, 'c');
  assert.equal(
    db.createTask({
      id: 'a',
      runId: 'r',
      title: 'a',
      brief: 'a',
      acceptance: ['test'],
      files: ['a.ts'],
      dependencies: [],
      role: 'web',
      kind: 'work',
    }).id,
    'a',
  );
  db.close();
});
test('recovers interrupted leases without repeating completed work', () => {
  const db = setup(),
    file = db.file;
  db.createRun({ id: 'r', objective: 'fixture', repo: root, budget: 5, kind: 'fixture' });
  db.createTask({
    id: 'a',
    runId: 'r',
    title: 'a',
    brief: 'a',
    acceptance: ['test'],
    files: ['a.ts'],
    dependencies: [],
    role: 'web',
    kind: 'work',
  });
  db.assign('a');
  db.claim('r', 4);
  db.close();
  const reopened = new Store(file);
  reopened.recover();
  assert.equal(reopened.task('a')?.status, 'blocked');
  assert.equal(reopened.claim('r', 4), undefined);
  reopened.close();
});
test('denies traversal, secret paths, links outside scope, and writes outside ownership', () => {
  const dir = mkdtempSync(path.join(root, 'scope-'));
  mkdirSync(path.join(dir, 'src'));
  writeFileSync(path.join(dir, 'src/a.ts'), 'a');
  assert.equal(scopedPath(dir, 'src/a.ts', ['src/a.ts'], true), path.join(dir, 'src/a.ts'));
  for (const target of ['../secrets/office.env', '.git/config', 'src/b.ts', 'C:/Windows/file'])
    assert.throws(() => scopedPath(dir, target, ['src/a.ts'], true));
  const other = mkdtempSync(path.join(root, 'outside-'));
  symlinkSync(other, path.join(dir, 'link'), 'junction');
  assert.throws(() => scopedPath(dir, 'link/x', [], false));
});
test('redacts credentials and bounds retry policy including Retry-After', () => {
  assert.equal(
    redact('ANTHROPIC_API_KEY=secret-value sk-ant-example-123'),
    'ANTHROPIC_API_KEY=[REDACTED] [REDACTED]',
  );
  assert.equal(retryDelay(401, 0), null);
  assert.equal(retryDelay(403, 0), null);
  assert.equal(retryDelay(429, 2), null);
  assert.equal(retryDelay(429, 0, '2', 0), 2000);
  assert.ok((retryDelay(529, 0, undefined, 0) ?? 0) > 0);
});
