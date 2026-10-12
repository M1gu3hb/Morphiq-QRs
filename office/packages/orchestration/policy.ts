import path from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import type { Run, Task } from '../contracts/index.ts';
export function taskWritable(run: Pick<Run, 'kind'>, task: Pick<Task, 'kind' | 'role' | 'files'>) {
  if (task.kind !== 'work' || run.kind === 'analysis') return false;
  if (['web', 'design', 'qr', 'mobile'].includes(task.role)) return true;
  return (
    run.kind === 'product' &&
    task.role === 'research' &&
    task.files.length > 0 &&
    task.files.every((file) => file.startsWith('docs/'))
  );
}
export function redact(text: string, secret?: string): string {
  let result = text
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/(ANTHROPIC_API_KEY\s*[=:]\s*)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[REDACTED]');
  if (secret) result = result.split(secret).join('[REDACTED]');
  return result;
}
export function within(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}
export function scopedPath(
  root: string,
  relative: string,
  files: string[] = [],
  write = false,
): string {
  if (
    path.isAbsolute(relative) ||
    relative.includes(':') ||
    relative.includes('\\') ||
    relative.split('/').some((s) => s === '..' || s === '.' || s === '')
  )
    throw new Error('Ruta relativa inválida');
  if (/(^|\/)(\.git|node_modules|secrets|\.env[^/]*|office\.env)(\/|$)/i.test(relative))
    throw new Error('Ruta privada fuera del alcance');
  const resolved = path.resolve(root, relative),
    realRoot = realpathSync(root);
  if (!within(root, resolved)) throw new Error('Ruta fuera del worktree');
  let ancestor = resolved;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (!within(realRoot, realpathSync(ancestor))) throw new Error('Enlace fuera del alcance');
  if (write && !files.some((f) => (f.endsWith('/') ? relative.startsWith(f) : f === relative)))
    throw new Error('Archivo sin propiedad asignada');
  return resolved;
}
export function retryDelay(
  status: number,
  attempt: number,
  retryAfter?: string,
  jitter = Math.random(),
): number | null {
  if (attempt >= 2 || ![429, 500, 502, 503, 504, 529].includes(status)) return null;
  const delay = retryAfter
    ? Number.isFinite(Number(retryAfter))
      ? Number(retryAfter) * 1000
      : Date.parse(retryAfter) - Date.now()
    : 0;
  return Math.min(60_000, Math.max(delay, 1000 * 2 ** attempt + 500 * jitter));
}
