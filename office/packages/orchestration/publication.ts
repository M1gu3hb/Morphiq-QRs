import { readFileSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import type { Run } from '../contracts/index.ts';
import type { Config } from './config.ts';
import type { Store } from './store.ts';
import { productAuthorized, assertReleaseReadiness } from './missions.ts';
import { git } from '../git-integration/index.ts';
import { execute } from './process.ts';

export function publicationReady(store: Store, run: Run) {
  if (run.kind !== 'product' || !productAuthorized(store, run) || !run.commit)
    throw new Error('Publicación requiere el candidato integrado de la misión autorizada');
  assertReleaseReadiness(run);
  const tasks = store.tasks(run.id).filter((t) => t.status !== 'cancelled');
  if (!tasks.length || tasks.some((t) => t.status !== 'integrated'))
    throw new Error('Todos los resultados necesitan estar revisados e integrados');
  if (git(run.repo, 'rev-parse', 'HEAD') !== run.commit || git(run.repo, 'status', '--porcelain'))
    throw new Error('El candidato cambió; se conservan los cambios para revisión');
  if (
    !/^https:\/\/github\.com\/M1gu3hb\/Morphiq-QRs(?:\.git)?$/.test(
      git(run.repo, 'remote', 'get-url', 'origin'),
    )
  )
    throw new Error('Destino de publicación distinto al repositorio autorizado');
  const pkg = JSON.parse(readFileSync(path.join(run.repo, 'package.json'), 'utf8'));
  for (const script of ['release:publish', 'release:verify:production'])
    if (!pkg.scripts?.[script])
      throw new Error(
        'Haiku debe implementar y revisar el script ' + script + ' antes de integrar',
      );
  return pkg;
}

export async function publishCandidate(store: Store, cfg: Config, run: Run, signal?: AbortSignal) {
  const pkg = publicationReady(store, run);
  const lock = path.join(cfg.paths.state, 'publication.lock');
  let fd: number;
  try {
    fd = openSync(lock, 'wx');
  } catch {
    throw new Error('Publicador ocupado');
  }
  try {
    const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    if (!existsSync(npmCli)) throw new Error('npm CLI no disponible');
    for (const script of ['release:publish', 'release:verify:production']) {
      const evidence = await execute(
        process.execPath,
        [npmCli, 'run', script],
        run.repo,
        cfg,
        signal,
        20 * 60_000,
      );
      store.event('publication.check', run.id, undefined, {
        command: 'npm run ' + script,
        ...evidence,
      });
      if (evidence.exitCode !== 0)
        throw new Error('Publicación pendiente: falló ' + script + '. Consultar evidencia real.');
    }
    const report = z
      .object({
        commit: z.string(),
        version: z.string(),
        minSdk: z.number().int().min(26),
        webUrl: z.string().url(),
        apkUrl: z.string().url(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(
        JSON.parse(readFileSync(path.join(run.repo, 'reports/release-publication.json'), 'utf8')),
      );
    if (report.commit !== run.commit || report.version !== pkg.version)
      throw new Error('El informe publicado no corresponde al candidato/version');
    if (
      report.webUrl !== 'https://morphiqqr.vercel.app/' ||
      !report.apkUrl.startsWith('https://github.com/M1gu3hb/Morphiq-QRs/releases/download/')
    )
      throw new Error('URLs de publicación fuera de los destinos autorizados');
    const web = await fetch(report.webUrl, {
      signal: AbortSignal.any([AbortSignal.timeout(60_000), ...(signal ? [signal] : [])]),
    });
    await web.body?.cancel();
    if (!web.ok) throw new Error('La web pública no responde correctamente');
    const apk = await fetch(report.apkUrl, {
      signal: AbortSignal.any([AbortSignal.timeout(120_000), ...(signal ? [signal] : [])]),
    });
    if (!apk.ok || !apk.body) throw new Error('APK no descargable públicamente');
    const hash = createHash('sha256');
    let bytes = 0;
    let magic = Buffer.alloc(0);
    const reader = apk.body.getReader();
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = Buffer.from(next.value);
      bytes += chunk.length;
      if (magic.length < 4) magic = Buffer.concat([magic, chunk]).subarray(0, 4);
      if (bytes > 300_000_000) {
        await reader.cancel();
        throw new Error('APK supera el límite de descarga de verificación');
      }
      hash.update(chunk);
    }
    if (!magic.equals(Buffer.from([80, 75, 3, 4])) || hash.digest('hex') !== report.sha256)
      throw new Error('La descarga pública no coincide con la APK verificada');
    if (git(run.repo, 'rev-parse', 'HEAD') !== run.commit || git(run.repo, 'status', '--porcelain'))
      throw new Error('La publicación cambió el candidato; requiere revisión');
    store.event('publication.completed', run.id, undefined, { ...report, bytes });
    store.updateRun(run.id, { status: 'done', reason: undefined });
    return report;
  } finally {
    closeSync(fd);
    unlinkSync(lock);
  }
}
