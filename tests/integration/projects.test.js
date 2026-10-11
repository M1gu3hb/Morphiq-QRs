import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installBrowser, waitUntil } from '../helpers/browser.js';
import { createStudio } from '../../src/app/create-studio.js';
import { initProjects } from '../../src/projects/controller.js';
import { projectStore } from '../../src/projects/storage.js';

test('an in-flight autosave cannot overwrite the latest draft when the page goes to the background', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const original = { get: projectStore.get, save: projectStore.save };
  t.after(() => Object.assign(projectStore, original));
  const writes = [];
  let release;
  projectStore.get = async () => undefined;
  projectStore.save = async (record) => {
    writes.push(record);
    if (writes.length === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
  };
  const studio = createStudio();
  const projects = await initProjects(studio);
  const input = browser.document.getElementById('url');
  input.value = 'https://morphiq.com.mx/primero';
  studio.render();
  await waitUntil(() => writes.length === 1);
  input.value = 'https://morphiq.com.mx/ultimo';
  studio.render();
  Object.defineProperty(browser.document, 'visibilityState', {
    value: 'hidden',
    configurable: true,
  });
  browser.document.dispatchEvent(new Event('visibilitychange'));
  const flush = projects.flushDraft();
  assert.equal(writes.length, 1);
  release();
  await flush;
  assert.equal(writes.length, 3);
  assert.equal(writes[1].state.fields.url, 'https://morphiq.com.mx/ultimo');
  assert.equal(writes[2].state.fields.url, 'https://morphiq.com.mx/ultimo');
});
test('loading a new silhouette removes margin/frame while saved manual edits survive restoration', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const studio = createStudio();
  browser.document.getElementById('silhouette-enabled').checked = true;
  browser.document.getElementById('border-enabled').checked = true;
  studio.setSilhouette({ name: 'Square', path: 'M4 4h248v248H4Z', box: { x: 4, y: 4, side: 248 } });
  assert.equal(studio.getOptions().margin, 0);
  assert.equal(studio.getOptions().border.enabled, false);
  const state = studio.getState();
  state.fields.margin = '4';
  state.fields['border-enabled'] = true;
  studio.applyState(state);
  assert.equal(studio.getOptions().margin, 4);
  assert.equal(studio.getOptions().border.enabled, true);
  browser.document.getElementById('silhouette-enabled').checked = false;
  studio.render();
  browser.document.getElementById('silhouette-enabled').checked = true;
  studio.render();
  assert.equal(studio.getOptions().margin, 0);
  assert.equal(studio.getOptions().border.enabled, false);
});
