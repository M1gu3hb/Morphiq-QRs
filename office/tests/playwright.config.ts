import { defineConfig } from '@playwright/test';
import { config } from '../packages/orchestration/config.ts';
const paths = config().paths;
process.env.TEMP = paths.temp;
process.env.TMP = paths.temp;
process.env.PLAYWRIGHT_BROWSERS_PATH = paths.cache + '/playwright';
export default defineConfig({
  testDir: '.',
  testMatch: 'ui.spec.ts',
  timeout: 20_000,
  use: { baseURL: 'http://127.0.0.1:4310', headless: true },
  reporter: 'list',
  outputDir: 'D:/MIS PROYECTOS/Morphiq Oficina/reports/ui-results',
});
