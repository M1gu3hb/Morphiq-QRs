import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Config } from './config.ts';
import type { Store } from './store.ts';
import type { Run } from '../contracts/index.ts';
export function specificationPrompt(
  run: Pick<Run, 'specSha' | 'directorSession'>,
  document: string,
) {
  if (!document) return '';
  if (run.specSha && createHash('sha256').update(document).digest('hex') !== run.specSha)
    throw new Error('La especificación guardada cambió; se conserva la misión para revisar');
  return run.directorSession
    ? '\nDocumento aprobado SHA256 ' +
        run.specSha +
        ' conservado completo. Ya lo recibiste al inicio; consulta read_mission para cualquier sección necesaria, incluidos catálogos, QA y release. No omitas requisitos por compactación.'
    : '\nESPECIFICACIÓN COMPLETA APROBADA (' + run.specSha + '):\n' + document;
}

export const MissionImport = z.object({
  document: z.string().min(100).max(160000),
  sourceName: z.string().min(1).max(200),
  budget: z.number().positive().max(100),
  authorizeProductWrite: z.literal(true),
});
export function productAuthorized(store: Store, run: Pick<Run, 'id' | 'authorizeProductWrite'>) {
  return run.authorizeProductWrite === true && store.settings().authorizedProductRunId === run.id;
}
export const requirementIds = [
  ...Array.from({ length: 35 }, (_, i) => 'Q' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 5 }, (_, i) => 'S' + String(i + 1).padStart(2, '0')),
];
export function assertReleaseReadiness(run: Run) {
  const pending = requirementIds.filter((id) => {
    const item = run.requirements?.[id];
    return id === 'Q04'
      ? item?.status !== 'excluded'
      : id === 'S05'
        ? !['verified', 'candidate'].includes(item?.status ?? '')
        : item?.status !== 'verified';
  });
  if (pending.length)
    throw new Error(
      'No se publicará una misión incompleta. Requisitos sin gate: ' + pending.join(', '),
    );
}
export function importMission(store: Store, cfg: Config, raw: unknown) {
  const input = MissionImport.parse(raw);
  if (
    /sk-ant-[A-Za-z0-9_-]+/.test(input.document) ||
    (cfg.apiKey && input.document.includes(cfg.apiKey))
  )
    throw new Error('El documento contiene una clave; importa una especificación sin secretos');
  const sha = createHash('sha256').update(input.document).digest('hex'),
    id = 'qr-' + sha.slice(0, 16);
  const prior = store.run(id);
  if (prior) return prior;
  const cost = store.cost();
  if (input.budget > cfg.totalBudget - cost.spent - cost.reserved)
    throw new Error('La misión supera el presupuesto restante del proyecto');
  const other = store
    .runs()
    .find((run) => run.kind === 'product' && !['done', 'cancelled'].includes(run.status));
  if (other) throw new Error('Ya hay una misión de producto activa: ' + other.id);
  const directory = path.join(cfg.paths.state, 'missions');
  mkdirSync(directory, { recursive: true });
  const specPath = path.join(directory, id + '.md');
  writeFileSync(specPath, input.document);
  store.saveSettings({ ...store.settings(), authorizedProductRunId: id });
  const run = store.createRun({
    id,
    objective:
      'Ejecuta íntegramente la especificación aprobada ' +
      input.sourceName +
      '. Mantén Q01–Q35/S01–S05 y Q04 excluido; evidencia real y release completo antes de publicar.',
    repo: cfg.paths.product,
    kind: 'product',
    budget: input.budget,
    authorizeProductWrite: true,
    specPath,
    specSha: sha,
    requirements: {},
  });
  store.event('mission.imported', id, undefined, {
    sourceName: input.sourceName,
    sha,
    specPath,
    remainingBudget: cfg.totalBudget - cost.spent - cost.reserved,
    authorization: 'Solo este run ID',
  });
  return run;
}
