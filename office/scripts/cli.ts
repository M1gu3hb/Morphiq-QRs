import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { config } from '../packages/orchestration/config.ts';
const cfg = config(),
  command = process.argv[2],
  stateFile = path.join(cfg.paths.state, 'runner.json');
if (command === 'doctor') {
  const version = (name: string, args: string[]) => {
    try {
      return execFileSync(name, args, { encoding: 'utf8', windowsHide: true }).trim();
    } catch {
      return 'no disponible';
    }
  };
  const report = {
    paths: cfg.paths,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    git: version('git', ['--version']),
    github: version('gh', ['api', 'user', '--jq', '.login']),
    keyConfigured: !!cfg.apiKey,
    models: { director: cfg.director, worker: cfg.worker },
    nativeRuntime: existsSync(
      path.resolve(
        import.meta.dirname,
        '../node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe',
      ),
    ),
    runner: existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')).pid : null,
  };
  writeFileSync(path.join(cfg.paths.reports, 'doctor.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} else {
  if (!existsSync(stateFile)) throw new Error('Runner detenido. Abre Iniciar-Oficina.ps1.');
  const state = JSON.parse(readFileSync(stateFile, 'utf8')),
    base = `http://127.0.0.1:${state.port}`;
  if (command === 'status') {
    const snapshot = await (await fetch(base + '/api/state')).json();
    console.log(
      JSON.stringify(
        {
          url: base,
          api: snapshot.api.ok,
          active: snapshot.system.active,
          cost: snapshot.cost,
          latestRun: snapshot.runs[0],
        },
        null,
        2,
      ),
    );
  } else if (command === 'stop') {
    const result = await fetch(base + '/api/stop', {
      method: 'POST',
      headers: { 'x-office-token': state.token },
    });
    console.log(await result.text());
  } else if (command === 'export-run') {
    const id = process.argv[3];
    if (!id || !/^[\w-]+$/.test(id)) throw new Error('Indica un ID de misión válido');
    const result = await fetch(base + `/api/runs/${id}/export`);
    if (!result.ok) throw new Error(await result.text());
    const file = path.join(cfg.paths.reports, id + '.json');
    writeFileSync(file, await result.text());
    console.log(file);
  } else throw new Error('Comandos: doctor, status, stop, export-run <id>');
}
