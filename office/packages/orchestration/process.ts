import { spawn } from 'node:child_process';
import type { Config } from './config.ts';
import { processEnv } from './config.ts';
import { redact } from './policy.ts';
export async function execute(
  command: string,
  args: string[],
  cwd: string,
  cfg: Config,
  signal?: AbortSignal,
  timeout = 120_000,
): Promise<{ output: string; exitCode: number | null; durationMs: number }> {
  const start = Date.now(),
    controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, timeout);
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: processEnv(cfg),
        shell: false,
        windowsHide: true,
        signal: controller.signal,
      });
      let output = '';
      const append = (value: Buffer) => {
        output = (output + redact(value.toString(), cfg.apiKey)).slice(-60_000);
      };
      child.stdout.on('data', append);
      child.stderr.on('data', append);
      child.on('error', reject);
      child.on('close', (exitCode) =>
        resolve({ output, exitCode, durationMs: Date.now() - start }),
      );
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
