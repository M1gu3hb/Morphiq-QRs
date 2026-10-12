import { test, expect } from '@playwright/test';
test('shows live office, accessible list, costs and working settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Oficina de agentes' })).toBeVisible();
  await page.getByRole('button', { name: 'Vista de lista' }).click();
  await expect(page.getByRole('heading', { name: 'Instancias reales' })).toBeVisible();
  await page.getByRole('button', { name: 'Costes', exact: true }).click();
  await expect(page.getByText('Gasto estimado de la oficina', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByLabel('Trabajadores simultáneos').fill('3');
  await page.getByRole('button', { name: 'Guardar configuración' }).click();
  await expect(page.getByRole('status')).toContainText('Configuración guardada');
  await page.getByLabel('Trabajadores simultáneos').fill('4');
  await page.getByRole('button', { name: 'Guardar configuración' }).click();
  expect(errors).toEqual([]);
});
test('mobile layout and reduced motion do not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Oficina de agentes' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardar configuración' })).toBeVisible();
  await page.screenshot({
    path: 'D:/MIS PROYECTOS/Morphiq Oficina/reports/office-mobile.png',
    fullPage: true,
  });
});
test('keyboard focus and mission input are usable, with no accidental API call', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Objetivo de la misión').fill('Diagnóstico de lectura únicamente');
  await page.getByLabel('Presupuesto de misión (USD)').fill('1');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  await page.screenshot({
    path: 'D:/MIS PROYECTOS/Morphiq Oficina/reports/office-desktop.png',
    fullPage: true,
  });
});
test('completed real fixture exposes checks, diff and both export formats after reload', async ({
  page,
  request,
}) => {
  const state = await (await request.get('/api/state')).json();
  const run = state.runs.find((r: any) => r.kind === 'fixture' && r.status === 'done');
  expect(run).toBeTruthy();
  const task = state.tasks.find((t: any) => t.runId === run.id && t.kind === 'work');
  await page.goto('/');
  await page.getByLabel('Seleccionar misión').selectOption(run.id);
  await page.getByRole('button', { name: task.title, exact: true }).click();
  const inspector = page.getByRole('complementary', { name: 'Inspector de agente y tarea' });
  await expect(inspector).toContainText('claude-haiku-5-5');
  await expect(inspector).toContainText('Comprobaciones');
  await expect(inspector.locator('details').first()).toContainText('pasó');
  await expect(inspector.locator('pre').last()).toContainText('diff --git');
  await page.screenshot({
    path: 'D:/MIS PROYECTOS/Morphiq Oficina/reports/office-inspector.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Cerrar inspector' }).click();
  for (const label of ['Exportar JSON', 'CSV']) {
    const href = await page.getByRole('link', { name: label, exact: true }).getAttribute('href');
    const response = await request.get(href!);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain(run.id);
  }
  await page.reload();
  await page.getByLabel('Seleccionar misión').selectOption(run.id);
  await expect(page.getByRole('button', { name: 'Retomar', exact: true })).toBeDisabled();
});
test('UI test fixtures exercise pause, resume, retry and cancel without spending API', async ({
  page,
  request,
}) => {
  const state = await (await request.get('/api/state')).json();
  const original = state.runs.find((r: any) => r.status === 'done');
  const run = { ...original, id: 'ui-fixture', status: 'running' };
  const task = {
    ...state.tasks.find((t: any) => t.runId === original.id && t.kind === 'work'),
    id: 'ui-task',
    runId: run.id,
    status: 'blocked',
  };
  state.runs = [run];
  state.tasks = [task];
  state.queries = [];
  state.events = [];
  const controls: string[] = [];
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.route('**/api/runs/ui-fixture/*', async (route) => {
    const command = route.request().url().split('/').at(-1)!;
    controls.push(command);
    run.status = command === 'pause' ? 'paused' : command === 'resume' ? 'running' : 'cancelled';
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/tasks/ui-task/retry', async (route) => {
    expect(route.request().postDataJSON().context).toBe('Contexto de prueba determinista');
    controls.push('retry');
    task.status = 'ready';
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Misión pausada');
  await page.getByRole('button', { name: 'Retomar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Misión retomada');
  await page.getByRole('button', { name: task.title, exact: true }).click();
  await page
    .getByLabel('Contexto para reintentar', { exact: true })
    .fill('Contexto de prueba determinista');
  await page.getByRole('button', { name: 'Reintentar tarea' }).click();
  await expect(page.getByRole('status')).toContainText('Tarea reencolada');
  await page.getByRole('button', { name: 'Cerrar inspector' }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Cancelación solicitada');
  expect(controls).toEqual(['pause', 'resume', 'retry', 'cancel']);
});
test('missing key and authentication error are visible and disable new missions', async ({
  page,
  request,
}) => {
  const state = await (await request.get('/api/state')).json();
  state.api = { ok: false, models: [], error: 'API sin configurar' };
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.goto('/');
  await expect(page.getByText('API sin configurar', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ejecutar misión' })).toBeDisabled();
  state.api.error = '401: clave API inválida';
  await page.reload();
  await expect(page.getByText('401: clave API inválida', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ejecutar misión' })).toBeDisabled();
});
test('half-width CSS viewport equivalent to 200 percent zoom keeps navigation and controls usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Cancelar todo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Costes', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await expect(page.getByLabel('Avisar al consumir presupuesto (%)')).toBeVisible();
  await page.screenshot({
    path: 'D:/MIS PROYECTOS/Morphiq Oficina/reports/office-zoom200.png',
    fullPage: true,
  });
});
test('eight active UI fixture avatars animate while the panel stays responsive', async ({
  page,
  request,
}) => {
  const state = await (await request.get('/api/state')).json();
  state.runs = [state.runs[0]];
  state.queries = state.queries
    .slice(0, 8)
    .map((q: any) => ({ ...q, run_id: state.runs[0].id, status: 'running' }));
  state.system.active = 8;
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  const frames = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const start = performance.now();
        let count = 0;
        const sample = () => {
          count++;
          if (performance.now() - start >= 1000) resolve(count);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
  expect(frames).toBeGreaterThan(12);
  await page.getByRole('button', { name: 'Costes', exact: true }).click();
  await expect(page.getByText('Gasto estimado de la oficina', { exact: true })).toBeVisible();
});
