import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { integrate } from '../packages/git-integration/index.ts';
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function fixture() {
  const dir = mkdtempSync('D:/MIS PROYECTOS/Morphiq Oficina/temp/git-');
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'user.name', 'M1gu3hb');
  git(dir, 'config', 'user.email', '118588634+M1gu3hb@users.noreply.github.com');
  writeFileSync(path.join(dir, 'a.txt'), 'base');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'base');
  return { dir, base: git(dir, 'rev-parse', 'HEAD') };
}
test('integrates independent detached worker commits with one final identity commit', async () => {
  const { dir, base } = fixture(),
    work = dir + '-worker';
  git(dir, 'worktree', 'add', '--detach', work, base);
  writeFileSync(path.join(work, 'a.txt'), 'changed');
  git(work, 'add', '.');
  git(work, 'commit', '-m', 'worker');
  const commit = git(work, 'rev-parse', 'HEAD');
  const result = await integrate({
    repo: dir,
    base,
    commits: [commit],
    lock: path.join(dir, 'integrator.lock'),
    message: 'integration',
    verify: async () => true,
  });
  assert.equal(git(dir, 'rev-parse', 'HEAD'), result);
  assert.equal(readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'changed');
  assert.equal(git(dir, 'log', '-1', '--format=%an'), 'M1gu3hb');
});
test('rejects stale HEAD before applying any change', async () => {
  const { dir, base } = fixture();
  writeFileSync(path.join(dir, 'b.txt'), 'other');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'other');
  const head = git(dir, 'rev-parse', 'HEAD');
  await assert.rejects(
    integrate({
      repo: dir,
      base,
      commits: [],
      lock: path.join(dir, 'lock'),
      message: 'bad',
      verify: async () => true,
    }),
    /HEAD/,
  );
  assert.equal(git(dir, 'rev-parse', 'HEAD'), head);
});
test('conflict preserves checkout and failed worktree instead of deleting evidence', async () => {
  const { dir, base } = fixture(),
    a = dir + '-a',
    b = dir + '-b';
  for (const [work, value] of [
    [a, 'one'],
    [b, 'two'],
  ]) {
    git(dir, 'worktree', 'add', '--detach', work, base);
    writeFileSync(path.join(work, 'a.txt'), value);
    git(work, 'add', '.');
    git(work, 'commit', '-m', 'worker');
  }
  await assert.rejects(
    integrate({
      repo: dir,
      base,
      commits: [git(a, 'rev-parse', 'HEAD'), git(b, 'rev-parse', 'HEAD')],
      lock: path.join(dir, 'integrator.lock'),
      message: 'conflict',
      verify: async () => true,
    }),
  );
  assert.match(readFileSync(path.join(dir, 'a.txt'), 'utf8'), /<<<<<<<|=======/);
  assert.equal(readFileSync(path.join(a, 'a.txt'), 'utf8'), 'one');
});
