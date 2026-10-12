import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { integrate, dependencyWorktree } from '../packages/git-integration/index.ts';
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function fixture() {
  const dir = mkdtempSync('D:/MIS PROYECTOS/Morphiq Oficina/temp/git-');
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'core.autocrlf', 'false');
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
test('a dependent worker inherits verified edits and contributes only its own delta', async () => {
  const { dir, base } = fixture(),
    first = dir + '-first',
    second = dir + '-second';
  dependencyWorktree(dir, base, first, []);
  writeFileSync(path.join(first, 'a.txt'), 'first\n');
  git(first, 'add', '.');
  git(first, 'commit', '-m', 'first');
  const a = git(first, 'rev-parse', 'HEAD');
  const inherited = dependencyWorktree(dir, base, second, [a]);
  assert.equal(readFileSync(path.join(second, 'a.txt'), 'utf8'), 'first\n');
  writeFileSync(path.join(second, 'a.txt'), 'first\nsecond\n');
  git(second, 'add', '.');
  git(second, 'commit', '-m', 'second');
  const b = git(second, 'rev-parse', 'HEAD');
  assert.equal(git(second, 'rev-parse', b + '^'), inherited);
  await integrate({
    repo: dir,
    base,
    commits: [a, b],
    lock: path.join(dir, 'lock'),
    message: 'final',
    verify: async () => true,
  });
  assert.equal(readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'first\nsecond\n');
  assert.equal(git(dir, 'rev-list', '--count', base + '..HEAD'), '1');
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
