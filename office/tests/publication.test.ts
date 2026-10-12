import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { git, identity } from '../packages/git-integration/index.ts';
import { config } from '../packages/orchestration/config.ts';
import { Store } from '../packages/orchestration/store.ts';
import { requirementIds } from '../packages/orchestration/missions.ts';
import { publicationReady, publishCandidate } from '../packages/orchestration/publication.ts';

test('publication rejects incomplete or modified candidates; failed real publish command cannot mark DONE', async () => {
  const cfg = config(),
    dir = mkdtempSync(path.join(cfg.paths.temp, 'publication-'));
  const db = new Store(path.join(dir, 'office.sqlite'));
  db.createRun({
    id: 'r',
    repo: dir,
    kind: 'product',
    objective: 'publish gates',
    budget: 5,
    authorizeProductWrite: true,
  });
  db.saveSettings({ authorizedProductRunId: 'r' });
  assert.throws(() => publicationReady(db, db.run('r')!), /candidato/);
  git(dir, 'init', '-b', 'main');
  identity(dir);
  git(dir, 'remote', 'add', 'origin', 'https://github.com/M1gu3hb/Morphiq-QRs.git');
  writeFileSync(path.join(dir, '.gitignore'), 'office.sqlite*\n');
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      version: '1.0.0',
      scripts: { 'release:publish': 'node fail.cjs', 'release:verify:production': 'node fail.cjs' },
    }),
  );
  writeFileSync(path.join(dir, 'fail.cjs'), 'process.exit(7);\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'verified candidate fixture');
  db.updateRun('r', {
    commit: git(dir, 'rev-parse', 'HEAD'),
    status: 'running',
    requirements: Object.fromEntries(
      requirementIds.map((id) => [
        id,
        {
          status: id === 'Q04' ? 'excluded' : id === 'S05' ? 'candidate' : 'verified',
          evidence: 'verified fixture evidence',
        },
      ]),
    ),
  });
  db.createTask({
    id: 't',
    runId: 'r',
    role: 'web',
    kind: 'work',
    files: [],
    dependencies: [],
    title: 'implementation',
    brief: 'verified',
    acceptance: ['pass'],
  });
  assert.throws(() => publicationReady(db, db.run('r')!), /integrados/);
  db.updateTask('t', { status: 'integrated' });
  assert.equal(publicationReady(db, db.run('r')!).version, '1.0.0');
  writeFileSync(path.join(dir, 'owner-change.txt'), 'preserve');
  assert.throws(() => publicationReady(db, db.run('r')!), /candidato cambió/);
  git(dir, 'add', 'owner-change.txt');
  git(dir, 'commit', '-m', 'owner update');
  db.updateRun('r', { commit: git(dir, 'rev-parse', 'HEAD') });
  const scoped = { ...cfg, paths: { ...cfg.paths, state: dir } };
  await assert.rejects(publishCandidate(db, scoped, db.run('r')!), /falló release:publish/);
  assert.equal(db.run('r')!.status, 'running');
  const checks = db.runEvents('r').filter((e) => e.type === 'publication.check');
  assert.equal(checks.length, 1);
  assert.equal(checks[0].data.exitCode, 7);
  assert.equal(existsSync(path.join(dir, 'publication.lock')), false);
  db.close();
});
