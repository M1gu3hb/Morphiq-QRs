import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config, officeRoot } from '../packages/orchestration/config.ts';
import { git } from '../packages/git-integration/index.ts';
const cfg = config(),
  repo = cfg.paths.product,
  pkg = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'));
const map = {
  repository: 'https://github.com/M1gu3hb/Morphiq-QRs',
  site: 'https://morphiqqr.vercel.app/',
  head: git(repo, 'rev-parse', 'HEAD'),
  version: pkg.version,
  branch: 'main',
  mode: 'read-only',
  scripts: pkg.scripts,
  files: git(repo, 'ls-files', 'src').split('\n'),
  modules: [
    'app',
    'content',
    'qr',
    'frames',
    'image',
    'validation',
    'export',
    'projects',
    'scanner',
    'advanced',
    'pwa',
    'ui',
    'styles',
  ],
  baseline: {
    unitPassed: 12,
    integrationPassed: 17,
    viteBuild: 'passed',
    pwaBuild: 'failed on Windows: file URL converted into D:\\D:\\MIS%20PROYECTOS...',
    physicalAndroid: 'not tested',
  },
  reportedIssues: [
    'Cámara y descargas fallan en algunos teléfonos según el propietario. Requiere pruebas físicas.',
  ],
  backlog: [],
  writeEnabled: false,
};
writeFileSync(path.join(officeRoot, 'config/project-map.json'), JSON.stringify(map, null, 2));
console.log(`QR importado en lectura: ${map.head}`);
