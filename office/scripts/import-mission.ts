import { readFileSync } from 'node:fs';
import path from 'node:path';
import { config } from '../packages/orchestration/config.ts';
const cfg = config(),
  file = process.argv[2];
if (!file) throw new Error('Uso: npm run import-mission -- D:/ruta/mision.md [presupuesto]');
const absolute = path.resolve(file);
if (!/^D:[\\/]/i.test(absolute) || path.extname(absolute).toLowerCase() !== '.md')
  throw new Error('La especificación debe ser un MD en D:');
const runner = JSON.parse(readFileSync(path.join(cfg.paths.state, 'runner.json'), 'utf8'));
const response = await fetch(`http://127.0.0.1:${runner.port}/api/import-mission`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-office-token': runner.token },
  body: JSON.stringify({
    document: readFileSync(absolute, 'utf8'),
    sourceName: path.basename(absolute),
    budget: Number(process.argv[3] ?? 95),
    authorizeProductWrite: true,
  }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
console.log(
  JSON.stringify({
    id: result.id,
    status: result.status,
    budget: result.budget,
    specSha: result.specSha,
    source: result.specPath,
    authorization: 'Solo esta misión',
  }),
);
