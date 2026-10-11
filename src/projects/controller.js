import { projectStore } from './storage.js';
import { saveFile } from '../utils/files.js';
export async function initProjects(studio) {
  const el = (id) => document.getElementById(id);
  let timer,
    ready = false,
    revision = 0,
    saving = Promise.resolve();
  const status = (text) => (el('autosave-status').textContent = text);
  function saveDraft(throwOnError = false) {
    const token = revision;
    const record = {
      id: 'autosave',
      name: 'Borrador',
      updated: Date.now(),
      state: studio.getState(),
    };
    const write = saving.then(() => projectStore.save(record));
    saving = write
      .then(() => {
        if (token === revision) status('Guardado en este dispositivo');
      })
      .catch((error) => {
        if (token === revision) {
          status('Sin autoguardado');
          el('projects-status').textContent = error.message;
        }
      });
    return throwOnError ? write : saving;
  }
  function autosave() {
    if (!ready) return;
    revision++;
    clearTimeout(timer);
    status('Guardando…');
    timer = setTimeout(saveDraft, 650);
  }
  async function list() {
    try {
      const records = (await projectStore.list())
          .filter((p) => p.id !== 'autosave')
          .sort((a, b) => b.updated - a.updated),
        container = el('projects-list');
      container.replaceChildren();
      if (!records.length) {
        container.textContent = 'Todavía no hay proyectos guardados.';
        return;
      }
      for (const record of records) {
        const item = document.createElement('article');
        item.className = 'project-item';
        const title = document.createElement('h3');
        title.textContent = record.name;
        const date = document.createElement('span');
        date.className = 'small-note';
        date.textContent = new Date(record.updated).toLocaleString('es-MX');
        const load = document.createElement('button');
        load.type = 'button';
        load.className = 'tool-button';
        load.textContent = 'Abrir';
        load.addEventListener('click', () => {
          try {
            studio.applyState(record.state);
            el('projects-dialog').close();
            el('project-name').value = record.name;
            autosave();
          } catch (error) {
            studio.showToast(error.message);
          }
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'mini-action';
        remove.textContent = 'Eliminar';
        let confirming = false;
        remove.addEventListener('click', async () => {
          if (!confirming) {
            confirming = true;
            remove.textContent = 'Confirmar eliminación';
            return;
          }
          try {
            await projectStore.remove(record.id);
            await list();
          } catch (error) {
            el('projects-status').textContent = error.message;
          }
        });
        item.append(title, date, load, remove);
        container.append(item);
      }
    } catch (error) {
      el('projects-status').textContent = error.message;
    }
  }
  el('nav-projects').addEventListener('click', () => {
    el('projects-dialog').showModal();
    list();
  });
  el('projects-close').addEventListener('click', () => el('projects-dialog').close());
  el('project-save').addEventListener('click', async () => {
    try {
      const name = el('project-name').value.trim() || 'Mi QR';
      const records = await projectStore.list();
      if (records.filter((r) => r.id !== 'autosave').length >= 100)
        throw new Error('Hay 100 proyectos. Exporta o elimina alguno para guardar otro.');
      await projectStore.save({
        id: crypto.randomUUID(),
        name,
        updated: Date.now(),
        state: studio.getState(),
      });
      navigator.storage?.persist?.().catch(() => {});
      el('projects-status').textContent = 'Proyecto guardado.';
      await list();
    } catch (error) {
      el('projects-status').textContent = error.message;
    }
  });
  el('project-export').addEventListener('click', () =>
    saveFile(
      new Blob(
        [
          JSON.stringify(
            {
              app: 'Morphiq QR',
              name: el('project-name').value || 'Mi QR',
              state: studio.getState(),
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
      'json',
      el('project-name').value || 'morphiq-proyecto',
    ),
  );
  el('project-import').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 15_000_000) throw new Error('El proyecto supera 15 MB.');
      const data = JSON.parse(await file.text());
      if (data.app !== 'Morphiq QR')
        throw new Error('Este archivo no es un proyecto de Morphiq QR.');
      studio.applyState(data.state);
      el('project-name').value = String(data.name || 'Proyecto importado').slice(0, 60);
      autosave();
      el('projects-dialog').close();
      studio.showToast('Proyecto importado.');
    } catch (error) {
      el('projects-status').textContent = error.message;
    } finally {
      event.target.value = '';
    }
  });
  document.addEventListener('studio:render', autosave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && ready) {
      clearTimeout(timer);
      revision++;
      saveDraft();
    }
  });
  try {
    const draft = await projectStore.get('autosave');
    if (draft?.state) studio.applyState(draft.state);
    ready = true;
    status(draft ? 'Borrador recuperado' : 'Autoguardado local');
  } catch (error) {
    ready = true;
    status('Sin autoguardado');
    el('projects-status').textContent = error.message;
  }
  return {
    flushDraft() {
      clearTimeout(timer);
      revision++;
      return saveDraft(true);
    },
  };
}
