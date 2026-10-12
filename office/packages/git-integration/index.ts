import { openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 2_000_000,
  }).trim();
}
export function identity(repo: string) {
  git(repo, 'config', 'user.name', 'M1gu3hb');
  git(repo, 'config', 'user.email', '118588634+M1gu3hb@users.noreply.github.com');
}
export function worktree(repo: string, base: string, target: string) {
  if (!existsSync(target)) git(repo, 'worktree', 'add', '--detach', target, base);
  if (git(target, 'rev-parse', 'HEAD') !== base && git(target, 'status', '--porcelain'))
    throw new Error('Worktree parcial conservado: requiere revisar antes de reusar');
  identity(target);
  return target;
}
export function dependencyWorktree(repo: string, base: string, target: string, commits: string[]) {
  worktree(repo, base, target);
  if (commits.length) {
    for (const commit of [...new Set(commits)]) {
      if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Commit de dependencia inválido');
      git(target, 'cherry-pick', '--no-commit', commit);
    }
    if (git(target, 'diff', '--cached', '--name-only'))
      git(target, 'commit', '-m', 'office: verified dependency snapshot');
  }
  return git(target, 'rev-parse', 'HEAD');
}
export async function integrate(options: {
  repo: string;
  base: string;
  commits: string[];
  lock: string;
  message: string;
  verify: () => Promise<boolean>;
}): Promise<string> {
  let fd: number;
  try {
    fd = openSync(options.lock, 'wx');
  } catch {
    throw new Error('Integrador ocupado; lock activo');
  }
  try {
    if (git(options.repo, 'rev-parse', 'HEAD') !== options.base)
      throw new Error('HEAD cambió; integrar requiere nueva revisión');
    // The lock is kept outside the checkout in operation. Tests use an ignored lock.
    const relativeLock = path.relative(options.repo, options.lock).replaceAll('\\', '/');
    const dirty = git(options.repo, 'status', '--porcelain')
      .split('\n')
      .filter((line) => line && line.slice(3) !== relativeLock);
    if (dirty.length) throw new Error('Checkout de integración tiene cambios; se conservan');
    identity(options.repo);
    for (const commit of options.commits) {
      if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Commit inválido');
      git(options.repo, 'cherry-pick', '--no-commit', commit);
    }
    if (!(await options.verify()))
      throw new Error('Pruebas de integración fallaron; cambios conservados para recuperar');
    if (git(options.repo, 'diff', '--cached', '--name-only'))
      git(options.repo, 'commit', '-m', options.message);
    return git(options.repo, 'rev-parse', 'HEAD');
  } finally {
    closeSync(fd);
    unlinkSync(options.lock);
  }
}
