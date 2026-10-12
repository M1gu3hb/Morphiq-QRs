import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
export const officeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function config() {
  const root = process.env.MORPHIQ_ROOT ?? path.resolve(officeRoot, '../../..');
  if (process.platform === 'win32' && !/^D:[\\/]/i.test(root))
    throw new Error('MORPHIQ_ROOT debe estar en D:');
  const secrets = path.join(root, 'secrets/office.env');
  const env = existsSync(secrets) ? parseEnv(readFileSync(secrets, 'utf8')) : {};
  const get = (key: string, fallback: string) => process.env[key] ?? env[key] ?? fallback;
  const paths = {
    root,
    state: path.join(root, 'state'),
    reports: path.join(root, 'reports'),
    cache: path.join(root, 'cache'),
    temp: path.join(root, 'temp'),
    worktrees: path.join(root, 'worktrees'),
    product: path.join(root, 'workspaces/qr-main'),
    sessions: path.join(root, 'state/claude'),
    secrets,
  };
  for (const folder of [
    paths.state,
    paths.reports,
    paths.cache,
    paths.temp,
    paths.worktrees,
    paths.sessions,
  ])
    mkdirSync(folder, { recursive: true });
  const maxWorkers = Number(get('MORPHIQ_MAX_WORKERS', '4')),
    totalBudget = Number(get('MORPHIQ_TOTAL_BUDGET_USD', '100')),
    port = Number(get('MORPHIQ_RUNNER_PORT', '4310'));
  if (
    !Number.isInteger(maxWorkers) ||
    maxWorkers < 1 ||
    maxWorkers > 8 ||
    !Number.isFinite(totalBudget) ||
    totalBudget <= 0 ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  )
    throw new Error('Configuración de límites inválida');
  return {
    paths,
    apiKey: get('ANTHROPIC_API_KEY', ''),
    workspaceId: get('MORPHIQ_WORKSPACE_ID', ''),
    director: get('MORPHIQ_DIRECTOR_MODEL', 'claude-opus-5-5'),
    worker: get('MORPHIQ_WORKER_MODEL', 'claude-haiku-5-5'),
    maxWorkers,
    totalBudget,
    bootstrapBudget: Number(get('MORPHIQ_BOOTSTRAP_TEST_BUDGET_USD', '2')),
    productWrite: get('MORPHIQ_PRODUCT_WRITE_ENABLED', 'false') === 'true',
    port,
    host: '127.0.0.1',
  };
}
export type Config = ReturnType<typeof config>;
export function processEnv(cfg: Config, withKey = false): NodeJS.ProcessEnv {
  const env = {
    ...process.env,
    TEMP: cfg.paths.temp,
    TMP: cfg.paths.temp,
    npm_config_cache: path.join(cfg.paths.cache, 'npm'),
    npm_config_prefix: path.join(cfg.paths.root, 'tools/npm'),
    PLAYWRIGHT_BROWSERS_PATH: path.join(cfg.paths.cache, 'playwright'),
    CLAUDE_CONFIG_DIR: cfg.paths.sessions,
  };
  for (const name of Object.keys(env))
    if (
      /TOKEN|API_KEY|SECRET|PASSWORD|ANTHROPIC_AUTH|CLAUDE_CODE_OAUTH|CLAUDE_CODE_USE_|ANTHROPIC_BASE_URL|ANTHROPIC_CUSTOM_HEADERS/i.test(
        name,
      )
    )
      delete (env as NodeJS.ProcessEnv)[name];
  if (withKey) (env as NodeJS.ProcessEnv).ANTHROPIC_API_KEY = cfg.apiKey;
  if (withKey && cfg.workspaceId)
    (env as NodeJS.ProcessEnv).ANTHROPIC_CUSTOM_HEADERS =
      `anthropic-workspace-id: ${cfg.workspaceId}`;
  return env;
}
