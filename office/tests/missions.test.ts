import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from '../packages/orchestration/config.ts';
import { Store } from '../packages/orchestration/store.ts';
import {
  importMission,
  productAuthorized,
  assertReleaseReadiness,
  requirementIds,
  specificationPrompt,
} from '../packages/orchestration/missions.ts';
test('importing the same MD preserves one run, scope authorization, complete spec and prior costs', () => {
  const cfg = config(),
    dir = mkdtempSync(path.join(cfg.paths.temp, 'mission-')),
    db = new Store(path.join(dir, 'db.sqlite'));
  const scoped = { ...cfg, paths: { ...cfg.paths, state: dir } };
  db.createRun({ id: 'old', objective: 'prior test', kind: 'fixture', repo: dir, budget: 2 });
  db.reserve('query', 'old', 1, 100);
  db.recordResult('query', 'session', 0, 0.41, {});
  db.closeQuery('query');
  const input = {
    document: '# Misión aprobada\n' + 'Una especificación completa.\n'.repeat(500),
    sourceName: 'mission.md',
    budget: 95,
    authorizeProductWrite: true,
  };
  const run = importMission(db, scoped, input);
  assert.equal(importMission(db, scoped, input).id, run.id);
  assert.equal(db.runs().length, 2);
  assert.equal(readFileSync(run.specPath!, 'utf8'), input.document);
  assert.equal(db.cost().spent, 0.41);
  assert.equal(productAuthorized(db, run), true);
  assert.equal(productAuthorized(db, { id: 'future', authorizeProductWrite: true }), false);
  assert.throws(
    () =>
      importMission(db, scoped, { ...input, document: input.document + 'changed', budget: 100 }),
    /restante/,
  );
  assert.throws(
    () => importMission(db, scoped, { ...input, document: input.document + 'sk-ant-fake-secret' }),
    /clave/,
  );
  db.close();
});
test('the first director gets the complete MD; resume can retrieve it without appending duplicate copies', () => {
  const document = '# Full mission\n' + 'Requirement\n'.repeat(500) + 'FINAL REQUIREMENT';
  const specSha = createHash('sha256').update(document).digest('hex');
  assert.ok(specificationPrompt({ specSha }, document).endsWith(document));
  const resumed = specificationPrompt({ specSha, directorSession: 'real-sdk-session' }, document);
  assert.ok(resumed.includes('read_mission') && resumed.includes(specSha));
  assert.ok(!resumed.includes(document));
  assert.throws(() => specificationPrompt({ specSha }, document + 'changed'), /cambió/);
});
test('release cannot omit a requirement or include excluded Q04; physical checks can remain candidate', () => {
  const db = new Store(
    path.join(mkdtempSync(path.join(config().paths.temp, 'gate-')), 'db.sqlite'),
  );
  const run = db.createRun({
    id: 'release',
    objective: 'complete release',
    kind: 'product',
    repo: '.',
    budget: 95,
  });
  assert.throws(() => assertReleaseReadiness(run), /Q01.*S05/);
  run.requirements = Object.fromEntries(
    requirementIds.map((id) => [
      id,
      {
        status: id === 'Q04' ? 'excluded' : id === 'S05' ? 'candidate' : 'verified',
        evidence: 'Real tested artifacts',
      },
    ]),
  );
  assert.doesNotThrow(() => assertReleaseReadiness(run));
  run.requirements.Q04.status = 'verified';
  assert.throws(() => assertReleaseReadiness(run), /Q04/);
  db.close();
});
